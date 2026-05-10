import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Hono } from "hono";
import prisma from "./helpers/db.js";
import { cleanDatabase } from "./helpers/db.js";
import organizationRoutes from "../../../src/routes/organizations.js";

function makeApp() {
  const app = new Hono();
  app.route("/organizations", organizationRoutes);
  return app;
}

describe("Organization routes (integration)", () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("POST /organizations creates and GET returns it", async () => {
    const app = makeApp();
    const res = await app.request("/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Integration Org", description: "Test" }),
    });
    expect(res.status).toBe(201);
    const org = await res.json();
    expect(org.name).toBe("Integration Org");
    expect(org.id).toBeDefined();

    const getRes = await app.request(`/organizations/${org.id}`);
    expect(getRes.status).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.name).toBe("Integration Org");
  });

  it("POST rejects duplicate name with 409", async () => {
    const app = makeApp();
    await app.request("/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dup Org" }),
    });

    const res = await app.request("/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dup Org" }),
    });
    expect(res.status).toBe(409);
  });

  it("GET /organizations returns paginated list", async () => {
    const app = makeApp();
    for (let i = 0; i < 3; i++) {
      await app.request("/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Page Org ${i}` }),
      });
    }

    const res = await app.request("/organizations?limit=2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.pagination.has_more).toBe(true);
    expect(body.pagination.next_cursor).toBeDefined();
  });

  it("GET /organizations cursor pagination works", async () => {
    const app = makeApp();
    for (let i = 0; i < 5; i++) {
      await app.request("/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Cursor Org ${i}` }),
      });
    }

    const page1 = await (await app.request("/organizations?limit=2")).json();
    expect(page1.data).toHaveLength(2);
    expect(page1.pagination.has_more).toBe(true);

    const page2 = await (await app.request(`/organizations?limit=2&cursor=${page1.pagination.next_cursor}`)).json();
    expect(page2.data).toHaveLength(2);
    expect(page2.data[0].id).not.toBe(page1.data[0].id);
  });

  it("PATCH updates organization", async () => {
    const app = makeApp();
    const createRes = await app.request("/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Before Update" }),
    });
    const { id } = await createRes.json();

    const patchRes = await app.request(`/organizations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "After Update" }),
    });
    expect(patchRes.status).toBe(200);
    const updated = await patchRes.json();
    expect(updated.name).toBe("After Update");
  });

  it("DELETE soft-deletes and hides from list", async () => {
    const app = makeApp();
    const createRes = await app.request("/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "To Delete" }),
    });
    const { id } = await createRes.json();

    const delRes = await app.request(`/organizations/${id}`, { method: "DELETE" });
    expect(delRes.status).toBe(200);
    const delBody = await delRes.json();
    expect(delBody.deleted).toBe(true);

    // Should 404 on GET
    const getRes = await app.request(`/organizations/${id}`);
    expect(getRes.status).toBe(404);

    // Verify deleted_at set in DB
    const dbOrg = await prisma.organization.findUnique({ where: { id } });
    expect(dbOrg?.deleted_at).toBeDefined();
  });

  it("GET returns 404 for non-existent org", async () => {
    const app = makeApp();
    const res = await app.request(`/organizations/${crypto.randomUUID()}`);
    expect(res.status).toBe(404);
  });
});
