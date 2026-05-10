import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import prisma from "./helpers/db.js";
import { cleanDatabase } from "./helpers/db.js";
import organizationRoutes from "../../../src/routes/organizations.js";

function makeApp() {
  const app = new Hono();
  app.route("/organizations", organizationRoutes);
  return app;
}

describe("Cursor pagination (integration)", () => {
  const TOTAL = 10;
  const LIMIT = 3;

  beforeAll(async () => {
    await cleanDatabase();
    const app = makeApp();
    for (let i = 0; i < TOTAL; i++) {
      const res = await app.request("/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Page Org ${String(i).padStart(3, "0")}` }),
      });
      if (res.status !== 201) {
        const body = await res.text();
        throw new Error(`Create org ${i} failed: ${res.status} ${body}`);
      }
    }
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it("paginates through all results using cursors", async () => {
    const app = makeApp();
    const allIds: string[] = [];
    let cursor: string | null = null;
    let pages = 0;

    while (true) {
      const url = `/organizations?limit=${LIMIT}${cursor ? `&cursor=${cursor}` : ""}`;
      const res = await app.request(url);
      const body = await res.json();

      for (const org of body.data) {
        allIds.push(org.id);
      }

      pages++;
      if (!body.pagination.has_more) break;
      cursor = body.pagination.next_cursor;
    }

    expect(allIds).toHaveLength(TOTAL);
    expect(pages).toBe(Math.ceil(TOTAL / LIMIT));

    // No duplicates
    expect(new Set(allIds).size).toBe(TOTAL);
  });

  it("respects limit=1 returning single items", async () => {
    const app = makeApp();
    const res = await app.request("/organizations?limit=1");
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.pagination.has_more).toBe(true);
  });

  it("returns has_more=false when all items fit in one page", async () => {
    const app = makeApp();
    const res = await app.request(`/organizations?limit=${TOTAL + 5}`);
    const body = await res.json();
    expect(body.data).toHaveLength(TOTAL);
    expect(body.pagination.has_more).toBe(false);
    expect(body.pagination.next_cursor).toBeNull();
  });

  it("ignores invalid cursor gracefully", async () => {
    const app = makeApp();
    const res = await app.request("/organizations?cursor=not-a-uuid");
    // Should either return error or ignore cursor
    expect([200, 400]).toContain(res.status);
  });
});
