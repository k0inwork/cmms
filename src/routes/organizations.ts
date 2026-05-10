import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { paginationSchema, buildCursorQuery, paginatedResponse } from "../utils/pagination.js";
import { NotFoundError, ConflictError } from "../utils/errors.js";
import { authMiddleware, requireRoles, AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();
app.use("*", authMiddleware());

// ── Validation schemas ──────────────────────────────────────────────────────

const createOrgSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

const updateOrgSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

// ── Routes ──────────────────────────────────────────────────────────────────

// GET /organizations — list with cursor pagination
app.get("/", zValidator("query", paginationSchema), async (c) => {
  const { cursor, limit } = c.req.valid("query");

  const items = await prisma.organization.findMany({
    where: { deleted_at: null },
    take: limit + 1,
    orderBy: { created_at: "desc" },
    ...buildCursorQuery(cursor),
  });

  return c.json(paginatedResponse(items, limit));
});

// POST /organizations — create
app.post("/", requireRoles("ADMINISTRATOR"), zValidator("json", createOrgSchema), async (c) => {
  const { name, description } = c.req.valid("json");

  const existing = await prisma.organization.findFirst({
    where: { name, deleted_at: null },
  });
  if (existing) {
    throw new ConflictError(`Organization with name '${name}' already exists`);
  }

  const org = await prisma.organization.create({ data: { name, description } });
  return c.json(org, 201);
});

// GET /organizations/:id — single
app.get("/:id", async (c) => {
  const id = c.req.param("id");

  const org = await prisma.organization.findFirst({
    where: { id, deleted_at: null },
  });
  if (!org) throw new NotFoundError("Organization", id);

  return c.json(org);
});

// PATCH /organizations/:id — update
app.patch("/:id", requireRoles("ADMINISTRATOR"), zValidator("json", updateOrgSchema), async (c) => {
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const org = await prisma.organization.findFirst({
    where: { id, deleted_at: null },
  });
  if (!org) throw new NotFoundError("Organization", id);

  if (data.name && data.name !== org.name) {
    const duplicate = await prisma.organization.findFirst({
      where: { name: data.name, deleted_at: null, id: { not: id } },
    });
    if (duplicate) {
      throw new ConflictError(`Organization with name '${data.name}' already exists`);
    }
  }

  const updated = await prisma.organization.update({ where: { id }, data });
  return c.json(updated);
});

// DELETE /organizations/:id — soft delete
app.delete("/:id", requireRoles("ADMINISTRATOR"), async (c) => {
  const id = c.req.param("id")!;

  const org = await prisma.organization.findFirst({
    where: { id, deleted_at: null },
  });
  if (!org) throw new NotFoundError("Organization", id);

  await prisma.organization.update({
    where: { id },
    data: { deleted_at: new Date() },
  });

  return c.json({ deleted: true, id });
});

export default app;
