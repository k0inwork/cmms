import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import crypto from "crypto";

// Mock prisma before importing routes
vi.mock("../src/lib/prisma.js", () => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  return { default: prisma };
});

// Import after mocks
import prisma from "../src/lib/prisma.js";
import authRoutes from "../src/routes/auth.js";
import { hashPassword } from "../src/utils/password.js";
import { signAccessToken, signRefreshToken, verifyAccessToken } from "../src/utils/jwt.js";

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

const app = new Hono();
app.route("/auth", authRoutes);

describe("Auth Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /auth/login", () => {
    it("returns tokens on valid credentials", async () => {
      const hash = await hashPassword("password123");
      mockUser.password_hash = hash;
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any);

      const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "tech@test.com", password: "password123" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.user.email).toBe("tech@test.com");
      expect(body.user.role).toBe("TECHNICIAN");

      // Verify access token is valid
      const decoded = verifyAccessToken(body.accessToken);
      expect(decoded.userId).toBe("user-1");
      expect(decoded.role).toBe("TECHNICIAN");
    });

    it("returns 401 for unknown email", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "noone@test.com", password: "password123" }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Invalid credentials");
    });

    it("returns 401 for wrong password", async () => {
      mockUser.password_hash = await hashPassword("right-password");
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "tech@test.com", password: "wrong-password" }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 401 for inactive user", async () => {
      mockUser.is_active = false;
      mockUser.password_hash = await hashPassword("password123");
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "tech@test.com", password: "password123" }),
      });

      expect(res.status).toBe(401);
      mockUser.is_active = true;
    });

    it("returns 400 for invalid input", async () => {
      const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/refresh", () => {
    it("returns new tokens on valid refresh token", async () => {
      const payload = {
        userId: "user-1",
        email: "tech@test.com",
        role: "TECHNICIAN",
        organizationId: "org-1",
      };
      const refreshToken = signRefreshToken(payload);
      const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

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

      const res = await app.request("/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
    });

    it("returns 401 for revoked token", async () => {
      const payload = {
        userId: "user-1",
        email: "tech@test.com",
        role: "TECHNICIAN",
        organizationId: "org-1",
      };
      const refreshToken = signRefreshToken(payload);
      const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: "rt-1",
        token_hash: tokenHash,
        user_id: "user-1",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revoked_at: new Date(), // revoked
        created_at: new Date(),
      } as any);

      const res = await app.request("/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 401 for expired token", async () => {
      const payload = {
        userId: "user-1",
        email: "tech@test.com",
        role: "TECHNICIAN",
        organizationId: "org-1",
      };
      const refreshToken = signRefreshToken(payload);
      const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: "rt-1",
        token_hash: tokenHash,
        user_id: "user-1",
        expires_at: new Date(Date.now() - 1000), // expired
        revoked_at: null,
        created_at: new Date(),
      } as any);

      const res = await app.request("/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 400 for missing refreshToken", async () => {
      const res = await app.request("/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/logout", () => {
    it("returns 200 with valid access token", async () => {
      const payload = {
        userId: "user-1",
        email: "tech@test.com",
        role: "TECHNICIAN",
        organizationId: "org-1",
      };
      const accessToken = signAccessToken(payload);

      vi.mocked(prisma.refreshToken.updateMany).mockResolvedValue({ count: 1 } as any);

      const res = await app.request("/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken: "some-token" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Logged out");
    });

    it("returns 401 without access token", async () => {
      const res = await app.request("/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /auth/me", () => {
    it("returns current user profile", async () => {
      const payload = {
        userId: "user-1",
        email: "tech@test.com",
        role: "TECHNICIAN",
        organizationId: "org-1",
      };
      const accessToken = signAccessToken(payload);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-1",
        email: "tech@test.com",
        first_name: "Test",
        last_name: "User",
        role: "TECHNICIAN",
        is_active: true,
        organization_id: "org-1",
        created_at: new Date("2025-01-01"),
      } as any);

      const res = await app.request("/auth/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.email).toBe("tech@test.com");
      expect(body.role).toBe("TECHNICIAN");
      expect(body.firstName).toBe("Test");
    });

    it("returns 401 without token", async () => {
      const res = await app.request("/auth/me");
      expect(res.status).toBe(401);
    });

    it("returns 404 for deleted user", async () => {
      const payload = {
        userId: "user-deleted",
        email: "gone@test.com",
        role: "TECHNICIAN",
        organizationId: "org-1",
      };
      const accessToken = signAccessToken(payload);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const res = await app.request("/auth/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(res.status).toBe(404);
    });
  });
});
