import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

const mockSite = {
  id: "site-001",
  organization_id: "org-001",
  name: "North Sea Site",
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  deleted_at: null,
};

const mockTurbine = {
  id: "turb-001",
  site_id: "site-001",
  name: "WTG-01",
  status: "ACTIVE",
  model: "Vestas V164",
  latitude: 55.0,
  longitude: 1.0,
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  deleted_at: null,
};

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    site: {
      findFirst: vi.fn(),
    },
    turbine: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from "../../src/lib/prisma.js";
import turbineRoutes from "../../src/routes/turbines.js";

const authHeader = { Authorization: "Bearer test-token" };

function makeApp() {
  const app = new Hono();
  app.route("/organizations/:orgId/sites/:siteId/turbines", turbineRoutes);
  return app;
}

const basePath = "/organizations/org-001/sites/site-001/turbines";

describe("Turbine routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /turbines ────────────────────────────────────────────────────────

  describe("GET /turbines", () => {
    it("returns paginated list of turbines", async () => {
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSite);
      (prisma.turbine.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockTurbine]);

      const app = makeApp();
      const res = await app.request(basePath, { headers: authHeader });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe("WTG-01");
      expect(body.pagination).toBeDefined();
    });

    it("returns 404 for missing site", async () => {
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(basePath, { headers: authHeader });
      expect(res.status).toBe(404);
    });

    it("rejects unauthenticated requests with 401", async () => {
      const app = makeApp();
      const res = await app.request(basePath);
      expect(res.status).toBe(401);
    });
  });

  // ── POST /turbines ──────────────────────────────────────────────────────

  describe("POST /turbines", () => {
    it("creates a turbine", async () => {
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSite);
      (prisma.turbine.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.turbine.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockTurbine);

      const app = makeApp();
      const res = await app.request(basePath, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "WTG-01", model: "Vestas V164" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("WTG-01");
    });

    it("rejects duplicate name with 409", async () => {
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSite);
      (prisma.turbine.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTurbine);

      const app = makeApp();
      const res = await app.request(basePath, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "WTG-01" }),
      });

      expect(res.status).toBe(409);
    });

    it("rejects invalid turbine name", async () => {
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSite);

      const app = makeApp();
      const res = await app.request(basePath, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "@invalid!" }),
      });

      expect(res.status).toBe(400);
    });

    it("rejects non-admin with 403", async () => {
      const { verifyAccessToken } = await import("../../src/utils/jwt.js");
      (verifyAccessToken as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        userId: "tech-001",
        email: "tech@test.com",
        role: "TECHNICIAN",
        organizationId: "org-001",
      });

      const app = makeApp();
      const res = await app.request(basePath, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "WTG-NEW" }),
      });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /turbines/:id ───────────────────────────────────────────────────

  describe("GET /turbines/:id", () => {
    it("returns a single turbine", async () => {
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSite);
      (prisma.turbine.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTurbine);

      const app = makeApp();
      const res = await app.request(`${basePath}/turb-001`, { headers: authHeader });
      expect(res.status).toBe(200);
    });

    it("returns 404 for missing turbine", async () => {
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSite);
      (prisma.turbine.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(`${basePath}/nope`, { headers: authHeader });
      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /turbines/:id ─────────────────────────────────────────────────

  describe("PATCH /turbines/:id", () => {
    it("updates a turbine", async () => {
      const updated = { ...mockTurbine, name: "WTG-01 Updated" };
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSite);
      (prisma.turbine.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockTurbine)
        .mockResolvedValueOnce(null);
      (prisma.turbine.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const app = makeApp();
      const res = await app.request(`${basePath}/turb-001`, {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "WTG-01 Updated" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("WTG-01 Updated");
    });

    it("returns 404 for missing turbine", async () => {
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSite);
      (prisma.turbine.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(`${basePath}/nope`, {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "X" }),
      });

      expect(res.status).toBe(404);
    });

    it("rejects duplicate name on update with 409", async () => {
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSite);
      (prisma.turbine.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockTurbine)
        .mockResolvedValueOnce({ ...mockTurbine, id: "turb-002" });

      const app = makeApp();
      const res = await app.request(`${basePath}/turb-001`, {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Taken Name" }),
      });

      expect(res.status).toBe(409);
    });
  });

  // ── DELETE /turbines/:id ────────────────────────────────────────────────

  describe("DELETE /turbines/:id", () => {
    it("soft deletes a turbine", async () => {
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSite);
      (prisma.turbine.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTurbine);
      (prisma.turbine.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockTurbine,
        deleted_at: new Date(),
      });

      const app = makeApp();
      const res = await app.request(`${basePath}/turb-001`, {
        method: "DELETE",
        headers: authHeader,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.deleted).toBe(true);
    });

    it("returns 404 for missing turbine", async () => {
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSite);
      (prisma.turbine.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(`${basePath}/nope`, {
        method: "DELETE",
        headers: authHeader,
      });
      expect(res.status).toBe(404);
    });
  });
});
