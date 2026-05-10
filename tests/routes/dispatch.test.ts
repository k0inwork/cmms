import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { signAccessToken } from "../../src/utils/jwt.js";

const mockDispatcher = {
  userId: "user-002",
  email: "dispatch@test.com",
  role: "DISPATCHER",
  organizationId: "org-001",
};

const mockTech = {
  userId: "user-001",
  email: "tech@test.com",
  role: "TECHNICIAN",
  organizationId: "org-001",
};

const TECH_ID = "550e8400-e29b-41d4-a716-446655440020";
const TICKET_ID = "550e8400-e29b-41d4-a716-446655440040";
const WO_ID = "550e8400-e29b-41d4-a716-446655440041";
const INSP_ID = "550e8400-e29b-41d4-a716-446655440042";

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    ticket: {
      findMany: vi.fn(),
    },
    workOrder: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    inspectionRecord: {
      findFirst: vi.fn(),
    },
    assignment: {
      create: vi.fn(),
    },
  },
}));

import prisma from "../../src/lib/prisma.js";
import dispatchRoutes from "../../src/routes/dispatch.js";

function makeApp() {
  const app = new Hono();
  app.route("/dispatch", dispatchRoutes);
  return app;
}

function authHeader(user = mockDispatcher) {
  const token = signAccessToken(user);
  return { Authorization: `Bearer ${token}` };
}

describe("Dispatch routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /dispatch/coverage", () => {
    it("returns coverage view", async () => {
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: TECH_ID,
          first_name: "Jane",
          last_name: "Smith",
          status: "ASSIGNED",
          assignments: [
            { id: "a1", assigned_at: new Date(), inspection: { id: "insp-1", status: "IN_PROGRESS" }, work_order: null },
          ],
        },
      ]);

      const res = await makeApp().request("/dispatch/coverage", {
        headers: authHeader(),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.technicians).toHaveLength(1);
      expect(body.technicians[0].name).toBe("Jane Smith");
      expect(body.technicians[0].assignments).toHaveLength(1);
    });

    it("applies siteId filter", async () => {
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await makeApp().request("/dispatch/coverage?siteId=550e8400-e29b-41d4-a716-446655440099", {
        headers: authHeader(),
      });

      const call = (prisma.user.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.where.availability_slots).toBeDefined();
    });

    it("requires dispatcher/admin role", async () => {
      const res = await makeApp().request("/dispatch/coverage", {
        headers: authHeader(mockTech),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /dispatch/sla-risk", () => {
    it("returns at-risk tickets and work orders", async () => {
      const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
      (prisma.ticket.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: TICKET_ID,
          title: "Blade crack",
          sla_target_date: futureDate,
          assignee_id: TECH_ID,
          assignee: { id: TECH_ID, first_name: "Jane", last_name: "Smith" },
        },
      ]);
      (prisma.workOrder.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await makeApp().request("/dispatch/sla-risk", {
        headers: authHeader(),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.atRisk).toHaveLength(1);
      expect(body.atRisk[0].type).toBe("TICKET");
      expect(body.atRisk[0].riskLevel).toBeDefined();
    });

    it("assigns CRITICAL risk for past-due items", async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000);
      (prisma.ticket.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: TICKET_ID,
          title: "Overdue ticket",
          sla_target_date: pastDate,
          assignee_id: TECH_ID,
          assignee: { id: TECH_ID, first_name: "Jane", last_name: "Smith" },
        },
      ]);
      (prisma.workOrder.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await makeApp().request("/dispatch/sla-risk", {
        headers: authHeader(),
      });

      const body = await res.json();
      expect(body.atRisk[0].riskLevel).toBe("CRITICAL");
    });
  });

  describe("POST /dispatch/assign", () => {
    it("creates assignment for inspection", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TECH_ID,
        status: "AVAILABLE",
      });
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: INSP_ID,
      });
      (prisma.assignment.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "new-assignment-id",
        user_id: TECH_ID,
        inspection_id: INSP_ID,
        work_order_id: null,
        status: "ASSIGNED",
        assigned_by: mockDispatcher.userId,
      });

      const res = await makeApp().request("/dispatch/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          assignmentType: "INSPECTION",
          assignmentId: INSP_ID,
          technicianId: TECH_ID,
        }),
      });

      expect(res.status).toBe(201);
      expect(prisma.assignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: TECH_ID,
            inspection_id: INSP_ID,
            work_order_id: null,
          }),
        })
      );
    });

    it("rejects unavailable technician (DISP_002)", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TECH_ID,
        status: "SICK",
      });

      const res = await makeApp().request("/dispatch/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          assignmentType: "INSPECTION",
          assignmentId: INSP_ID,
          technicianId: TECH_ID,
        }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.code).toBe("DISP_002");
    });

    it("returns 404 for missing inspection", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TECH_ID,
        status: "AVAILABLE",
      });
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await makeApp().request("/dispatch/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          assignmentType: "INSPECTION",
          assignmentId: INSP_ID,
          technicianId: TECH_ID,
        }),
      });

      expect(res.status).toBe(404);
    });

    it("requires dispatcher/admin role", async () => {
      const res = await makeApp().request("/dispatch/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader(mockTech) },
        body: JSON.stringify({
          assignmentType: "INSPECTION",
          assignmentId: INSP_ID,
          technicianId: TECH_ID,
        }),
      });

      expect(res.status).toBe(403);
    });
  });
});
