import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Hono } from "hono";
import prisma from "./helpers/db.js";
import { cleanDatabase } from "./helpers/db.js";
import siteRoutes from "../../../src/routes/sites.js";
import { createOrg } from "./helpers/fixtures.js";

function makeApp() {
  const app = new Hono();
  app.route("/organizations/:orgId/sites", siteRoutes);
  return app;
}

describe("Site routes (integration)", () => {
  let orgId: string;

  beforeAll(async () => {
    await cleanDatabase();
    const org = await createOrg("Site Test Org");
    orgId = org.id;
  });

  afterEach(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "sites" CASCADE`);
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it("POST creates a site under an org", async () => {
    const app = makeApp();
    const res = await app.request(`/organizations/${orgId}/sites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "North Sea Alpha", latitude: 57.5, longitude: 3.2 }),
    });
    expect(res.status).toBe(201);
    const site = await res.json();
    expect(site.name).toBe("North Sea Alpha");
    expect(site.latitude).toBe(57.5);
    expect(site.organization_id).toBe(orgId);
  });

  it("POST rejects duplicate site name within same org", async () => {
    const app = makeApp();
    await app.request(`/organizations/${orgId}/sites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dup Site" }),
    });
    const res = await app.request(`/organizations/${orgId}/sites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dup Site" }),
    });
    expect(res.status).toBe(409);
  });

  it("POST returns 404 for non-existent org", async () => {
    const app = makeApp();
    const res = await app.request(`/organizations/${crypto.randomUUID()}/sites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ghost Site" }),
    });
    expect(res.status).toBe(404);
  });

  it("GET lists sites for org with pagination", async () => {
    const app = makeApp();
    for (let i = 0; i < 3; i++) {
      await app.request(`/organizations/${orgId}/sites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Site ${i}` }),
      });
    }

    const res = await app.request(`/organizations/${orgId}/sites?limit=2`);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.pagination.has_more).toBe(true);
  });

  it("PATCH updates a site", async () => {
    const app = makeApp();
    const createRes = await app.request(`/organizations/${orgId}/sites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updatable Site" }),
    });
    const { id } = await createRes.json();

    const patchRes = await app.request(`/organizations/${orgId}/sites/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Site" }),
    });
    expect(patchRes.status).toBe(200);
    expect((await patchRes.json()).name).toBe("Updated Site");
  });

  it("DELETE soft-deletes a site", async () => {
    const app = makeApp();
    const createRes = await app.request(`/organizations/${orgId}/sites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Deletable Site" }),
    });
    const { id } = await createRes.json();

    const delRes = await app.request(`/organizations/${orgId}/sites/${id}`, { method: "DELETE" });
    expect(delRes.status).toBe(200);

    const getRes = await app.request(`/organizations/${orgId}/sites/${id}`);
    expect(getRes.status).toBe(404);
  });
});
