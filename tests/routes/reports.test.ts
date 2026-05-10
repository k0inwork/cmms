import { describe, it, expect, vi, beforeEach } from "vitest";
import { signAccessToken } from "../../src/utils/jwt.js";
import { Hono } from "hono";

// ── Mock Prisma ─────────────────────────────────────────────────────────────

const mockTechnicians = [
  { id: "tech-001", first_name: "Jane", last_name: "Doe", email: "jane@test.com" },
  { id: "tech-002", first_name: "John", last_name: "Smith", email: "john@test.com" },
];

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    inspectionRecord: {
      groupBy: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    workOrder: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    ticket: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

import prisma from "../../src/lib/prisma.js";
import reportRoutes from "../../src/routes/reports.js";

function makeApp() {
  const app = new Hono();
  app.route("/reports", reportRoutes);
  return app;
}

function authHeader(role = "ADMINISTRATOR") {
  const token = signAccessToken({
    userId: "user-admin",
    email: "admin@test.com",
    role,
    organizationId: "org-001",
  });
  return { Authorization: `Bearer ${token}` };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Reports API", () => {
  const app = makeApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  it("requires auth for all endpoints", async () => {
    const endpoints = ["/reports/compliance", "/reports/inspections", "/reports/work-orders", "/reports/technician-productivity", "/reports/dashboard"];
    for (const ep of endpoints) {
      const res = await app.request(ep);
      expect(res.status).toBe(401);
    }
  });

  it("rejects TECHNICIAN role from all endpoints", async () => {
    const endpoints = ["/reports/compliance", "/reports/inspections", "/reports/work-orders", "/reports/technician-productivity", "/reports/dashboard"];
    for (const ep of endpoints) {
      const res = await app.request(ep, { headers: authHeader("TECHNICIAN") });
      expect(res.status).toBe(403);
    }
  });

  // ── GET /reports/compliance ───────────────────────────────────────────────

  describe("GET /reports/compliance", () => {
    it("returns compliance metrics as JSON", async () => {
      vi.mocked(prisma.inspectionRecord.groupBy).mockResolvedValue([
        { status: "SUBMITTED", _count: 10 },
        { status: "APPROVED", _count: 15 },
        { status: "REJECTED", _count: 2 },
        { status: "ASSIGNED", _count: 5 },
      ] as any);
      vi.mocked(prisma.inspectionRecord.count).mockResolvedValue(3);

      const res = await app.request("/reports/compliance", { headers: authHeader() });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.report_type).toBe("compliance");
      expect(body.summary.total_inspections).toBe(32);
      expect(body.summary.completed).toBe(25);
      expect(body.summary.rejected).toBe(2);
      expect(body.summary.overdue).toBe(3);
      expect(body.summary.approval_rate).toBeCloseTo(25 / 32);
      expect(body.by_status.APPROVED).toBe(15);
    });

    it("returns CSV when format=csv", async () => {
      vi.mocked(prisma.inspectionRecord.groupBy).mockResolvedValue([
        { status: "APPROVED", _count: 10 },
      ] as any);
      vi.mocked(prisma.inspectionRecord.count).mockResolvedValue(0);

      const res = await app.request("/reports/compliance?format=csv", { headers: authHeader() });
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/csv");
      const text = await res.text();
      expect(text).toContain("status,count");
      expect(text).toContain("APPROVED,10");
    });

    it("applies date and org filters", async () => {
      vi.mocked(prisma.inspectionRecord.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.inspectionRecord.count).mockResolvedValue(0);

      const res = await app.request(
        "/reports/compliance?dateFrom=2026-01-01T00:00:00Z&dateTo=2026-01-31T23:59:59Z&orgId=aaaaaaaa-0000-0000-0000-000000000001",
        { headers: authHeader() },
      );
      expect(res.status).toBe(200);

      const call = vi.mocked(prisma.inspectionRecord.groupBy).mock.calls[0][0] as Record<string, unknown>;
      expect((call.where as Record<string, unknown>).created_at).toBeDefined();
      expect((call.where as Record<string, unknown>).turbine).toBeDefined();
    });
  });

  // ── GET /reports/inspections ──────────────────────────────────────────────

  describe("GET /reports/inspections", () => {
    it("returns inspection summary with avg completion hours", async () => {
      vi.mocked(prisma.inspectionRecord.groupBy).mockResolvedValue([
        { status: "SUBMITTED", _count: 8 },
        { status: "APPROVED", _count: 12 },
      ] as any);
      vi.mocked(prisma.inspectionRecord.findMany).mockResolvedValue([
        { started_at: new Date("2026-01-01T08:00:00Z"), submitted_at: new Date("2026-01-01T12:00:00Z") },
        { started_at: new Date("2026-01-02T08:00:00Z"), submitted_at: new Date("2026-01-02T14:00:00Z") },
      ] as any);

      const res = await app.request("/reports/inspections", { headers: authHeader("QA_REVIEWER") });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.report_type).toBe("inspections");
      expect(body.summary.total).toBe(20);
      expect(body.summary.avg_completion_hours).toBe(5); // avg of 4h and 6h
    });

    it("returns null avg when no completed inspections", async () => {
      vi.mocked(prisma.inspectionRecord.groupBy).mockResolvedValue([
        { status: "ASSIGNED", _count: 5 },
      ] as any);
      vi.mocked(prisma.inspectionRecord.findMany).mockResolvedValue([]);

      const res = await app.request("/reports/inspections", { headers: authHeader() });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.summary.avg_completion_hours).toBeNull();
    });

    it("returns CSV format", async () => {
      vi.mocked(prisma.inspectionRecord.groupBy).mockResolvedValue([
        { status: "APPROVED", _count: 5 },
      ] as any);
      vi.mocked(prisma.inspectionRecord.findMany).mockResolvedValue([]);

      const res = await app.request("/reports/inspections?format=csv", { headers: authHeader() });
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/csv");
    });
  });

  // ── GET /reports/work-orders ──────────────────────────────────────────────

  describe("GET /reports/work-orders", () => {
    it("returns work order status and priority breakdown", async () => {
      vi.mocked(prisma.workOrder.groupBy)
        .mockResolvedValueOnce([
          { status: "CLOSED", _count: 20 },
          { status: "IN_PROGRESS", _count: 5 },
        ] as any)
        .mockResolvedValueOnce([
          { priority: "HIGH", _count: 10 },
          { priority: "LOW", _count: 15 },
        ] as any);
      vi.mocked(prisma.workOrder.findMany).mockResolvedValue([
        { started_at: new Date("2026-01-01T08:00:00Z"), completed_at: new Date("2026-01-01T16:00:00Z") },
      ] as any);

      const res = await app.request("/reports/work-orders", { headers: authHeader("DISPATCHER") });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.report_type).toBe("work-orders");
      expect(body.summary.total).toBe(25);
      expect(body.summary.closed).toBe(20);
      expect(body.summary.avg_completion_hours).toBe(8);
      expect(body.by_priority.HIGH).toBe(10);
    });

    it("returns CSV format", async () => {
      vi.mocked(prisma.workOrder.groupBy)
        .mockResolvedValueOnce([{ status: "CLOSED", _count: 10 }] as any)
        .mockResolvedValueOnce([{ priority: "HIGH", _count: 10 }] as any);
      vi.mocked(prisma.workOrder.findMany).mockResolvedValue([]);

      const res = await app.request("/reports/work-orders?format=csv", { headers: authHeader() });
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("status,count");
    });
  });

  // ── GET /reports/technician-productivity ──────────────────────────────────

  describe("GET /reports/technician-productivity", () => {
    it("returns per-technician completion stats", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue(mockTechnicians as any);
      vi.mocked(prisma.workOrder.groupBy).mockResolvedValue([
        { assignee_id: "tech-001", _count: 5 },
      ] as any);
      vi.mocked(prisma.inspectionRecord.groupBy).mockResolvedValue([
        { technician_id: "tech-001", _count: 3 },
        { technician_id: "tech-002", _count: 7 },
      ] as any);

      const res = await app.request("/reports/technician-productivity", { headers: authHeader("DISPATCHER") });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.report_type).toBe("technician-productivity");
      expect(body.data).toHaveLength(2);
      expect(body.data[0]).toEqual({
        technician_id: "tech-001",
        name: "Jane Doe",
        email: "jane@test.com",
        work_orders_completed: 5,
        inspections_completed: 3,
      });
      expect(body.data[1].work_orders_completed).toBe(0);
      expect(body.data[1].inspections_completed).toBe(7);
    });

    it("returns empty data when no technicians found", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      const res = await app.request("/reports/technician-productivity", { headers: authHeader() });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toHaveLength(0);
    });

    it("returns CSV format", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue(mockTechnicians as any);
      vi.mocked(prisma.workOrder.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.inspectionRecord.groupBy).mockResolvedValue([]);

      const res = await app.request("/reports/technician-productivity?format=csv", { headers: authHeader() });
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("technician_id,name,email");
      expect(text).toContain("tech-001,Jane Doe,jane@test.com");
    });
  });

  // ── GET /reports/dashboard ──────────────────────────────────────────────────

  describe("GET /reports/dashboard", () => {
    it("returns dashboard KPIs", async () => {
      vi.mocked(prisma.inspectionRecord.groupBy).mockResolvedValue([
        { status: "ASSIGNED", _count: 4 },
        { status: "APPROVED", _count: 12 },
      ] as any);
      vi.mocked(prisma.inspectionRecord.count).mockResolvedValue(2);
      vi.mocked(prisma.ticket.findMany).mockResolvedValue([
        { sla_target_date: new Date("2026-01-10"), closed_at: new Date("2026-01-08") },
        { sla_target_date: new Date("2026-01-10"), closed_at: new Date("2026-01-12") },
      ] as any);
      vi.mocked(prisma.ticket.groupBy).mockResolvedValue([
        { priority: "HIGH", _count: 3 },
        { priority: "LOW", _count: 7 },
      ] as any);
      vi.mocked(prisma.workOrder.groupBy).mockResolvedValue([
        { status: "IN_PROGRESS", _count: 5 },
        { status: "ASSIGNED", _count: 3 },
      ] as any);
      vi.mocked(prisma.user.groupBy).mockResolvedValue([
        { status: "AVAILABLE", _count: 8 },
        { status: "ON_SITE", _count: 4 },
      ] as any);

      const res = await app.request("/reports/dashboard", { headers: authHeader("DISPATCHER") });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.report_type).toBe("dashboard");
      expect(body.inspections.total).toBe(16);
      expect(body.inspections.by_status.ASSIGNED).toBe(4);
      expect(body.inspections.overdue).toBe(2);
      expect(body.tickets.open_total).toBe(10);
      expect(body.tickets.by_priority.HIGH).toBe(3);
      expect(body.tickets.sla_compliance).toBeCloseTo(0.5); // 1 of 2 on time
      expect(body.work_orders.active_total).toBe(8);
      expect(body.work_orders.by_status.IN_PROGRESS).toBe(5);
      expect(body.technician_availability.AVAILABLE).toBe(8);
      expect(body.technician_availability.ON_SITE).toBe(4);
    });

    it("returns 100% SLA compliance when no tickets with SLA", async () => {
      vi.mocked(prisma.inspectionRecord.groupBy).mockResolvedValue([] as any);
      vi.mocked(prisma.inspectionRecord.count).mockResolvedValue(0);
      vi.mocked(prisma.ticket.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.ticket.groupBy).mockResolvedValue([] as any);
      vi.mocked(prisma.workOrder.groupBy).mockResolvedValue([] as any);
      vi.mocked(prisma.user.groupBy).mockResolvedValue([] as any);

      const res = await app.request("/reports/dashboard", { headers: authHeader("OPERATIONS_MANAGER") });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.tickets.sla_compliance).toBe(1);
      expect(body.inspections.total).toBe(0);
      expect(body.work_orders.active_total).toBe(0);
    });

    it("rejects QA_REVIEWER role", async () => {
      const res = await app.request("/reports/dashboard", { headers: authHeader("QA_REVIEWER") });
      expect(res.status).toBe(403);
    });
  });
});
