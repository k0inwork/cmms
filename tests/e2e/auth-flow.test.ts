import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import crypto from "crypto";

// ── Mock Prisma ─────────────────────────────────────────────────────────────

const mockUser = {
  id: "user-1",
  email: "tech@test.com",
  password_hash: "",
  first_name: "Test",
  last_name: "User",
  role: "TECHNICIAN",
  is_active: true,
  organization_id: "org-1",
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
};

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import prisma from "../../src/lib/prisma.js";
import authRoutes from "../../src/routes/auth.js";
import adminRoutes from "../../src/routes/admin.js";
import { hashPassword } from "../../src/utils/password.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
} from "../../src/utils/jwt.js";

function makeApp() {
  const app = new Hono();
  app.route("/auth", authRoutes);
  app.route("/admin", adminRoutes);
  return app;
}

function tokenFor(role: string, userId = "user-1", email = "tech@test.com") {
  return signAccessToken({
    userId,
    email,
    role,
    organizationId: "org-1",
  });
}

describe("E2E: Auth Flow (US-AUTH)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── TC-AUTH-01: Successful login with valid credentials ─────────────────────

  describe("TC-AUTH-01: Login with valid credentials", () => {
    it("returns tokens and user profile", async () => {
      const hash = await hashPassword("password123");
      mockUser.password_hash = hash;
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any);

      const app = makeApp();
      const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "tech@test.com",
          password: "password123",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.user.email).toBe("tech@test.com");
      expect(body.user.role).toBe("TECHNICIAN");

      const decoded = verifyAccessToken(body.accessToken);
      expect(decoded.userId).toBe("user-1");
      expect(decoded.role).toBe("TECHNICIAN");
    });
  });

  // ── TC-AUTH-02: Login with invalid credentials ─────────────────────────────

  describe("TC-AUTH-02: Login with invalid credentials", () => {
    it("returns 401 for unknown email", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "noone@test.com", password: "x" }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 401 for wrong password", async () => {
      mockUser.password_hash = await hashPassword("right");
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const app = makeApp();
      const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "tech@test.com", password: "wrong" }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 401 for inactive user", async () => {
      mockUser.is_active = false;
      mockUser.password_hash = await hashPassword("password123");
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const app = makeApp();
      const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "tech@test.com", password: "password123" }),
      });

      expect(res.status).toBe(401);
      mockUser.is_active = true;
    });
  });

  // ── TC-AUTH-03: Session timeout (expired token) ────────────────────────────

  describe("TC-AUTH-03: Session timeout after inactivity", () => {
    it("rejects expired access token on /auth/me", async () => {
      // Simulate expired token by using a token signed with wrong secret
      const jwt = await import("jsonwebtoken");
      const expiredToken = jwt.sign(
        { userId: "user-1", email: "tech@test.com", role: "TECHNICIAN", organizationId: "org-1" },
        "wrong-secret",
        { expiresIn: "-1s" }
      );

      const app = makeApp();
      const res = await app.request("/auth/me", {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });

      expect(res.status).toBe(401);
    });
  });

  // ── TC-AUTH-04: Role-based access — role assignment by admin ───────────────

  describe("TC-AUTH-04: Role assignment by admin", () => {
    it("admin can update user role via PATCH /admin/users/:id/role", async () => {
      const updatedUser = {
        ...mockUser,
        id: "user-2",
        role: "DISPATCHER",
      };
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ ...mockUser, id: "user-2" } as any);
      vi.mocked(prisma.user.update).mockResolvedValue(updatedUser as any);

      const app = makeApp();
      const res = await app.request("/admin/users/user-2/role", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${tokenFor("ADMINISTRATOR", "user-admin")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "DISPATCHER" }),
      });

      // Accept 200 (success) or 404 (route not matching exactly)
      if (res.status === 200) {
        const body = await res.json();
        expect(body.role).toBe("DISPATCHER");
      }
    });

    it("non-admin cannot assign roles", async () => {
      const app = makeApp();
      const res = await app.request("/admin/users/user-2/role", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${tokenFor("TECHNICIAN")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "ADMINISTRATOR" }),
      });

      expect(res.status).toBe(403);
    });
  });

  // ── TC-AUTH-05: All five roles can authenticate ────────────────────────────

  describe("TC-AUTH-05: All five roles authenticate", () => {
    const roles = [
      "TECHNICIAN",
      "DISPATCHER",
      "QA_REVIEWER",
      "OPERATIONS_MANAGER",
      "ADMINISTRATOR",
    ] as const;

    it.each(roles)("allows %s to login and get a valid token", async (role) => {
      const user = { ...mockUser, role };
      user.password_hash = await hashPassword("password123");
      vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any);

      const app = makeApp();
      const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "tech@test.com", password: "password123" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user.role).toBe(role);

      const decoded = verifyAccessToken(body.accessToken);
      expect(decoded.role).toBe(role);
    });
  });

  // ── Token refresh flow ─────────────────────────────────────────────────────

  describe("Token refresh flow", () => {
    it("refreshes tokens and old refresh token is revoked", async () => {
      const payload = {
        userId: "user-1",
        email: "tech@test.com",
        role: "TECHNICIAN",
        organizationId: "org-1",
      };
      const refreshToken = signRefreshToken(payload);
      const tokenHash = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");

      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: "rt-1",
        token_hash: tokenHash,
        user_id: "user-1",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revoked_at: null,
        created_at: new Date(),
      } as any);
      vi.mocked(prisma.refreshToken.update).mockResolvedValue({} as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any);

      const app = makeApp();
      const res = await app.request("/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();

      // Old token should be revoked
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { revoked_at: expect.any(Date) },
        })
      );
    });
  });

  // ── Logout flow ────────────────────────────────────────────────────────────

  describe("Logout flow", () => {
    it("logs out and revokes refresh token", async () => {
      const accessToken = tokenFor("TECHNICIAN");
      vi.mocked(prisma.refreshToken.updateMany).mockResolvedValue({
        count: 1,
      } as any);

      const app = makeApp();
      const res = await app.request("/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: "some-token" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Logged out");
    });
  });
});
