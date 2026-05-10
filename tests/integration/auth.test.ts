import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Hono } from "hono";
import prisma from "./helpers/db.js";
import { cleanDatabase } from "./helpers/db.js";
import { createOrg } from "./helpers/fixtures.js";
import { createTestUser } from "./helpers/auth.js";
import authRoutes from "../../../src/routes/auth.js";

function makeApp() {
  const app = new Hono();
  app.route("/auth", authRoutes);
  return app;
}

describe("Auth routes (integration)", () => {
  let orgId: string;
  let testEmail: string;
  let testUserId: string;
  const testPassword = "Password123!";

  beforeAll(async () => {
    await cleanDatabase();
    const org = await createOrg("Auth Test Org");
    orgId = org.id;
    testEmail = `login-test-${crypto.randomUUID()}@example.com`;
    const { user } = await createTestUser({ email: testEmail, organizationId: orgId });
    testUserId = user.id;
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "refresh_tokens" CASCADE`);
  });

  it("POST /auth/login returns tokens for valid credentials", async () => {
    const app = makeApp();

    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.user.email).toBe(testEmail);
    expect(body.user.id).toBe(testUserId);

    // Verify refresh token stored in DB
    const tokens = await prisma.refreshToken.findMany({ where: { user_id: testUserId } });
    expect(tokens).toHaveLength(1);
    expect(tokens[0].revoked_at).toBeNull();
  });

  it("POST /auth/login rejects wrong password", async () => {
    const app = makeApp();
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: "wrong-password" }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /auth/login rejects non-existent user", async () => {
    const app = makeApp();
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "noone@test.com", password: testPassword }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /auth/refresh rotates refresh token", async () => {
    const app = makeApp();
    const loginRes = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    const { refreshToken, user } = await loginRes.json();

    // Ensure next JWT has different timestamp to avoid hash collision
    await new Promise((r) => setTimeout(r, 1100));

    const refreshRes = await app.request("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (refreshRes.status !== 200) {
      const text = await refreshRes.text();
      throw new Error(`Refresh failed ${refreshRes.status}: ${text}`);
    }
    expect(refreshRes.status).toBe(200);
    const newBody = await refreshRes.json();
    expect(newBody.accessToken).toBeDefined();
    expect(newBody.refreshToken).toBeDefined();
    expect(newBody.refreshToken).not.toBe(refreshToken);

    // Old token should be revoked
    const oldToken = await prisma.refreshToken.findFirst({
      where: { user_id: user.id, revoked_at: { not: null } },
    });
    expect(oldToken).toBeDefined();

    // Using old refresh token should fail
    const retryRes = await app.request("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    expect(retryRes.status).toBe(401);
  });

  it("GET /auth/me returns current user", async () => {
    const { token, user } = await createTestUser({ organizationId: orgId });
    const app = makeApp();

    const res = await app.request("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBe(user.email);
    expect(body.id).toBe(user.id);
  });

  it("GET /auth/me rejects missing token", async () => {
    const app = makeApp();
    const res = await app.request("/auth/me");
    expect(res.status).toBe(401);
  });

  it("POST /auth/logout revokes refresh token", async () => {
    const app = makeApp();
    const loginRes = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    if (loginRes.status !== 200) {
      const text = await loginRes.text();
      throw new Error(`Login failed ${loginRes.status}: ${text}`);
    }
    const { accessToken, refreshToken } = await loginRes.json();

    const logoutRes = await app.request("/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ refreshToken }),
    });
    expect(logoutRes.status).toBe(200);

    // Verify token revoked in DB
    const hash = await import("crypto").then((c) =>
      c.createHash("sha256").update(refreshToken).digest("hex"),
    );
    const stored = await prisma.refreshToken.findFirst({ where: { token_hash: hash } });
    expect(stored?.revoked_at).not.toBeNull();
  });
});
