import { Context, Next } from "hono";
import { verifyAccessToken, TokenPayload } from "../utils/jwt.js";

export interface AuthEnv {
  Variables: {
    user: TokenPayload;
  };
}

export function authMiddleware() {
  return async (c: Context<AuthEnv>, next: Next) => {
    const header = c.req.header("Authorization");
    if (!header || !header.startsWith("Bearer ")) {
      return c.json({ error: "Missing or invalid Authorization header" }, 401);
    }

    const token = header.slice(7);
    try {
      const payload = verifyAccessToken(token);
      c.set("user", payload);
      await next();
    } catch {
      return c.json({ error: "Invalid or expired token" }, 401);
    }
  };
}

export function requireRoles(...roles: string[]) {
  return async (c: Context<AuthEnv>, next: Next) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Not authenticated" }, 401);
    }
    if (!roles.includes(user.role)) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }
    await next();
  };
}
