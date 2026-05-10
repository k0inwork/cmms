import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { signAccessToken } from "../../src/utils/jwt.js";

const mockUser = {
  userId: "user-001",
  email: "tech@test.com",
  role: "TECHNICIAN",
  organizationId: "org-001",
};

const mockDispatcher = {
  userId: "user-002",
  email: "dispatch@test.com",
  role: "DISPATCHER",
  organizationId: "org-001",
};

const TECH_ID = "550e8400-e29b-41d4-a716-446655440020";
const SKILL_ID = "550e8400-e29b-41d4-a716-446655440021";
const CERT_ID = "550e8400-e29b-41d4-a716-446655440022";
const ABSENCE_ID = "550e8400-e29b-41d4-a716-446655440023";
const ASSIGNMENT_ID = "550e8400-e29b-41d4-a716-446655440024";

const mockTechnician = {
  id: TECH_ID,
  first_name: "Jane",
  last_name: "Smith",
  email: "jane@test.com",
  status: "AVAILABLE",
  updated_at: new Date("2026-05-10T10:00:00Z"),
  user_skills: [{ skill: { id: SKILL_ID, name: "Blade Repair" }, proficiency_level: 5 }],
  user_certifications: [{ certification: { id: CERT_ID, name: "GWO" }, expiry_date: null }],
  assignments: [{ id: ASSIGNMENT_ID }],
};

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    absenceRecord: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    assignment: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    replacementSuggestion: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from "../../src/lib/prisma.js";
import technicianRoutes from "../../src/routes/technicians.js";

function makeApp() {
  const app = new Hono();
  app.route("/technicians", technicianRoutes);
  return app;
}

function authHeader(user = mockUser) {
  const token = signAccessToken(user);
  return { Authorization: `Bearer ${token}` };
}

describe("Technician routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /technicians", () => {
    it("returns paginated technician list", async () => {
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockTechnician]);

      const res = await makeApp().request("/technicians", {
        headers: authHeader(),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe("Jane Smith");
      expect(body.data[0].activeAssignments).toBe(1);
      expect(body.pagination).toBeDefined();
    });

    it("applies status filter", async () => {
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await makeApp().request("/technicians?status=AVAILABLE", {
        headers: authHeader(),
      });

      const call = (prisma.user.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.where.status).toBe("AVAILABLE");
    });

    it("applies skillId filter", async () => {
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await makeApp().request(`/technicians?skillId=${SKILL_ID}`, {
        headers: authHeader(),
      });

      const call = (prisma.user.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.where.user_skills).toBeDefined();
    });

    it("requires auth", async () => {
      const res = await makeApp().request("/technicians");
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /technicians/:id/status", () => {
    it("updates own status", async () => {
      const selfUser = { ...mockUser, userId: TECH_ID };
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTechnician);
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TECH_ID,
        status: "SICK",
        updated_at: new Date(),
      });

      const res = await makeApp().request(`/technicians/${TECH_ID}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader(selfUser) },
        body: JSON.stringify({ status: "SICK", notes: "Feeling unwell" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("SICK");
    });

    it("allows dispatcher to update any technician", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTechnician);
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TECH_ID,
        status: "ON_BREAK",
        updated_at: new Date(),
      });

      const res = await makeApp().request(`/technicians/${TECH_ID}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader(mockDispatcher) },
        body: JSON.stringify({ status: "ON_BREAK" }),
      });

      expect(res.status).toBe(200);
    });

    it("blocks tech from updating another tech", async () => {
      const res = await makeApp().request(`/technicians/${TECH_ID}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ status: "SICK" }),
      });

      expect(res.status).toBe(403);
    });

    it("returns 404 for missing technician", async () => {
      const selfUser = { ...mockUser, userId: TECH_ID };
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await makeApp().request(`/technicians/${TECH_ID}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader(selfUser) },
        body: JSON.stringify({ status: "SICK" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /technicians/:id/absence", () => {
    it("records absence", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTechnician);
      (prisma.absenceRecord.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: ABSENCE_ID,
        user_id: TECH_ID,
        reason: "SICK",
        start_date: new Date("2026-05-10T08:00:00Z"),
        expected_return_date: null,
        is_approved: false,
      });
      (prisma.assignment.count as ReturnType<typeof vi.fn>).mockResolvedValue(3);

      const res = await makeApp().request(`/technicians/${TECH_ID}/absence`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          reason: "SICK",
          startDate: "2026-05-10T08:00:00Z",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.reason).toBe("SICK");
      expect(body.affectedAssignments).toBe(3);
      expect(body.replacementSuggestionsAvailable).toBe(true);
    });

    it("returns 404 for missing technician", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await makeApp().request(`/technicians/${TECH_ID}/absence`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          reason: "SICK",
          startDate: "2026-05-10T08:00:00Z",
        }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /technicians/:id/absence-history", () => {
    it("returns absence records", async () => {
      (prisma.absenceRecord.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: ABSENCE_ID, reason: "SICK", created_at: new Date() },
      ]);

      const res = await makeApp().request(`/technicians/${TECH_ID}/absence-history`, {
        headers: authHeader(),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
    });

    it("applies reason filter", async () => {
      (prisma.absenceRecord.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await makeApp().request(`/technicians/${TECH_ID}/absence-history?reason=SICK`, {
        headers: authHeader(),
      });

      const call = (prisma.absenceRecord.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.where.reason).toBe("SICK");
    });
  });

  describe("GET /technicians/:id/assignments", () => {
    it("returns active assignments", async () => {
      (prisma.assignment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: ASSIGNMENT_ID,
          status: "ASSIGNED",
          assigned_at: new Date(),
          accepted_at: null,
          inspection_id: "insp-001",
          work_order_id: null,
          inspection: { id: "insp-001", status: "ASSIGNED" },
          work_order: null,
        },
      ]);

      const res = await makeApp().request(`/technicians/${TECH_ID}/assignments`, {
        headers: authHeader(),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].type).toBe("INSPECTION");
    });
  });

  describe("GET /technicians/:id/replacement-suggestions", () => {
    it("returns ranked candidates", async () => {
      (prisma.absenceRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: ABSENCE_ID,
        user_id: TECH_ID,
      });
      (prisma.replacementSuggestion.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          total_score: 0.85,
          skill_match_score: 0.9,
          cert_match_score: 0.8,
          proximity_score: 0.95,
          workload_score: 0.75,
          familiarity_score: 0.8,
          is_above_threshold: true,
          suggested_user: {
            id: "user-repl",
            first_name: "Bob",
            last_name: "Jones",
            status: "AVAILABLE",
            assignments: [{ id: "a1" }],
          },
        },
      ]);
      (prisma.assignment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: ASSIGNMENT_ID, inspection: { id: "insp-001", status: "ASSIGNED" }, work_order: null },
      ]);

      const res = await makeApp().request(`/technicians/${TECH_ID}/replacement-suggestions`, {
        headers: authHeader(mockDispatcher),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.candidates).toHaveLength(1);
      expect(body.candidates[0].totalScore).toBe(0.85);
      expect(body.escalationRequired).toBe(false);
    });

    it("returns empty when no absence found", async () => {
      (prisma.absenceRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await makeApp().request(`/technicians/${TECH_ID}/replacement-suggestions`, {
        headers: authHeader(mockDispatcher),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.candidates).toHaveLength(0);
    });

    it("requires dispatcher/admin role", async () => {
      const res = await makeApp().request(`/technicians/${TECH_ID}/replacement-suggestions`, {
        headers: authHeader(mockUser), // TECHNICIAN
      });

      expect(res.status).toBe(403);
    });
  });
});
