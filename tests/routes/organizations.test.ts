import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Prisma ─────────────────────────────────────────────────────────────

const mockOrg = {
  id: "org-001",
  name: "North Sea Wind Corp",
  description: "Offshore wind energy",
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  deleted_at: null,
};

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    organization: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { Hono } from "hono";
import prisma from "../../src/lib/prisma.js";
import organizationRoutes from "../../src/routes/organizations.js";

function makeApp() {
  const app = new Hono();
  app.route("/organizations", organizationRoutes);
  return app;
}

describe("Organization routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /organizations ──────────────────────────────────────────────────

  describe("GET /organizations", () => {
    it("returns paginated list of organizations", async () => {
      (prisma.organization.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockOrg]);

      const app = makeApp();
      const res = await app.request("/organizations");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe("North Sea Wind Corp");
      expect(body.pagination).toBeDefined();
    });

    it("respects limit query param", async () => {
      (prisma.organization.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockOrg]);

      const app = makeApp();
      const res = await app.request("/organizations?limit=1");
      expect(res.status).toBe(200);

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 2 })
      );
    });
  });

  // ── POST /organizations ─────────────────────────────────────────────────

  describe("POST /organizations", () => {
    it("creates an organization", async () => {
      (prisma.organization.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.organization.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockOrg);

      const app = makeApp();
      const res = await app.request("/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "North Sea Wind Corp", description: "Offshore wind energy" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("North Sea Wind Corp");
    });

    it("rejects duplicate name with 409", async () => {
      (prisma.organization.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockOrg);

      const app = makeApp();
      const res = await app.request("/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "North Sea Wind Corp" }),
      });

      expect(res.status).toBe(409);
    });

    it("rejects empty name with 400", async () => {
      const app = makeApp();
      const res = await app.request("/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /organizations/:id ──────────────────────────────────────────────

  describe("GET /organizations/:id", () => {
    it("returns a single organization", async () => {
      (prisma.organization.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockOrg);

      const app = makeApp();
      const res = await app.request("/organizations/org-001");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("org-001");
    });

    it("returns 404 for missing org", async () => {
      (prisma.organization.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/organizations/nope");

      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /organizations/:id ────────────────────────────────────────────

  describe("PATCH /organizations/:id", () => {
    it("updates an organization", async () => {
      const updated = { ...mockOrg, name: "North Sea Wind Corp Updated" };
      (prisma.organization.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockOrg) // existence check
        .mockResolvedValueOnce(null); // no duplicate name
      (prisma.organization.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const app = makeApp();
      const res = await app.request("/organizations/org-001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "North Sea Wind Corp Updated" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("North Sea Wind Corp Updated");
    });

    it("returns 404 for missing org", async () => {
      (prisma.organization.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/organizations/nope", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "X" }),
      });

      expect(res.status).toBe(404);
    });

    it("rejects duplicate name on update with 409", async () => {
      (prisma.organization.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockOrg)
        .mockResolvedValueOnce({ ...mockOrg, id: "org-002" });

      const app = makeApp();
      const res = await app.request("/organizations/org-001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Taken Name" }),
      });

      expect(res.status).toBe(409);
    });
  });

  // ── DELETE /organizations/:id ───────────────────────────────────────────

  describe("DELETE /organizations/:id", () => {
    it("soft deletes an organization", async () => {
      (prisma.organization.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockOrg);
      (prisma.organization.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockOrg,
        deleted_at: new Date(),
      });

      const app = makeApp();
      const res = await app.request("/organizations/org-001", { method: "DELETE" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.deleted).toBe(true);

      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "org-001" },
          data: expect.objectContaining({ deleted_at: expect.any(Date) }),
        })
      );
    });

    it("returns 404 for missing org", async () => {
      (prisma.organization.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/organizations/nope", { method: "DELETE" });

      expect(res.status).toBe(404);
    });
  });
});
