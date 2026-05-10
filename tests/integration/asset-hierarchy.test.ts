import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Hono } from "hono";
import prisma from "./helpers/db.js";
import { cleanDatabase } from "./helpers/db.js";
import { createFullHierarchy } from "./helpers/fixtures.js";
import turbineRoutes from "../../../src/routes/turbines.js";
import subsystemRoutes from "../../../src/routes/subsystems.js";
import componentRoutes from "../../../src/routes/components.js";

function makeTurbineApp() {
  const app = new Hono();
  app.route("/organizations/:orgId/sites/:siteId/turbines", turbineRoutes);
  return app;
}

function makeSubsystemApp() {
  const app = new Hono();
  app.route("/organizations/:orgId/sites/:siteId/turbines/:turbineId/subsystems", subsystemRoutes);
  return app;
}

function makeComponentApp() {
  const app = new Hono();
  app.route(
    "/organizations/:orgId/sites/:siteId/turbines/:turbineId/subsystems/:subsystemId/components",
    componentRoutes,
  );
  return app;
}

describe("Asset hierarchy routes (integration)", () => {
  let h: Awaited<ReturnType<typeof createFullHierarchy>>;

  beforeAll(async () => {
    await cleanDatabase();
    h = await createFullHierarchy();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  // ── Turbines ──────────────────────────────────────────────────────────────

  describe("Turbines", () => {
    it("POST creates a turbine under a site", async () => {
      const app = makeTurbineApp();
      const res = await app.request(`/organizations/${h.org.id}/sites/${h.site.id}/turbines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "WTG-001" }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("WTG-001");
    });

    it("GET lists turbines for a site", async () => {
      const app = makeTurbineApp();
      const res = await app.request(`/organizations/${h.org.id}/sites/${h.site.id}/turbines`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("GET :id returns a turbine", async () => {
      const app = makeTurbineApp();
      const res = await app.request(
        `/organizations/${h.org.id}/sites/${h.site.id}/turbines/${h.turbine.id}`,
      );
      expect(res.status).toBe(200);
      expect((await res.json()).name).toBe(h.turbine.name);
    });

    it("returns 404 for turbine in wrong org/site", async () => {
      const app = makeTurbineApp();
      const res = await app.request(
        `/organizations/${crypto.randomUUID()}/sites/${h.site.id}/turbines/${h.turbine.id}`,
      );
      expect(res.status).toBe(404);
    });
  });

  // ── Subsystems ────────────────────────────────────────────────────────────

  describe("Subsystems", () => {
    it("POST creates a subsystem under a turbine", async () => {
      const app = makeSubsystemApp();
      const res = await app.request(
        `/organizations/${h.org.id}/sites/${h.site.id}/turbines/${h.turbine.id}/subsystems`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Gearbox", type: "Drivetrain" }),
        },
      );
      expect(res.status).toBe(201);
      expect((await res.json()).name).toBe("Gearbox");
    });

    it("GET lists subsystems", async () => {
      const app = makeSubsystemApp();
      const res = await app.request(
        `/organizations/${h.org.id}/sites/${h.site.id}/turbines/${h.turbine.id}/subsystems`,
      );
      expect(res.status).toBe(200);
      expect((await res.json()).data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Components ────────────────────────────────────────────────────────────

  describe("Components", () => {
    it("POST creates a component under a subsystem", async () => {
      const app = makeComponentApp();
      const res = await app.request(
        `/organizations/${h.org.id}/sites/${h.site.id}/turbines/${h.turbine.id}/subsystems/${h.subsystem.id}/components`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Main Bearing" }),
        },
      );
      expect(res.status).toBe(201);
      expect((await res.json()).name).toBe("Main Bearing");
    });

    it("GET lists components for a subsystem", async () => {
      const app = makeComponentApp();
      const res = await app.request(
        `/organizations/${h.org.id}/sites/${h.site.id}/turbines/${h.turbine.id}/subsystems/${h.subsystem.id}/components`,
      );
      expect(res.status).toBe(200);
      expect((await res.json()).data.length).toBeGreaterThanOrEqual(1);
    });

    it("PATCH updates a component", async () => {
      const app = makeComponentApp();
      const res = await app.request(
        `/organizations/${h.org.id}/sites/${h.site.id}/turbines/${h.turbine.id}/subsystems/${h.subsystem.id}/components/${h.component.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Main Bearing Updated" }),
        },
      );
      expect(res.status).toBe(200);
      expect((await res.json()).name).toBe("Main Bearing Updated");
    });
  });
});
