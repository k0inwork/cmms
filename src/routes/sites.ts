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

const createSiteSchema = z.object({
  name: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  time_zone: z.string().max(50).default("UTC"),
});

const updateSiteSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    time_zone: z.string().max(50).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

// ── Org existence helper ────────────────────────────────────────────────────

async function requireOrg(orgId: string) {
  const org = await prisma.organization.findFirst({
    where: { id: orgId, deleted_at: null },
  });
  if (!org) throw new NotFoundError("Organization", orgId);
  return org;
}

// ── Routes ──────────────────────────────────────────────────────────────────

// GET /organizations/:orgId/sites — list with cursor pagination
app.get("/", zValidator("query", paginationSchema), async (c) => {
  const orgId = c.req.param("orgId")!;
  await requireOrg(orgId);
  const { cursor, limit } = c.req.valid("query");

  const items = await prisma.site.findMany({
    where: { organization_id: orgId, deleted_at: null },
    take: limit + 1,
    orderBy: { created_at: "desc" },
    ...buildCursorQuery(cursor),
  });

  return c.json(paginatedResponse(items, limit));
});

// POST /organizations/:orgId/sites — create
app.post("/", requireRoles("ADMINISTRATOR"), zValidator("json", createSiteSchema), async (c) => {
  const orgId = c.req.param("orgId")!;
  await requireOrg(orgId);
  const { name, latitude, longitude, time_zone } = c.req.valid("json");

  const existing = await prisma.site.findFirst({
    where: { organization_id: orgId, name, deleted_at: null },
  });
  if (existing) {
    throw new ConflictError(`Site with name '${name}' already exists in this organization`);
  }

  const site = await prisma.site.create({
    data: { name, latitude, longitude, time_zone, organization_id: orgId },
  });
  return c.json(site, 201);
});

// GET /organizations/:orgId/sites/:id — single
app.get("/:id", async (c) => {
  const orgId = c.req.param("orgId")!;
  const id = c.req.param("id")!;
  await requireOrg(orgId);

  const site = await prisma.site.findFirst({
    where: { id, organization_id: orgId, deleted_at: null },
  });
  if (!site) throw new NotFoundError("Site", id);

  return c.json(site);
});

// PATCH /organizations/:orgId/sites/:id — update
app.patch("/:id", requireRoles("ADMINISTRATOR"), zValidator("json", updateSiteSchema), async (c) => {
  const orgId = c.req.param("orgId")!;
  const id = c.req.param("id")!;
  await requireOrg(orgId);
  const data = c.req.valid("json");

  const site = await prisma.site.findFirst({
    where: { id, organization_id: orgId, deleted_at: null },
  });
  if (!site) throw new NotFoundError("Site", id);

  if (data.name && data.name !== site.name) {
    const duplicate = await prisma.site.findFirst({
      where: {
        organization_id: orgId,
        name: data.name,
        deleted_at: null,
        id: { not: id },
      },
    });
    if (duplicate) {
      throw new ConflictError(`Site with name '${data.name}' already exists in this organization`);
    }
  }

  const updated = await prisma.site.update({ where: { id }, data });
  return c.json(updated);
});

// DELETE /organizations/:orgId/sites/:id — soft delete
app.delete("/:id", requireRoles("ADMINISTRATOR"), async (c) => {
  const orgId = c.req.param("orgId")!;
  const id = c.req.param("id")!;
  await requireOrg(orgId);

  const site = await prisma.site.findFirst({
    where: { id, organization_id: orgId, deleted_at: null },
  });
  if (!site) throw new NotFoundError("Site", id);

  await prisma.site.update({
    where: { id },
    data: { deleted_at: new Date() },
  });

  return c.json({ deleted: true, id });
});

export default app;
