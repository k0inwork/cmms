import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

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

const mockComponent = {
  id: "comp-001",
  subsystem_id: "sub-001",
  name: "Main Bearing",
  status: "ACTIVE",
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  deleted_at: null,
};

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    site: { findFirst: vi.fn() },
    turbine: { findFirst: vi.fn() },
    subsystem: { findFirst: vi.fn() },
    component: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from "../../src/lib/prisma.js";
import componentRoutes from "../../src/routes/components.js";

function makeApp() {
  const app = new Hono();
  app.route(
    "/organizations/:orgId/sites/:siteId/turbines/:turbineId/subsystems/:subsystemId/components",
    componentRoutes
  );
  return app;
}

const basePath =
  "/organizations/org-001/sites/site-001/turbines/turb-001/subsystems/sub-001/components";

describe("Component routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockParentChain() {
    (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSite);
    (prisma.turbine.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTurbine);
    (prisma.subsystem.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubsystem);
  }

  describe("GET /components", () => {
    it("returns paginated list", async () => {
      mockParentChain();
      (prisma.component.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockComponent]);

      const res = await makeApp().request(basePath);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
    });

    it("returns 404 for missing subsystem", async () => {
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSite);
      (prisma.turbine.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTurbine);
      (prisma.subsystem.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await makeApp().request(basePath);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /components", () => {
    it("creates a component", async () => {
      mockParentChain();
      (prisma.component.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.component.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockComponent);

      const res = await makeApp().request(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Main Bearing", status: "ACTIVE" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("Main Bearing");
    });

    it("rejects duplicate name with 409", async () => {
      mockParentChain();
      (prisma.component.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockComponent);

      const res = await makeApp().request(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Main Bearing" }),
      });

      expect(res.status).toBe(409);
    });
  });

  describe("GET /components/:id", () => {
    it("returns a single component", async () => {
      mockParentChain();
      (prisma.component.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockComponent);

      const res = await makeApp().request(`${basePath}/comp-001`);
      expect(res.status).toBe(200);
    });

    it("returns 404 for missing", async () => {
      mockParentChain();
      (prisma.component.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await makeApp().request(`${basePath}/nope`);
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /components/:id", () => {
    it("updates a component", async () => {
      mockParentChain();
      (prisma.component.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockComponent)
        .mockResolvedValueOnce(null);
      (prisma.component.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockComponent,
        name: "Main Bearing Updated",
      });

      const res = await makeApp().request(`${basePath}/comp-001`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Main Bearing Updated" }),
      });

      expect(res.status).toBe(200);
    });

    it("rejects duplicate name on update with 409", async () => {
      mockParentChain();
      (prisma.component.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockComponent)
        .mockResolvedValueOnce({ ...mockComponent, id: "comp-002" });

      const res = await makeApp().request(`${basePath}/comp-001`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Taken" }),
      });

      expect(res.status).toBe(409);
    });
  });

  describe("DELETE /components/:id", () => {
    it("soft deletes a component", async () => {
      mockParentChain();
      (prisma.component.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockComponent);
      (prisma.component.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockComponent,
        deleted_at: new Date(),
      });

      const res = await makeApp().request(`${basePath}/comp-001`, { method: "DELETE" });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.deleted).toBe(true);
    });
  });
});
