import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("../../src/utils/jwt.js", () => ({
  verifyAccessToken: vi.fn(() => ({
    userId: "admin-001",
    email: "admin@test.com",
    role: "ADMINISTRATOR",
    organizationId: "org-001",
  })),
  signAccessToken: vi.fn(() => "test-token"),
  signRefreshToken: vi.fn(() => "test-refresh"),
  verifyRefreshToken: vi.fn(),
}));

vi.mock("../../src/utils/password.js", () => ({
  hashPassword: vi.fn(() => Promise.resolve("hashed-password")),
}));

const mockUser = {
  id: "user-001",
  email: "tech@test.com",
  first_name: "John",
  last_name: "Doe",
  role: "TECHNICIAN",
  is_active: true,
  status: "AVAILABLE",
  organization_id: "org-001",
  password_hash: "hashed-password",
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  deleted_at: null,
};

const mockSkill = {
  id: "skill-001",
  name: "Blade Repair",
  category: "Blades",
  description: "Blade inspection and repair",
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  deleted_at: null,
};

const mockCert = {
  id: "cert-001",
  name: "GWO Safety",
  issuing_body: "GWO",
  validity_months: 24,
  description: "Global Wind Organisation safety training",
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  deleted_at: null,
};

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    skill: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    certification: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userSkill: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    userCertification: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
    },
  },
}));

import { Hono } from "hono";
import prisma from "../../src/lib/prisma.js";
import { verifyAccessToken } from "../../src/utils/jwt.js";
import adminRoutes, { _resetWorkflowRules } from "../../src/routes/admin.js";

function makeApp() {
  const app = new Hono();
  app.route("/admin", adminRoutes);
  return app;
}

const authHeader = { Authorization: "Bearer test-token" };

describe("Admin routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetWorkflowRules();
  });

  // ── Auth guards ────────────────────────────────────────────────────────────

  it("rejects requests without auth token", async () => {
    const app = makeApp();
    const res = await app.request("/admin/users");
    expect(res.status).toBe(401);
  });

  it("rejects non-admin users with 403", async () => {
    (verifyAccessToken as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      userId: "tech-001",
      email: "tech@test.com",
      role: "TECHNICIAN",
      organizationId: "org-001",
    }));

    const app = makeApp();
    const res = await app.request("/admin/users", {
      headers: { Authorization: "Bearer tech-token" },
    });
    expect(res.status).toBe(403);
  });

  // ── GET /admin/users ───────────────────────────────────────────────────────

  describe("GET /admin/users", () => {
    it("returns paginated list of users", async () => {
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockUser]);

      const app = makeApp();
      const res = await app.request("/admin/users", { headers: authHeader });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].email).toBe("tech@test.com");
      expect(body.pagination).toBeDefined();
    });
  });

  // ── POST /admin/users ──────────────────────────────────────────────────────

  describe("POST /admin/users", () => {
    it("creates a user", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const app = makeApp();
      const res = await app.request("/admin/users", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "tech@test.com",
          password: "securepass123",
          firstName: "John",
          lastName: "Doe",
          role: "TECHNICIAN",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.email).toBe("tech@test.com");
    });

    it("rejects duplicate email with 409", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const app = makeApp();
      const res = await app.request("/admin/users", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "tech@test.com",
          password: "securepass123",
          firstName: "John",
          lastName: "Doe",
          role: "TECHNICIAN",
        }),
      });

      expect(res.status).toBe(409);
    });

    it("rejects short password with 400", async () => {
      const app = makeApp();
      const res = await app.request("/admin/users", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "tech@test.com",
          password: "short",
          firstName: "John",
          lastName: "Doe",
          role: "TECHNICIAN",
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /admin/users/:id ───────────────────────────────────────────────────

  describe("GET /admin/users/:id", () => {
    it("returns a user with skills and certifications", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockUser,
        user_skills: [],
        user_certifications: [],
      });

      const app = makeApp();
      const res = await app.request("/admin/users/user-001", { headers: authHeader });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.id).toBe("user-001");
    });

    it("returns 404 for missing user", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/admin/users/nope", { headers: authHeader });
      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /admin/users/:id ─────────────────────────────────────────────────

  describe("PATCH /admin/users/:id", () => {
    it("updates a user", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockUser,
        first_name: "Jane",
      });

      const app = makeApp();
      const res = await app.request("/admin/users/user-001", {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: "Jane" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.first_name).toBe("Jane");
    });

    it("returns 404 for missing user", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/admin/users/nope", {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: "Jane" }),
      });

      expect(res.status).toBe(404);
    });

    it("rejects duplicate email on update with 409", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockUser,
        id: "user-002",
      });

      const app = makeApp();
      const res = await app.request("/admin/users/user-001", {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ email: "taken@test.com" }),
      });

      expect(res.status).toBe(409);
    });
  });

  // ── Activation / Deactivation ──────────────────────────────────────────────

  describe("POST /admin/users/:id/activate", () => {
    it("activates a user", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockUser,
        is_active: false,
      });
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockUser,
        is_active: true,
      });

      const app = makeApp();
      const res = await app.request("/admin/users/user-001/activate", {
        method: "POST",
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.is_active).toBe(true);
    });

    it("returns 404 for missing user", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/admin/users/nope/activate", {
        method: "POST",
        headers: authHeader,
      });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /admin/users/:id/deactivate", () => {
    it("deactivates a user", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockUser,
        is_active: false,
      });

      const app = makeApp();
      const res = await app.request("/admin/users/user-001/deactivate", {
        method: "POST",
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.is_active).toBe(false);
    });
  });

  // ── Skill Assignment ───────────────────────────────────────────────────────

  describe("POST /admin/users/:id/skills", () => {
    it("assigns a skill to a user", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (prisma.skill.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockSkill);
      (prisma.userSkill.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.userSkill.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "us-001",
        user_id: "user-001",
        skill_id: "skill-001",
        proficiency_level: 5,
        acquired_date: new Date("2026-01-01"),
        skill: mockSkill,
      });

      const app = makeApp();
      const res = await app.request("/admin/users/user-001/skills", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          skillId: "skill-001",
          proficiencyLevel: 5,
          acquiredDate: "2026-01-01T00:00:00Z",
        }),
      });

      expect(res.status).toBe(201);
    });

    it("rejects duplicate assignment with 409", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (prisma.skill.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockSkill);
      (prisma.userSkill.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "us-001" });

      const app = makeApp();
      const res = await app.request("/admin/users/user-001/skills", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          skillId: "skill-001",
          proficiencyLevel: 5,
          acquiredDate: "2026-01-01T00:00:00Z",
        }),
      });

      expect(res.status).toBe(409);
    });

    it("returns 404 for missing skill", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (prisma.skill.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/admin/users/user-001/skills", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          skillId: "skill-nope",
          proficiencyLevel: 5,
          acquiredDate: "2026-01-01T00:00:00Z",
        }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /admin/users/:id/skills/:skillId", () => {
    it("removes a skill from a user", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (prisma.userSkill.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "us-001" });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.userSkill.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "us-001" });

      const app = makeApp();
      const res = await app.request("/admin/users/user-001/skills/skill-001", {
        method: "DELETE",
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.deleted).toBe(true);
      expect(prisma.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entity_type: "UserSkill",
            entity_id: "us-001",
            action: "DELETE",
          }),
        })
      );
    });

    it("returns 404 for missing assignment", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (prisma.userSkill.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/admin/users/user-001/skills/skill-nope", {
        method: "DELETE",
        headers: authHeader,
      });

      expect(res.status).toBe(404);
    });
  });

  // ── Certification Assignment ───────────────────────────────────────────────

  describe("POST /admin/users/:id/certifications", () => {
    it("assigns a certification to a user", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (prisma.certification.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockCert);
      (prisma.userCertification.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.userCertification.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "uc-001",
        user_id: "user-001",
        certification_id: "cert-001",
        issued_date: new Date("2026-01-01"),
        expiry_date: null,
        certification: mockCert,
      });

      const app = makeApp();
      const res = await app.request("/admin/users/user-001/certifications", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          certificationId: "cert-001",
          issuedDate: "2026-01-01T00:00:00Z",
        }),
      });

      expect(res.status).toBe(201);
    });

    it("rejects duplicate assignment with 409", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (prisma.certification.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockCert);
      (prisma.userCertification.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "uc-001",
      });

      const app = makeApp();
      const res = await app.request("/admin/users/user-001/certifications", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          certificationId: "cert-001",
          issuedDate: "2026-01-01T00:00:00Z",
        }),
      });

      expect(res.status).toBe(409);
    });
  });

  describe("DELETE /admin/users/:id/certifications/:certId", () => {
    it("removes a certification from a user", async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (prisma.userCertification.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "uc-001",
      });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.userCertification.delete as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "uc-001",
      });

      const app = makeApp();
      const res = await app.request("/admin/users/user-001/certifications/cert-001", {
        method: "DELETE",
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      expect(prisma.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entity_type: "UserCertification",
            entity_id: "uc-001",
            action: "DELETE",
          }),
        })
      );
    });
  });

  // ── Skills CRUD ────────────────────────────────────────────────────────────

  describe("GET /admin/skills", () => {
    it("returns paginated list of skills", async () => {
      (prisma.skill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockSkill]);

      const app = makeApp();
      const res = await app.request("/admin/skills", { headers: authHeader });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe("Blade Repair");
    });
  });

  describe("POST /admin/skills", () => {
    it("creates a skill", async () => {
      (prisma.skill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.skill.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockSkill);

      const app = makeApp();
      const res = await app.request("/admin/skills", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Blade Repair", category: "Blades" }),
      });

      expect(res.status).toBe(201);
    });

    it("rejects duplicate name with 409", async () => {
      (prisma.skill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSkill);

      const app = makeApp();
      const res = await app.request("/admin/skills", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Blade Repair" }),
      });

      expect(res.status).toBe(409);
    });
  });

  describe("PATCH /admin/skills/:id", () => {
    it("updates a skill", async () => {
      (prisma.skill.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockSkill)
        .mockResolvedValueOnce(null);
      (prisma.skill.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockSkill,
        name: "Blade Repair Advanced",
      });

      const app = makeApp();
      const res = await app.request("/admin/skills/skill-001", {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Blade Repair Advanced" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("Blade Repair Advanced");
    });

    it("returns 404 for missing skill", async () => {
      (prisma.skill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/admin/skills/nope", {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "X" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /admin/skills/:id", () => {
    it("soft-deletes a skill", async () => {
      (prisma.skill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSkill);
      (prisma.skill.update as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockSkill, deleted_at: new Date() });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const app = makeApp();
      const res = await app.request("/admin/skills/skill-001", {
        method: "DELETE",
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.deleted).toBe(true);
      expect(prisma.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entity_type: "Skill",
            entity_id: "skill-001",
            action: "DELETE",
          }),
        })
      );
    });

    it("returns 404 for missing skill", async () => {
      (prisma.skill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/admin/skills/nope", {
        method: "DELETE",
        headers: authHeader,
      });

      expect(res.status).toBe(404);
    });
  });

  // ── Certifications CRUD ────────────────────────────────────────────────────

  describe("GET /admin/certifications", () => {
    it("returns paginated list of certifications", async () => {
      (prisma.certification.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockCert]);

      const app = makeApp();
      const res = await app.request("/admin/certifications", { headers: authHeader });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe("GWO Safety");
    });
  });

  describe("POST /admin/certifications", () => {
    it("creates a certification", async () => {
      (prisma.certification.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.certification.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockCert);

      const app = makeApp();
      const res = await app.request("/admin/certifications", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "GWO Safety", issuingBody: "GWO" }),
      });

      expect(res.status).toBe(201);
    });

    it("rejects duplicate name with 409", async () => {
      (prisma.certification.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockCert);

      const app = makeApp();
      const res = await app.request("/admin/certifications", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "GWO Safety" }),
      });

      expect(res.status).toBe(409);
    });
  });

  describe("PATCH /admin/certifications/:id", () => {
    it("updates a certification", async () => {
      (prisma.certification.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockCert)
        .mockResolvedValueOnce(null);
      (prisma.certification.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockCert,
        name: "GWO Safety Advanced",
      });

      const app = makeApp();
      const res = await app.request("/admin/certifications/cert-001", {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "GWO Safety Advanced" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("GWO Safety Advanced");
    });
  });

  describe("DELETE /admin/certifications/:id", () => {
    it("soft-deletes a certification", async () => {
      (prisma.certification.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockCert);
      (prisma.certification.update as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockCert, deleted_at: new Date() });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const app = makeApp();
      const res = await app.request("/admin/certifications/cert-001", {
        method: "DELETE",
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.deleted).toBe(true);
      expect(prisma.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entity_type: "Certification",
            entity_id: "cert-001",
            action: "DELETE",
          }),
        })
      );
    });

    it("returns 404 for missing certification", async () => {
      (prisma.certification.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/admin/certifications/nope", {
        method: "DELETE",
        headers: authHeader,
      });

      expect(res.status).toBe(404);
    });
  });

  // ── Workflow Rules (stub) ──────────────────────────────────────────────────

  describe("Workflow rules stub", () => {
    it("creates a workflow rule", async () => {
      const app = makeApp();
      const res = await app.request("/admin/workflow-rules", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Auto-assign", trigger: "ticket.created" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("Auto-assign");
      expect(body.isActive).toBe(true);
    });

    it("lists workflow rules", async () => {
      const app = makeApp();
      await app.request("/admin/workflow-rules", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test Rule", trigger: "test.trigger" }),
      });

      const res = await app.request("/admin/workflow-rules", { headers: authHeader });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("updates a workflow rule", async () => {
      const app = makeApp();
      const createRes = await app.request("/admin/workflow-rules", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test Rule", trigger: "test.trigger" }),
      });
      const created = await createRes.json();

      const res = await app.request(`/admin/workflow-rules/${created.id}`, {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Rule" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("Updated Rule");
    });

    it("deletes a workflow rule", async () => {
      const app = makeApp();
      const createRes = await app.request("/admin/workflow-rules", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "To Delete", trigger: "test.trigger" }),
      });
      const created = await createRes.json();

      const res = await app.request(`/admin/workflow-rules/${created.id}`, {
        method: "DELETE",
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.deleted).toBe(true);
    });

    it("returns 404 for missing rule on update", async () => {
      const app = makeApp();
      const res = await app.request("/admin/workflow-rules/nope", {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "X" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 for missing rule on delete", async () => {
      const app = makeApp();
      const res = await app.request("/admin/workflow-rules/nope", {
        method: "DELETE",
        headers: authHeader,
      });

      expect(res.status).toBe(404);
    });
  });
});
