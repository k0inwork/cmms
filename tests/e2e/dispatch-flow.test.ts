import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { signAccessToken } from "../../src/utils/jwt.js";

// ── Mock Prisma ─────────────────────────────────────────────────────────────

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    absenceRecord: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    assignment: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    replacementSuggestion: {
      findMany: vi.fn(),
    },
    inspectionRecord: {
      findFirst: vi.fn(),
    },
    workOrder: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    ticket: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from "../../src/lib/prisma.js";
import technicianRoutes from "../../src/routes/technicians.js";
import dispatchRoutes from "../../src/routes/dispatch.js";

function makeApp() {
  const app = new Hono();
  app.route("/technicians", technicianRoutes);
  app.route("/dispatch", dispatchRoutes);
  return app;
}

const TECH_ID = "c0000000-0000-0000-0000-000000000001";
const TECH2_ID = "c0000000-0000-0000-0000-000000000002";
const INSP_ID = "e0000000-0000-0000-0000-000000000001";
const WO_ID = "f0000000-0000-0000-0000-000000000001";

function dispatcherToken() {
  return signAccessToken({
    userId: "a0000000-0000-0000-0000-000000000001",
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

describe("E2E: Dispatch Flow (US-DISPATCH)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── TC-DISPATCH-01: View dispatcher board with technician availability ──────

  describe("TC-DISPATCH-01: Dispatcher board with availability", () => {
    it("shows coverage overview with technician statuses", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: TECH_ID,
          first_name: "Alice",
          last_name: "Technician",
          status: "AVAILABLE",
          assignments: [
            {
              id: "a1000000-0000-0000-0000-000000000001",
              assigned_at: new Date(),
              inspection: { id: INSP_ID, status: "ASSIGNED" },
              work_order: null,
            },
          ],
        },
        {
          id: TECH2_ID,
          first_name: "Bob",
          last_name: "Technician",
          status: "ON_SITE",
          assignments: [],
        },
      ] as any);

      const app = makeApp();
      const res = await app.request("/dispatch/coverage", {
        headers: authHeaders(dispatcherToken()),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.technicians).toHaveLength(2);
      expect(body.technicians[0].status).toBe("AVAILABLE");
      expect(body.technicians[0].assignments).toHaveLength(1);
      expect(body.technicians[1].status).toBe("ON_SITE");
      expect(body.technicians[1].assignments).toHaveLength(0);
    });

    it("rejects technician from viewing coverage board", async () => {
      const app = makeApp();
      const res = await app.request("/dispatch/coverage", {
        headers: authHeaders(techToken()),
      });

      expect(res.status).toBe(403);
    });

    it("shows SLA risk for overdue tickets and work orders", async () => {
      vi.mocked(prisma.ticket.findMany).mockResolvedValue([
        {
          id: "a2000000-0000-0000-0000-000000000001",
          title: "Urgent blade repair",
          status: "IN_PROGRESS",
          sla_target_date: new Date(Date.now() - 1000),
          assignee_id: TECH_ID,
          assignee: { id: TECH_ID, first_name: "Alice", last_name: "T" },
        },
      ] as any);
      vi.mocked(prisma.workOrder.findMany).mockResolvedValue([]);

      const app = makeApp();
      const res = await app.request("/dispatch/sla-risk", {
        headers: authHeaders(dispatcherToken()),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.atRisk).toHaveLength(1);
      expect(body.atRisk[0].type).toBe("TICKET");
      expect(body.atRisk[0].riskLevel).toBe("CRITICAL");
    });
  });

  // ── TC-DISPATCH-02: Assign work order to available technician ──────────────

  describe("TC-DISPATCH-02: Assign work order to available technician", () => {
    it("assigns work order to available technician", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: TECH_ID,
        status: "AVAILABLE",
        is_active: true,
        deleted_at: null,
      } as any);
      vi.mocked(prisma.workOrder.findFirst).mockResolvedValue({
        id: WO_ID,
        status: "APPROVED",
        deleted_at: null,
      } as any);
      vi.mocked(prisma.assignment.create).mockResolvedValue({
        id: "a3000000-0000-0000-0000-000000000001",
        user_id: TECH_ID,
        work_order_id: WO_ID,
        inspection_id: null,
        status: "ASSIGNED",
        assigned_by: "a0000000-0000-0000-0000-000000000001",
        assigned_at: new Date(),
      } as any);

      const app = makeApp();
      const res = await app.request("/dispatch/assign", {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({
          assignmentType: "WORK_ORDER",
          assignmentId: WO_ID,
          technicianId: TECH_ID,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.status).toBe("ASSIGNED");
      expect(body.work_order_id).toBe(WO_ID);
      expect(prisma.assignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: TECH_ID,
            work_order_id: WO_ID,
            status: "ASSIGNED",
          }),
        })
      );
    });

    it("rejects assignment to unavailable technician (SICK)", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: TECH_ID,
        status: "SICK",
        is_active: true,
        deleted_at: null,
      } as any);

      const app = makeApp();
      const res = await app.request("/dispatch/assign", {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({
          assignmentType: "WORK_ORDER",
          assignmentId: WO_ID,
          technicianId: TECH_ID,
        }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.code).toBe("DISP_002");
    });

    it("returns 404 for nonexistent work order", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: TECH_ID,
        status: "AVAILABLE",
        is_active: true,
        deleted_at: null,
      } as any);
      vi.mocked(prisma.workOrder.findFirst).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/dispatch/assign", {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({
          assignmentType: "WORK_ORDER",
          assignmentId: WO_ID,
          technicianId: TECH_ID,
        }),
      });

      expect(res.status).toBe(404);
    });

    it("technician cannot assign work orders", async () => {
      const app = makeApp();
      const res = await app.request("/dispatch/assign", {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({
          assignmentType: "WORK_ORDER",
          assignmentId: WO_ID,
          technicianId: TECH_ID,
        }),
      });

      expect(res.status).toBe(403);
    });
  });

  // ── TC-DISPATCH-03: Absence marking triggers replacement suggestions ───────

  describe("TC-DISPATCH-03: Absence → replacement suggestions", () => {
    it("marks technician absent and reports affected assignments", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: TECH_ID,
        deleted_at: null,
      } as any);
      vi.mocked(prisma.absenceRecord.create).mockResolvedValue({
        id: "a4000000-0000-0000-0000-000000000001",
        user_id: TECH_ID,
        reason: "SICK",
        start_date: new Date(),
        expected_return_date: null,
        notes: null,
        is_approved: false,
        created_at: new Date(),
      } as any);
      vi.mocked(prisma.assignment.count).mockResolvedValue(2);

      const app = makeApp();
      const res = await app.request(`/technicians/${TECH_ID}/absence`, {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({
          reason: "SICK",
          startDate: new Date().toISOString(),
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.reason).toBe("SICK");
      expect(body.affectedAssignments).toBe(2);
      expect(body.replacementSuggestionsAvailable).toBe(true);
    });

    it("returns replacement suggestions for absent technician", async () => {
      vi.mocked(prisma.absenceRecord.findFirst).mockResolvedValue({
        id: "a4000000-0000-0000-0000-000000000001",
        user_id: TECH_ID,
        created_at: new Date(),
      } as any);
      vi.mocked(prisma.replacementSuggestion.findMany).mockResolvedValue([
        {
          id: "a5000000-0000-0000-0000-000000000001",
          absence_record_id: "a4000000-0000-0000-0000-000000000001",
          suggested_user_id: TECH2_ID,
          total_score: 0.85,
          skill_match_score: 0.9,
          cert_match_score: 0.8,
          proximity_score: 0.7,
          workload_score: 0.95,
          familiarity_score: 0.9,
          is_above_threshold: true,
          suggested_user: {
            id: TECH2_ID,
            first_name: "Bob",
            last_name: "Technician",
            status: "AVAILABLE",
            assignments: [],
          },
        },
      ] as any);
      vi.mocked(prisma.assignment.findMany).mockResolvedValue([
        {
          id: "a6000000-0000-0000-0000-000000000001",
          inspection: null,
          work_order: { id: WO_ID, title: "Blade repair", due_date: new Date() },
        },
      ] as any);

      const app = makeApp();
      const res = await app.request(
        `/technicians/${TECH_ID}/replacement-suggestions`,
        { headers: authHeaders(dispatcherToken()) }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.absentTechnicianId).toBe(TECH_ID);
      expect(body.affectedAssignments).toHaveLength(1);
      expect(body.candidates).toHaveLength(1);
      expect(body.candidates[0].totalScore).toBe(0.85);
      expect(body.candidates[0].isAboveThreshold).toBe(true);
      expect(body.escalationRequired).toBe(false);
    });

    it("flags escalation when no candidate meets threshold", async () => {
      vi.mocked(prisma.absenceRecord.findFirst).mockResolvedValue({
        id: "a4000000-0000-0000-0000-000000000001",
        user_id: TECH_ID,
        created_at: new Date(),
      } as any);
      vi.mocked(prisma.replacementSuggestion.findMany).mockResolvedValue([
        {
          id: "a5000000-0000-0000-0000-000000000001",
          absence_record_id: "a4000000-0000-0000-0000-000000000001",
          suggested_user_id: TECH2_ID,
          total_score: 0.3,
          skill_match_score: 0.2,
          cert_match_score: 0.1,
          proximity_score: 0.5,
          workload_score: 0.3,
          familiarity_score: 0.4,
          is_above_threshold: false,
          suggested_user: {
            id: TECH2_ID,
            first_name: "Bob",
            last_name: "Technician",
            status: "AVAILABLE",
            assignments: [],
          },
        },
      ] as any);
      vi.mocked(prisma.assignment.findMany).mockResolvedValue([
        { id: "a6000000-0000-0000-0000-000000000001", inspection: null, work_order: { id: WO_ID, title: "Repair", due_date: null } },
      ] as any);

      const app = makeApp();
      const res = await app.request(
        `/technicians/${TECH_ID}/replacement-suggestions`,
        { headers: authHeaders(dispatcherToken()) }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.escalationRequired).toBe(true);
    });

    it("technician cannot view replacement suggestions", async () => {
      const app = makeApp();
      const res = await app.request(
        `/technicians/${TECH_ID}/replacement-suggestions`,
        { headers: authHeaders(techToken()) }
      );

      expect(res.status).toBe(403);
    });
  });
});
