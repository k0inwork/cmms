import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { paginationSchema, buildCursorQuery, paginatedResponse } from "../utils/pagination.js";
import { AssetError } from "../utils/errors.js";
import { authMiddleware, requireRoles, AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();
app.use("*", authMiddleware());

const subsystemNameSchema = z.string().min(1).max(200);

const createSubsystemSchema = z.object({
  name: subsystemNameSchema,
  type: z.string().max(100).optional(),
});

const updateSubsystemSchema = z
  .object({
    name: subsystemNameSchema.optional(),
    type: z.string().max(100).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

// ── Turbine existence helper ────────────────────────────────────────────────

async function requireTurbine(turbineId: string, siteId: string, orgId: string) {
  const site = await prisma.site.findFirst({
    where: { id: siteId, organization_id: orgId, deleted_at: null },
  });
  if (!site) throw new AssetError(404, "ASSET_004", `Site with id '${siteId}' not found`);

  const turbine = await prisma.turbine.findFirst({
    where: { id: turbineId, site_id: siteId, deleted_at: null },
  });
  if (!turbine) throw new AssetError(404, "ASSET_004", `Turbine with id '${turbineId}' not found`);
  return turbine;
}

// ── Routes ──────────────────────────────────────────────────────────────────

// GET /subsystems — list
app.get("/", zValidator("query", paginationSchema), async (c) => {
  const turbineId = c.req.param("turbineId")!;
  const siteId = c.req.param("siteId")!;
  const orgId = c.req.param("orgId")!;
  await requireTurbine(turbineId, siteId, orgId);
  const { cursor, limit } = c.req.valid("query");

  const items = await prisma.subsystem.findMany({
    where: { turbine_id: turbineId, deleted_at: null },
    take: limit + 1,
    orderBy: { created_at: "desc" },
    ...buildCursorQuery(cursor),
  });

  return c.json(paginatedResponse(items, limit));
});

// POST /subsystems — create
app.post("/", requireRoles("ADMINISTRATOR"), zValidator("json", createSubsystemSchema), async (c) => {
  const turbineId = c.req.param("turbineId")!;
  const siteId = c.req.param("siteId")!;
  const orgId = c.req.param("orgId")!;
  await requireTurbine(turbineId, siteId, orgId);
  const { name, type } = c.req.valid("json");

  const existing = await prisma.subsystem.findFirst({
    where: { turbine_id: turbineId, name, deleted_at: null },
  });
  if (existing) {
    throw new AssetError(409, "ASSET_005", `Subsystem with name '${name}' already exists in this turbine`);
  }

  const subsystem = await prisma.subsystem.create({
    data: { name, type, turbine_id: turbineId },
  });
  return c.json(subsystem, 201);
});

// GET /subsystems/:id — single
app.get("/:id", async (c) => {
  const turbineId = c.req.param("turbineId")!;
  const siteId = c.req.param("siteId")!;
  const orgId = c.req.param("orgId")!;
  const id = c.req.param("id")!;
  await requireTurbine(turbineId, siteId, orgId);

  const subsystem = await prisma.subsystem.findFirst({
    where: { id, turbine_id: turbineId, deleted_at: null },
  });
  if (!subsystem) throw new AssetError(404, "ASSET_004", `Subsystem with id '${id}' not found`);

  return c.json(subsystem);
});

// PATCH /subsystems/:id — update
app.patch("/:id", requireRoles("ADMINISTRATOR"), zValidator("json", updateSubsystemSchema), async (c) => {
  const turbineId = c.req.param("turbineId")!;
  const siteId = c.req.param("siteId")!;
  const orgId = c.req.param("orgId")!;
  const id = c.req.param("id")!;
  await requireTurbine(turbineId, siteId, orgId);
  const data = c.req.valid("json");

  const subsystem = await prisma.subsystem.findFirst({
    where: { id, turbine_id: turbineId, deleted_at: null },
  });
  if (!subsystem) throw new AssetError(404, "ASSET_004", `Subsystem with id '${id}' not found`);

  if (data.name && data.name !== subsystem.name) {
    const duplicate = await prisma.subsystem.findFirst({
      where: { turbine_id: turbineId, name: data.name, deleted_at: null, id: { not: id } },
    });
    if (duplicate) {
      throw new AssetError(409, "ASSET_005", `Subsystem with name '${data.name}' already exists in this turbine`);
    }
  }

  const updated = await prisma.subsystem.update({ where: { id }, data });
  return c.json(updated);
});

// DELETE /subsystems/:id — soft delete
app.delete("/:id", requireRoles("ADMINISTRATOR"), async (c) => {
  const turbineId = c.req.param("turbineId")!;
  const siteId = c.req.param("siteId")!;
  const orgId = c.req.param("orgId")!;
  const id = c.req.param("id")!;
  await requireTurbine(turbineId, siteId, orgId);

  const subsystem = await prisma.subsystem.findFirst({
    where: { id, turbine_id: turbineId, deleted_at: null },
  });
  if (!subsystem) throw new AssetError(404, "ASSET_004", `Subsystem with id '${id}' not found`);

  await prisma.subsystem.update({
    where: { id },
    data: { deleted_at: new Date() },
  });

  return c.json({ deleted: true, id });
});

export default app;
