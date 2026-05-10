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
  userId: "user-003",
  email: "repl@test.com",
  role: "TECHNICIAN",
  organizationId: "org-001",
};

const ABSENCE_ID = "550e8400-e29b-41d4-a716-446655440030";
const CANDIDATE_ID = "550e8400-e29b-41d4-a716-446655440031";
const ASSIGNMENT_ID = "550e8400-e29b-41d4-a716-446655440032";

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    absenceRecord: {
      findUnique: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    assignment: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from "../../src/lib/prisma.js";
import replacementRoutes from "../../src/routes/replacements.js";

function makeApp() {
  const app = new Hono();
  app.route("/replacements", replacementRoutes);
  return app;
}

function authHeader(user = mockDispatcher) {
  const token = signAccessToken(user);
  return { Authorization: `Bearer ${token}` };
}

describe("Replacement routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /replacements", () => {
    it("executes reassignment", async () => {
      (prisma.absenceRecord.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: ABSENCE_ID });
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: CANDIDATE_ID,
        first_name: "Bob",
        last_name: "Jones",
      });
      (prisma.assignment.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });
      (prisma.assignment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: ASSIGNMENT_ID, inspection_id: "insp-001", work_order_id: null, status: "ASSIGNED" },
      ]);

      const res = await makeApp().request("/replacements", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          absenceId: ABSENCE_ID,
          candidateId: CANDIDATE_ID,
          assignmentIds: [ASSIGNMENT_ID],
          reason: "Tech sick",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.status).toBe("PENDING_ACCEPTANCE");
      expect(body.reassignedCount).toBe(2);
      expect(body.candidate.name).toBe("Bob Jones");
    });

    it("returns 404 for missing absence", async () => {
      (prisma.absenceRecord.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await makeApp().request("/replacements", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          absenceId: ABSENCE_ID,
          candidateId: CANDIDATE_ID,
          assignmentIds: [ASSIGNMENT_ID],
        }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 400 for inactive candidate", async () => {
      (prisma.absenceRecord.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: ABSENCE_ID });
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await makeApp().request("/replacements", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          absenceId: ABSENCE_ID,
          candidateId: CANDIDATE_ID,
          assignmentIds: [ASSIGNMENT_ID],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("requires dispatcher/admin role", async () => {
      const res = await makeApp().request("/replacements", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader(mockTech) },
        body: JSON.stringify({
          absenceId: ABSENCE_ID,
          candidateId: CANDIDATE_ID,
          assignmentIds: [ASSIGNMENT_ID],
        }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("POST /replacements/:id/accept", () => {
    it("accepts assignment as assigned replacement", async () => {
      (prisma.assignment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: ASSIGNMENT_ID,
        user_id: mockTech.userId,
      });
      (prisma.assignment.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: ASSIGNMENT_ID,
        accepted_at: new Date(),
      });

      const res = await makeApp().request(`/replacements/${ASSIGNMENT_ID}/accept`, {
        method: "POST",
        headers: authHeader(mockTech),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ACCEPTED");
    });

    it("blocks non-assigned user from accepting", async () => {
      (prisma.assignment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: ASSIGNMENT_ID,
        user_id: "other-user",
      });

      const res = await makeApp().request(`/replacements/${ASSIGNMENT_ID}/accept`, {
        method: "POST",
        headers: authHeader(mockTech),
      });

      expect(res.status).toBe(403);
    });

    it("returns 404 for missing assignment", async () => {
      (prisma.assignment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await makeApp().request(`/replacements/${ASSIGNMENT_ID}/accept`, {
        method: "POST",
        headers: authHeader(mockTech),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /replacements/:id/decline", () => {
    it("declines assignment with reason", async () => {
      (prisma.assignment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: ASSIGNMENT_ID,
        user_id: mockTech.userId,
      });
      (prisma.assignment.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: ASSIGNMENT_ID,
        declined_at: new Date(),
      });

      const res = await makeApp().request(`/replacements/${ASSIGNMENT_ID}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader(mockTech) },
        body: JSON.stringify({ reason: "Too far away" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("DECLINED");
    });

    it("blocks non-assigned user from declining", async () => {
      (prisma.assignment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: ASSIGNMENT_ID,
        user_id: "other-user",
      });

      const res = await makeApp().request(`/replacements/${ASSIGNMENT_ID}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader(mockTech) },
        body: JSON.stringify({ reason: "test" }),
      });

      expect(res.status).toBe(403);
    });
  });
});
