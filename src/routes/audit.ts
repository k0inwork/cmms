import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { paginationSchema, buildCursorQuery, paginatedResponse } from "../utils/pagination.js";
import { authMiddleware, requireRoles, type AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

// ── Validation schemas ──────────────────────────────────────────────────────

const auditActionSchema = z.enum([
  "CREATE",
  "UPDATE",
  "DELETE",
  "STATUS_CHANGE",
  "ASSIGN",
  "APPROVE",
  "REJECT",
  "SYNC",
  "LOGIN",
  "LOGOUT",
]);

const listQuerySchema = paginationSchema.extend({
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  action: auditActionSchema.optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
});

// ── Routes ──────────────────────────────────────────────────────────────────

// GET /audit — list audit events with filters and cursor pagination
app.get("/", authMiddleware(), requireRoles("ADMINISTRATOR", "OPERATIONS_MANAGER"), zValidator("query", listQuerySchema), async (c) => {
  const {
    cursor,
    limit,
    entityType,
    entityId,
    userId,
    action,
    createdAfter,
    createdBefore,
  } = c.req.valid("query");

  const where: Record<string, unknown> = {};
  if (entityType) where.entity_type = entityType;
  if (entityId) where.entity_id = entityId;
  if (userId) where.user_id = userId;
  if (action) where.action = action;
  if (createdAfter || createdBefore) {
    where.created_at = {
      ...(createdAfter ? { gte: new Date(createdAfter) } : {}),
      ...(createdBefore ? { lte: new Date(createdBefore) } : {}),
    };
  }

  const items = await prisma.auditEvent.findMany({
    where,
    take: limit + 1,
    orderBy: { created_at: "desc" },
    include: {
      user: { select: { id: true, first_name: true, last_name: true, email: true } },
    },
    ...buildCursorQuery(cursor),
  });

  return c.json(paginatedResponse(items, limit));
});

// GET /audit/:id — single audit event detail
app.get("/:id", authMiddleware(), requireRoles("ADMINISTRATOR", "OPERATIONS_MANAGER"), async (c) => {
  const id = c.req.param("id");

  const event = await prisma.auditEvent.findFirst({
    where: { id },
    include: {
      user: { select: { id: true, first_name: true, last_name: true, email: true } },
    },
  });
  if (!event) return c.json({ error: "Audit event not found" }, 404);

  return c.json(event);
});

// GET /audit/entity/:entityType/:entityId — all events for a specific entity
app.get(
  "/entity/:entityType/:entityId",
  authMiddleware(),
  requireRoles("ADMINISTRATOR", "OPERATIONS_MANAGER", "DISPATCHER", "QA_REVIEWER"),
  zValidator("query", paginationSchema),
  async (c) => {
    const entityType = c.req.param("entityType");
    const entityId = c.req.param("entityId");
    const { cursor, limit } = c.req.valid("query");

    const items = await prisma.auditEvent.findMany({
      where: { entity_type: entityType, entity_id: entityId },
      take: limit + 1,
      orderBy: { created_at: "desc" },
      include: {
        user: { select: { id: true, first_name: true, last_name: true } },
      },
      ...buildCursorQuery(cursor),
    });

    return c.json(paginatedResponse(items, limit));
  },
);

export default app;
