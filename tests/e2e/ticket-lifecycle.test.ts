import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { signAccessToken } from "../../src/utils/jwt.js";

// ── Mock Prisma ─────────────────────────────────────────────────────────────

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    ticket: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ticketEvidence: {
      createMany: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    defect: {
      findFirst: vi.fn(),
    },
    turbine: {
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  },
}));

import prisma from "../../src/lib/prisma.js";
import ticketRoutes from "../../src/routes/tickets.js";

function makeApp() {
  const app = new Hono();
  app.route("/tickets", ticketRoutes);
  return app;
}

const TKT_ID = "a0000000-0000-0000-0000-000000000001";
const TURB_ID = "b0000000-0000-0000-0000-000000000001";
const DEFECT_ID = "c0000000-0000-0000-0000-000000000001";
const TECH_ID = "d0000000-0000-0000-0000-000000000001";

function dispatcherToken() {
  return signAccessToken({
    userId: "e0000000-0000-0000-0000-000000000001",
    email: "disp@test.com",
    role: "DISPATCHER",
    organizationId: "org-1",
  });
}

function techToken(userId = TECH_ID) {
  return signAccessToken({
    userId,
    email: "tech@test.com",
    role: "TECHNICIAN",
    organizationId: "org-1",
  });
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function mockTicketWithStatus(status: string): any {
  return {
    id: TKT_ID,
    defect_id: null,
    turbine_id: TURB_ID,
    component_id: null,
    title: "Blade crack detected",
    description: "Major crack found on blade 2",
    priority: "HIGH",
    severity: "MAJOR",
    status,
    assignee_id: status === "ASSIGNED" || status === "IN_PROGRESS" || status === "PENDING_REVIEW" ? TECH_ID : null,
    created_by: "e0000000-0000-0000-0000-000000000001",
    due_date: null,
    sla_target_date: null,
    resolution_notes: null,
    root_cause: null,
    closed_at: null,
    sync_status: "SYNCED",
    client_id: null,
    created_at: new Date("2026-01-01"),
    updated_at: new Date("2026-01-01"),
    deleted_at: null,
    assignee: status === "ASSIGNED" || status === "IN_PROGRESS" || status === "PENDING_REVIEW"
      ? { id: TECH_ID, first_name: "Tech", last_name: "User" }
      : null,
    creator: { id: "e0000000-0000-0000-0000-000000000001", first_name: "Dispatch", last_name: "User" },
    turbine: { id: TURB_ID, name: "WTG-001" },
    component: null,
    defect: null,
  };
}

describe("E2E: Ticket Lifecycle (US-TICKET)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── TC-TICKET-01: Create ticket from inspection defect ─────────────────────

  describe("TC-TICKET-01: Create ticket from defect", () => {
    it("creates ticket linked to a defect", async () => {
      vi.mocked(prisma.defect.findFirst).mockResolvedValue({
        id: DEFECT_ID,
        severity: "MAJOR",
        description: "Crack on blade 2",
        deleted_at: null,
      } as any);
      vi.mocked(prisma.turbine.findFirst).mockResolvedValue({
        id: TURB_ID,
        deleted_at: null,
      } as any);
      vi.mocked(prisma.ticket.create).mockResolvedValue({
        ...mockTicketWithStatus("NEW"),
        defect_id: DEFECT_ID,
        defect: { id: DEFECT_ID, severity: "MAJOR", description: "Crack on blade 2" },
      });
      vi.mocked(prisma.auditEvent.create).mockResolvedValue({} as any);

      const app = makeApp();
      const res = await app.request("/tickets", {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({
          defectId: DEFECT_ID,
          turbineId: TURB_ID,
          title: "Blade crack detected",
          description: "Major crack found on blade 2",
          priority: "HIGH",
          severity: "MAJOR",
        }),
      });

      expect(res.status).toBe(201);
      expect(prisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            defect_id: DEFECT_ID,
            status: "NEW",
          }),
        })
      );
    });
  });

  // ── TC-TICKET-02: Full state machine transitions ──────────────────────────

  describe("TC-TICKET-02: State transitions NEW→TRIAGED→ASSIGNED→IN_PROGRESS→PENDING_REVIEW→CLOSED", () => {
    it("walks the full happy path", async () => {
      const app = makeApp();

      // NEW → TRIAGED
      vi.mocked(prisma.ticket.findFirst).mockResolvedValue(mockTicketWithStatus("NEW") as any);
      vi.mocked(prisma.ticket.update).mockResolvedValue({
        ...mockTicketWithStatus("TRIAGED"),
      });
      vi.mocked(prisma.auditEvent.create).mockResolvedValue({} as any);

      let res = await app.request(`/tickets/${TKT_ID}/status`, {
        method: "PATCH",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ status: "TRIAGED" }),
      });
      expect(res.status).toBe(200);

      // TRIAGED → ASSIGNED (via assign endpoint)
      vi.mocked(prisma.ticket.findFirst).mockResolvedValue(mockTicketWithStatus("TRIAGED") as any);
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: TECH_ID,
        is_active: true,
        deleted_at: null,
      } as any);
      vi.mocked(prisma.ticket.update).mockResolvedValue({
        ...mockTicketWithStatus("ASSIGNED"),
        assignee_id: TECH_ID,
      });

      res = await app.request(`/tickets/${TKT_ID}/assign`, {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ assigneeId: TECH_ID }),
      });
      expect(res.status).toBe(200);
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "ASSIGNED", assignee_id: TECH_ID }),
        })
      );

      // ASSIGNED → IN_PROGRESS
      vi.mocked(prisma.ticket.findFirst).mockResolvedValue(mockTicketWithStatus("ASSIGNED") as any);
      vi.mocked(prisma.ticket.update).mockResolvedValue({
        ...mockTicketWithStatus("IN_PROGRESS"),
      });

      res = await app.request(`/tickets/${TKT_ID}/status`, {
        method: "PATCH",
        headers: authHeaders(techToken(TECH_ID)),
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });
      expect(res.status).toBe(200);

      // IN_PROGRESS → PENDING_REVIEW
      vi.mocked(prisma.ticket.findFirst).mockResolvedValue(mockTicketWithStatus("IN_PROGRESS") as any);
      vi.mocked(prisma.ticket.update).mockResolvedValue({
        ...mockTicketWithStatus("PENDING_REVIEW"),
      });

      res = await app.request(`/tickets/${TKT_ID}/status`, {
        method: "PATCH",
        headers: authHeaders(techToken(TECH_ID)),
        body: JSON.stringify({ status: "PENDING_REVIEW" }),
      });
      expect(res.status).toBe(200);

      // PENDING_REVIEW → CLOSED (via close endpoint)
      vi.mocked(prisma.ticket.findFirst).mockResolvedValue(mockTicketWithStatus("PENDING_REVIEW") as any);
      vi.mocked(prisma.ticket.update).mockResolvedValue({
        ...mockTicketWithStatus("CLOSED"),
        closed_at: new Date(),
        resolution_notes: "Blade repaired",
      });

      res = await app.request(`/tickets/${TKT_ID}/close`, {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({
          resolutionNotes: "Blade repaired",
          rootCause: "Fatigue failure",
        }),
      });
      expect(res.status).toBe(200);
      const closed = await res.json();
      expect(closed.status).toBe("CLOSED");
    });

    it("rejects invalid transitions", async () => {
      vi.mocked(prisma.ticket.findFirst).mockResolvedValue(mockTicketWithStatus("NEW") as any);

      const app = makeApp();
      const res = await app.request(`/tickets/${TKT_ID}/status`, {
        method: "PATCH",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ status: "CLOSED" }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.code).toBe("TKT_001");
    });
  });

  // ── TC-TICKET-03: Reopen closed ticket ────────────────────────────────────

  describe("TC-TICKET-03: Reopen closed ticket", () => {
    it("reopens CLOSED → REOPENED, then transitions back to TRIAGED", async () => {
      const app = makeApp();

      // Reopen
      vi.mocked(prisma.ticket.findFirst).mockResolvedValue(mockTicketWithStatus("CLOSED") as any);
      vi.mocked(prisma.ticket.update).mockResolvedValue({
        ...mockTicketWithStatus("REOPENED"),
        closed_at: null,
        resolution_notes: null,
        root_cause: null,
      });
      vi.mocked(prisma.auditEvent.create).mockResolvedValue({} as any);

      const reopenRes = await app.request(`/tickets/${TKT_ID}/reopen`, {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ reason: "Issue recurred after repair" }),
      });
      expect(reopenRes.status).toBe(200);
      const reopened = await reopenRes.json();
      expect(reopened.status).toBe("REOPENED");

      // Verify cleared fields
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            closed_at: null,
            resolution_notes: null,
            root_cause: null,
          }),
        })
      );

      // REOPENED → TRIAGED
      vi.mocked(prisma.ticket.findFirst).mockResolvedValue({
        ...mockTicketWithStatus("REOPENED"),
      } as any);
      vi.mocked(prisma.ticket.update).mockResolvedValue({
        ...mockTicketWithStatus("TRIAGED"),
      });

      const triageRes = await app.request(`/tickets/${TKT_ID}/status`, {
        method: "PATCH",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ status: "TRIAGED" }),
      });
      expect(triageRes.status).toBe(200);
    });

    it("cannot reopen non-CLOSED ticket", async () => {
      vi.mocked(prisma.ticket.findFirst).mockResolvedValue(
        mockTicketWithStatus("IN_PROGRESS") as any
      );

      const app = makeApp();
      const res = await app.request(`/tickets/${TKT_ID}/reopen`, {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ reason: "Try again" }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.code).toBe("TKT_004");
    });

    it("technician cannot reopen (403)", async () => {
      const app = makeApp();
      const res = await app.request(`/tickets/${TKT_ID}/reopen`, {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({ reason: "Reopen" }),
      });

      expect(res.status).toBe(403);
    });
  });
});
