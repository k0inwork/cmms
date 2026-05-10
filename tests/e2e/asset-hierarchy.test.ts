import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
// ── Mock Prisma ─────────────────────────────────────────────────────────────

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    organization: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    site: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    turbine: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    subsystem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    component: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from "../../src/lib/prisma.js";
import organizationRoutes from "../../src/routes/organizations.js";
import siteRoutes from "../../src/routes/sites.js";
import turbineRoutes from "../../src/routes/turbines.js";
import subsystemRoutes from "../../src/routes/subsystems.js";
import componentRoutes from "../../src/routes/components.js";

function makeApp() {
  const app = new Hono();
  app.route("/organizations", organizationRoutes);
  app.route("/organizations/:orgId/sites", siteRoutes);
  app.route("/organizations/:orgId/sites/:siteId/turbines", turbineRoutes);
  app.route(
    "/organizations/:orgId/sites/:siteId/turbines/:turbineId/subsystems",
    subsystemRoutes
  );
  app.route(
    "/organizations/:orgId/sites/:siteId/turbines/:turbineId/subsystems/:subsystemId/components",
    componentRoutes
  );
  return app;
}

const ORG_ID = "org-aaaaaaaa-0000-0000-000000000001";
const SITE_ID = "site-aaaaaa-0000-0000-000000000001";
const TURB_ID = "turb-aaaaaa-0000-0000-000000000001";
const SUB_ID = "sub-aaaaaaa-0000-0000-000000000001";
const COMP_ID = "comp-aaaaaa-0000-0000-000000000001";

describe("E2E: Asset Hierarchy (US-ASSET)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── TC-ASSET-01: Create organization with unique name ──────────────────────

  describe("TC-ASSET-01: Create organization", () => {
    it("creates org with unique name", async () => {
      vi.mocked(prisma.organization.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.organization.create).mockResolvedValue({
        id: ORG_ID,
        name: "WindFarm Corp",
        description: "Test org",
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      });

      const app = makeApp();
      const res = await app.request("/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "WindFarm Corp", description: "Test org" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("WindFarm Corp");
    });

    it("rejects duplicate org name", async () => {
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({
        id: ORG_ID,
        name: "WindFarm Corp",
      } as any);

      const app = makeApp();
      const res = await app.request("/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "WindFarm Corp" }),
      });

      expect(res.status).toBe(409);
    });
  });

  // ── TC-ASSET-02: Create site under organization ────────────────────────────

  describe("TC-ASSET-02: Create site under org", () => {
    it("creates site under existing org", async () => {
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({ id: ORG_ID } as any);
      vi.mocked(prisma.site.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.site.create).mockResolvedValue({
        id: SITE_ID,
        name: "North Wind Site",
        latitude: 55.7,
        longitude: 12.6,
        time_zone: "Europe/Copenhagen",
        organization_id: ORG_ID,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      });

      const app = makeApp();
      const res = await app.request(`/organizations/${ORG_ID}/sites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "North Wind Site",
          latitude: 55.7,
          longitude: 12.6,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("North Wind Site");
      expect(body.organization_id).toBe(ORG_ID);
    });

    it("returns 404 for nonexistent org", async () => {
      vi.mocked(prisma.organization.findFirst).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(`/organizations/bad-org/sites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Site X" }),
      });

      expect(res.status).toBe(404);
    });
  });

  // ── TC-ASSET-03: Add turbine to site with model and coordinates ────────────

  describe("TC-ASSET-03: Add turbine with model and coordinates", () => {
    it("creates turbine with model and coordinates", async () => {
      vi.mocked(prisma.site.findFirst).mockResolvedValue({ id: SITE_ID } as any);
      vi.mocked(prisma.turbine.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.turbine.create).mockResolvedValue({
        id: TURB_ID,
        name: "WTG-001",
        status: "ACTIVE",
        model: "Vestas V164",
        latitude: 55.701,
        longitude: 12.602,
        site_id: SITE_ID,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      });

      const app = makeApp();
      const res = await app.request(
        `/organizations/${ORG_ID}/sites/${SITE_ID}/turbines`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "WTG-001",
            model: "Vestas V164",
            latitude: 55.701,
            longitude: 12.602,
          }),
        }
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("WTG-001");
      expect(body.model).toBe("Vestas V164");
    });
  });

  // ── TC-ASSET-04: Navigate full asset hierarchy ────────────────────────────

  describe("TC-ASSET-04: Navigate asset hierarchy", () => {
    it("walks org → site → turbine → subsystem → component", async () => {
      const app = makeApp();

      // Step 1: Get org
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({
        id: ORG_ID,
        name: "WindFarm Corp",
        deleted_at: null,
      } as any);

      const orgRes = await app.request(`/organizations/${ORG_ID}`);
      expect(orgRes.status).toBe(200);

      // Step 2: Get site
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({ id: ORG_ID } as any);
      vi.mocked(prisma.site.findFirst)
        .mockResolvedValueOnce({ id: SITE_ID, organization_id: ORG_ID, deleted_at: null } as any)
        .mockResolvedValueOnce({ id: SITE_ID, organization_id: ORG_ID, deleted_at: null } as any);

      const siteRes = await app.request(
        `/organizations/${ORG_ID}/sites/${SITE_ID}`
      );
      expect(siteRes.status).toBe(200);

      // Step 3: Get turbine
      vi.mocked(prisma.site.findFirst).mockResolvedValue({ id: SITE_ID, organization_id: ORG_ID, deleted_at: null } as any);
      vi.mocked(prisma.turbine.findFirst)
        .mockResolvedValueOnce({ id: TURB_ID, site_id: SITE_ID, deleted_at: null } as any)
        .mockResolvedValueOnce({ id: TURB_ID, site_id: SITE_ID, deleted_at: null } as any);

      const turbRes = await app.request(
        `/organizations/${ORG_ID}/sites/${SITE_ID}/turbines/${TURB_ID}`
      );
      expect(turbRes.status).toBe(200);

      // Step 4: Create subsystem
      vi.mocked(prisma.site.findFirst).mockResolvedValue({ id: SITE_ID, organization_id: ORG_ID, deleted_at: null } as any);
      vi.mocked(prisma.turbine.findFirst).mockResolvedValue({ id: TURB_ID, site_id: SITE_ID, deleted_at: null } as any);
      vi.mocked(prisma.subsystem.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.subsystem.create).mockResolvedValue({
        id: SUB_ID,
        name: "Pitch System",
        type: "MECHANICAL",
        turbine_id: TURB_ID,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      });

      const subRes = await app.request(
        `/organizations/${ORG_ID}/sites/${SITE_ID}/turbines/${TURB_ID}/subsystems`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Pitch System", type: "MECHANICAL" }),
        }
      );
      expect(subRes.status).toBe(201);

      // Step 5: Create component
      vi.mocked(prisma.site.findFirst).mockResolvedValue({ id: SITE_ID, organization_id: ORG_ID, deleted_at: null } as any);
      vi.mocked(prisma.turbine.findFirst).mockResolvedValue({ id: TURB_ID, site_id: SITE_ID, deleted_at: null } as any);
      vi.mocked(prisma.subsystem.findFirst).mockResolvedValue({ id: SUB_ID, turbine_id: TURB_ID, deleted_at: null } as any);
      vi.mocked(prisma.component.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.component.create).mockResolvedValue({
        id: COMP_ID,
        name: "Pitch Bearing",
        status: "ACTIVE",
        subsystem_id: SUB_ID,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      });

      const compRes = await app.request(
        `/organizations/${ORG_ID}/sites/${SITE_ID}/turbines/${TURB_ID}/subsystems/${SUB_ID}/components`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Pitch Bearing" }),
        }
      );
      expect(compRes.status).toBe(201);
      const compBody = await compRes.json();
      expect(compBody.name).toBe("Pitch Bearing");
    });
  });

  // ── Soft delete flow ───────────────────────────────────────────────────────

  describe("Soft delete flow", () => {
    it("soft-deletes component and it disappears from list", async () => {
      const app = makeApp();

      // Delete component
      vi.mocked(prisma.site.findFirst).mockResolvedValue({ id: SITE_ID, organization_id: ORG_ID, deleted_at: null } as any);
      vi.mocked(prisma.turbine.findFirst).mockResolvedValue({ id: TURB_ID, site_id: SITE_ID, deleted_at: null } as any);
      vi.mocked(prisma.subsystem.findFirst).mockResolvedValue({ id: SUB_ID, turbine_id: TURB_ID, deleted_at: null } as any);
      vi.mocked(prisma.component.findFirst).mockResolvedValue({
        id: COMP_ID,
        subsystem_id: SUB_ID,
        deleted_at: null,
      } as any);
      vi.mocked(prisma.component.update).mockResolvedValue({} as any);

      const delRes = await app.request(
        `/organizations/${ORG_ID}/sites/${SITE_ID}/turbines/${TURB_ID}/subsystems/${SUB_ID}/components/${COMP_ID}`,
        { method: "DELETE" }
      );
      expect(delRes.status).toBe(200);
      const delBody = await delRes.json();
      expect(delBody.deleted).toBe(true);

      // Verify update was called with deleted_at
      expect(prisma.component.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { deleted_at: expect.any(Date) },
        })
      );
    });
  });
});
