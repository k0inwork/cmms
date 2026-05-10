import { Hono } from "hono";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { verifyPassword } from "../utils/password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken, TokenPayload } from "../utils/jwt.js";
import { authMiddleware, AuthEnv } from "../middleware/auth.js";
import crypto from "crypto";

const auth = new Hono<AuthEnv>();

// ─── Validation Schemas ──────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTokenPayload(user: {
  id: string;
  email: string;
  role: string;
  organization_id: string;
}): TokenPayload {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organization_id,
  };
}

// ─── POST /auth/login ────────────────────────────────────────────────────────

auth.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.is_active) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const payload = makeTokenPayload(user);
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Store refresh token hash in DB
  const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.refreshToken.create({
    data: {
      token_hash: tokenHash,
      user_id: user.id,
      expires_at: expiresAt,
    },
  });

  return c.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      organizationId: user.organization_id,
    },
  });
});

// ─── POST /auth/refresh ──────────────────────────────────────────────────────

auth.post("/refresh", async (c) => {
  const body = await c.req.json();
  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const { refreshToken } = parsed.data;

  let payload: TokenPayload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return c.json({ error: "Invalid or expired refresh token" }, 401);
  }

  const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  const stored = await prisma.refreshToken.findUnique({ where: { token_hash: tokenHash } });

  if (!stored || stored.revoked_at || stored.expires_at < new Date()) {
    return c.json({ error: "Invalid or expired refresh token" }, 401);
  }

  // Rotate: revoke old, issue new
  await prisma.refreshToken.update({
    where: { token_hash: tokenHash },
    data: { revoked_at: new Date() },
  });

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.is_active) {
    return c.json({ error: "User not found or inactive" }, 401);
  }

  const newPayload = makeTokenPayload(user);
  const newAccessToken = signAccessToken(newPayload);
  const newRefreshToken = signRefreshToken(newPayload);

  const newTokenHash = crypto.createHash("sha256").update(newRefreshToken).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      token_hash: newTokenHash,
      user_id: user.id,
      expires_at: expiresAt,
    },
  });

  return c.json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
});

// ─── POST /auth/logout ───────────────────────────────────────────────────────

auth.post("/logout", authMiddleware(), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { refreshToken } = body;

  if (refreshToken) {
    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    await prisma.refreshToken.updateMany({
      where: { token_hash: tokenHash, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  return c.json({ message: "Logged out" });
});

// ─── GET /auth/me ────────────────────────────────────────────────────────────

auth.get("/me", authMiddleware(), async (c) => {
  const user = c.get("user");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      role: true,
      is_active: true,
      organization_id: true,
      created_at: true,
    },
  });

  if (!dbUser) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    id: dbUser.id,
    email: dbUser.email,
    firstName: dbUser.first_name,
    lastName: dbUser.last_name,
    role: dbUser.role,
    isActive: dbUser.is_active,
    organizationId: dbUser.organization_id,
    createdAt: dbUser.created_at,
  });
});

export default auth;
