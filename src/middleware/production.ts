import { Context, Next } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { verifyAccessToken } from "../utils/jwt.js";

// Structured Logger Middleware
export const structuredLogger = () => async (c: Context, next: Next) => {
  const start = Date.now();
  const reqId = c.get("requestId") || "unknown";
  const isTest = process.env.NODE_ENV === "test";
  
  // Log request
  if (!isTest) {
    console.log(JSON.stringify({
      type: "request",
      id: reqId,
      method: c.req.method,
      url: c.req.url,
      userAgent: c.req.header("user-agent"),
      ip: getClientIp(c),
      timestamp: new Date().toISOString()
    }));
  }

  await next();

  const duration = Date.now() - start;

  // Log response
  if (!isTest) {
    console.log(JSON.stringify({
      type: "response",
      id: reqId,
      method: c.req.method,
      url: c.req.url,
      status: c.res.status,
      durationMs: duration,
      timestamp: new Date().toISOString()
    }));
  }
};

// Rate Limiter
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function cleanupStore() {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Periodically clean up the store
setInterval(cleanupStore, 60000).unref();

function getClientIp(c: Context): string {
  // Try getting IP from standard headers
  const forwardedFor = c.req.header("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return c.req.header("x-real-ip") || "127.0.0.1";
}

export const rateLimiter = (config: RateLimitConfig = { windowMs: 60000, maxRequests: 100 }) => {
  return async (c: Context, next: Next) => {
    let identifier = getClientIp(c);
    let isUser = false;

    // Try to get userId from token if present for per-user limiting
    const authHeader = c.req.header("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.slice(7);
        const payload = verifyAccessToken(token);
        if (payload && payload.userId) {
          identifier = `user:${payload.userId}`;
          isUser = true;
        }
      } catch {
        // Invalid token, fallback to IP
      }
    }

    if (!isUser) {
      identifier = `ip:${identifier}`;
    }

    const now = Date.now();
    let record = rateLimitStore.get(identifier);

    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + config.windowMs };
    }

    record.count++;
    rateLimitStore.set(identifier, record);

    c.header("X-RateLimit-Limit", config.maxRequests.toString());
    c.header("X-RateLimit-Remaining", Math.max(0, config.maxRequests - record.count).toString());
    c.header("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000).toString());

    if (record.count > config.maxRequests) {
      return c.json({ error: "Too many requests" }, 429);
    }

    await next();
  };
};

export const prodCors = () => cors({
  origin: "*", // Or configure based on env
  allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
  maxAge: 86400,
});

export const prodSecureHeaders = () => secureHeaders({
  crossOriginResourcePolicy: "cross-origin", // allow GUI to load uploaded images
});

export const prodRequestId = () => requestId();
