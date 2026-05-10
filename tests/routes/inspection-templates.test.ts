import { describe, it, expect, vi, beforeEach } from "vitest";
import { signAccessToken } from "../../src/utils/jwt.js";

// ── Mock Prisma ─────────────────────────────────────────────────────────────

const mockTemplate = {
  id: "tpl-001",
  name: "Blade Inspection",
  description: "Standard blade inspection checklist",
  inspection_type: "ROUTINE",
  turbine_model: "Vestas V164",
  site_id: null,
  is_active: true,
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  deleted_at: null,
  versions: [
    {
      id: "ver-001",
      template_id: "tpl-001",
      version: 1,
      schema: [
        { key: "blade_condition", label: "Blade Condition", type: "TEXT", required: true },
      ],
      changelog: "Initial version",
      created_at: new Date("2026-01-01"),
      created_by: "user-admin",
    },
  ],
};

const mockVersion = {
  id: "ver-002",
  template_id: "tpl-001",
  version: 2,
  schema: [
    { key: "blade_condition", label: "Blade Condition", type: "TEXT", required: true },
    { key: "crack_detected", label: "Crack Detected", type: "PASS_FAIL", required: true },
  ],
  changelog: "Added crack detection",
  created_at: new Date("2026-01-02"),
  created_by: "user-admin",
};

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    inspectionTemplate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    inspectionTemplateVersion: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { Hono } from "hono";
import prisma from "../../src/lib/prisma.js";
import inspectionTemplateRoutes from "../../src/routes/inspection-templates.js";

function makeApp() {
  const app = new Hono();
  app.route("/templates", inspectionTemplateRoutes);
  return app;
}

function adminToken() {
  return signAccessToken({
    userId: "user-admin",
    email: "admin@test.com",
    role: "ADMINISTRATOR",
    organizationId: "org-001",
  });
}

function techToken() {
  return signAccessToken({
    userId: "user-tech",
    email: "tech@test.com",
    role: "TECHNICIAN",
    organizationId: "org-001",
  });
}

const validFields = [
  { key: "blade_condition", label: "Blade Condition", type: "TEXT", required: true },
];

describe("Inspection Template routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /templates ────────────────────────────────────────────────────────

  describe("GET /templates", () => {
    it("returns paginated list of templates", async () => {
      (prisma.inspectionTemplate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        mockTemplate,
      ]);

      const app = makeApp();
      const res = await app.request("/templates");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe("Blade Inspection");
      expect(body.pagination).toBeDefined();
    });

    it("respects limit query param", async () => {
      (prisma.inspectionTemplate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        mockTemplate,
      ]);

      const app = makeApp();
      const res = await app.request("/templates?limit=1");
      expect(res.status).toBe(200);

      expect(prisma.inspectionTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 2 })
      );
    });
  });

  // ── GET /templates/:id ────────────────────────────────────────────────────

  describe("GET /templates/:id", () => {
    it("returns a single template with latest version", async () => {
      (prisma.inspectionTemplate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate
      );

      const app = makeApp();
      const res = await app.request("/templates/tpl-001");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("tpl-001");
      expect(body.versions).toHaveLength(1);
    });

    it("returns 404 for missing template", async () => {
      (prisma.inspectionTemplate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/templates/nope");

      expect(res.status).toBe(404);
    });
  });

  // ── POST /templates ───────────────────────────────────────────────────────

  describe("POST /templates", () => {
    it("creates a template with initial version (admin)", async () => {
      (prisma.inspectionTemplate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.inspectionTemplate.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate
      );

      const app = makeApp();
      const res = await app.request("/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken()}`,
        },
        body: JSON.stringify({
          name: "Blade Inspection",
          fields: validFields,
          changelog: "Initial version",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("Blade Inspection");

      expect(prisma.inspectionTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Blade Inspection",
            versions: expect.objectContaining({ create: expect.any(Object) }),
          }),
        })
      );
    });

    it("rejects duplicate name with 409", async () => {
      (prisma.inspectionTemplate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate
      );

      const app = makeApp();
      const res = await app.request("/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken()}`,
        },
        body: JSON.stringify({ name: "Blade Inspection", fields: validFields }),
      });

      expect(res.status).toBe(409);
    });

    it("rejects empty name with 400", async () => {
      const app = makeApp();
      const res = await app.request("/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken()}`,
        },
        body: JSON.stringify({ name: "", fields: validFields }),
      });

      expect(res.status).toBe(400);
    });

    it("rejects empty fields array with 400", async () => {
      const app = makeApp();
      const res = await app.request("/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken()}`,
        },
        body: JSON.stringify({ name: "Test", fields: [] }),
      });

      expect(res.status).toBe(400);
    });

    it("rejects invalid field type with 400", async () => {
      const app = makeApp();
      const res = await app.request("/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken()}`,
        },
        body: JSON.stringify({
          name: "Test",
          fields: [{ key: "f1", label: "F1", type: "INVALID", required: true }],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("rejects non-admin with 403", async () => {
      const app = makeApp();
      const res = await app.request("/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${techToken()}`,
        },
        body: JSON.stringify({ name: "Test", fields: validFields }),
      });

      expect(res.status).toBe(403);
    });

    it("rejects unauthenticated with 401", async () => {
      const app = makeApp();
      const res = await app.request("/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test", fields: validFields }),
      });

      expect(res.status).toBe(401);
    });
  });

  // ── PATCH /templates/:id ──────────────────────────────────────────────────

  describe("PATCH /templates/:id", () => {
    it("updates template metadata (admin)", async () => {
      const updated = { ...mockTemplate, name: "Updated Inspection" };
      (prisma.inspectionTemplate.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(null);
      (prisma.inspectionTemplate.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const app = makeApp();
      const res = await app.request("/templates/tpl-001", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken()}`,
        },
        body: JSON.stringify({ name: "Updated Inspection" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("Updated Inspection");
    });

    it("returns 404 for missing template", async () => {
      (prisma.inspectionTemplate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/templates/nope", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken()}`,
        },
        body: JSON.stringify({ name: "X" }),
      });

      expect(res.status).toBe(404);
    });

    it("rejects duplicate name on update with 409", async () => {
      (prisma.inspectionTemplate.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce({ ...mockTemplate, id: "tpl-002" });

      const app = makeApp();
      const res = await app.request("/templates/tpl-001", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken()}`,
        },
        body: JSON.stringify({ name: "Taken Name" }),
      });

      expect(res.status).toBe(409);
    });

    it("rejects non-admin with 403", async () => {
      const app = makeApp();
      const res = await app.request("/templates/tpl-001", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${techToken()}`,
        },
        body: JSON.stringify({ name: "X" }),
      });

      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /templates/:id ─────────────────────────────────────────────────

  describe("DELETE /templates/:id", () => {
    it("soft deletes a template (admin)", async () => {
      (prisma.inspectionTemplate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate
      );
      (prisma.inspectionTemplate.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockTemplate,
        deleted_at: new Date(),
        is_active: false,
      });

      const app = makeApp();
      const res = await app.request("/templates/tpl-001", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken()}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.deleted).toBe(true);

      expect(prisma.inspectionTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "tpl-001" },
          data: expect.objectContaining({ deleted_at: expect.any(Date), is_active: false }),
        })
      );
    });

    it("returns 404 for missing template", async () => {
      (prisma.inspectionTemplate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/templates/nope", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken()}` },
      });

      expect(res.status).toBe(404);
    });

    it("rejects non-admin with 403", async () => {
      const app = makeApp();
      const res = await app.request("/templates/tpl-001", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${techToken()}` },
      });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /templates/:id/versions ───────────────────────────────────────────

  describe("GET /templates/:id/versions", () => {
    it("returns paginated versions", async () => {
      (prisma.inspectionTemplate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate
      );
      (prisma.inspectionTemplateVersion.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        mockTemplate.versions[0],
      ]);

      const app = makeApp();
      const res = await app.request("/templates/tpl-001/versions");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
    });

    it("returns 404 for missing template", async () => {
      (prisma.inspectionTemplate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/templates/nope/versions");

      expect(res.status).toBe(404);
    });
  });

  // ── POST /templates/:id/versions ──────────────────────────────────────────

  describe("POST /templates/:id/versions", () => {
    it("creates a new version (admin)", async () => {
      (prisma.inspectionTemplate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate
      );
      (prisma.inspectionTemplateVersion.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        version: 1,
      });
      (prisma.inspectionTemplateVersion.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockVersion
      );

      const newFields = [
        { key: "blade_condition", label: "Blade Condition", type: "TEXT", required: true },
        { key: "crack_detected", label: "Crack Detected", type: "PASS_FAIL", required: true },
      ];

      const app = makeApp();
      const res = await app.request("/templates/tpl-001/versions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken()}`,
        },
        body: JSON.stringify({ fields: newFields, changelog: "Added crack detection" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.version).toBe(2);

      expect(prisma.inspectionTemplateVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            template_id: "tpl-001",
            version: 2,
            created_by: "user-admin",
          }),
        })
      );
    });

    it("returns 404 for missing template", async () => {
      (prisma.inspectionTemplate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/templates/nope/versions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken()}`,
        },
        body: JSON.stringify({ fields: validFields }),
      });

      expect(res.status).toBe(404);
    });

    it("rejects non-admin with 403", async () => {
      const app = makeApp();
      const res = await app.request("/templates/tpl-001/versions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${techToken()}`,
        },
        body: JSON.stringify({ fields: validFields }),
      });

      expect(res.status).toBe(403);
    });

    it("rejects unauthenticated with 401", async () => {
      const app = makeApp();
      const res = await app.request("/templates/tpl-001/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: validFields }),
      });

      expect(res.status).toBe(401);
    });
  });
});
