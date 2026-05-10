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
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  deleted_at: null,
};

const mockSubsystem = {
  id: "sub-001",
  turbine_id: "turb-001",
  name: "Gearbox",
  type: "Drivetrain",
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  deleted_at: null,
};

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    site: { findFirst: vi.fn() },
    turbine: { findFirst: vi.fn() },
    subsystem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from "../../src/lib/prisma.js";
import subsystemRoutes from "../../src/routes/subsystems.js";

const authHeader = { Authorization: "Bearer test-token" };

function makeApp() {
  const app = new Hono();
  app.route(
    "/organizations/:orgId/sites/:siteId/turbines/:turbineId/subsystems",
    subsystemRoutes
  );
  return app;
}

const basePath =
  "/organizations/org-001/sites/site-001/turbines/turb-001/subsystems";

describe("Subsystem routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockParentChain() {
    (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSite);
    (prisma.turbine.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTurbine);
  }

  describe("GET /subsystems", () => {
    it("returns paginated list", async () => {
      mockParentChain();
      (prisma.subsystem.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockSubsystem]);

      const res = await makeApp().request(basePath, { headers: authHeader });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
    });

    it("returns 404 for missing turbine", async () => {
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSite);
      (prisma.turbine.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await makeApp().request(basePath, { headers: authHeader });
      expect(res.status).toBe(404);
    });

    it("rejects unauthenticated requests with 401", async () => {
      const res = await makeApp().request(basePath);
      expect(res.status).toBe(401);
    });
  });

  describe("POST /subsystems", () => {
    it("creates a subsystem", async () => {
      mockParentChain();
      (prisma.subsystem.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.subsystem.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubsystem);

      const res = await makeApp().request(basePath, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Gearbox", type: "Drivetrain" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("Gearbox");
    });

    it("rejects duplicate name with 409", async () => {
      mockParentChain();
      (prisma.subsystem.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubsystem);

      const res = await makeApp().request(basePath, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Gearbox" }),
      });

      expect(res.status).toBe(409);
    });

    it("rejects non-admin with 403", async () => {
      const { verifyAccessToken } = await import("../../src/utils/jwt.js");
      (verifyAccessToken as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        userId: "tech-001",
        email: "tech@test.com",
        role: "TECHNICIAN",
        organizationId: "org-001",
      });

      mockParentChain();
      const res = await makeApp().request(basePath, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Subsystem" }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /subsystems/:id", () => {
    it("returns a single subsystem", async () => {
      mockParentChain();
      (prisma.subsystem.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubsystem);

      const res = await makeApp().request(`${basePath}/sub-001`, { headers: authHeader });
      expect(res.status).toBe(200);
    });

    it("returns 404 for missing", async () => {
      mockParentChain();
      (prisma.subsystem.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await makeApp().request(`${basePath}/nope`, { headers: authHeader });
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /subsystems/:id", () => {
    it("updates a subsystem", async () => {
      mockParentChain();
      (prisma.subsystem.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockSubsystem)
        .mockResolvedValueOnce(null);
      (prisma.subsystem.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockSubsystem,
        name: "Gearbox Updated",
      });

      const res = await makeApp().request(`${basePath}/sub-001`, {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Gearbox Updated" }),
      });

      expect(res.status).toBe(200);
    });

    it("rejects duplicate name on update with 409", async () => {
      mockParentChain();
      (prisma.subsystem.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockSubsystem)
        .mockResolvedValueOnce({ ...mockSubsystem, id: "sub-002" });

      const res = await makeApp().request(`${basePath}/sub-001`, {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Taken" }),
      });

      expect(res.status).toBe(409);
    });
  });

  describe("DELETE /subsystems/:id", () => {
    it("soft deletes a subsystem", async () => {
      mockParentChain();
      (prisma.subsystem.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubsystem);
      (prisma.subsystem.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockSubsystem,
        deleted_at: new Date(),
      });

      const res = await makeApp().request(`${basePath}/sub-001`, {
        method: "DELETE",
        headers: authHeader,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.deleted).toBe(true);
    });
  });
});
