import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { paginationSchema, buildCursorQuery, paginatedResponse } from "../utils/pagination.js";
import { AssetError } from "../utils/errors.js";

const app = new Hono();

const componentNameSchema = z.string().min(1).max(200);

const createComponentSchema = z.object({
  name: componentNameSchema,
  status: z.enum(["ACTIVE", "DECOMMISSIONED", "MAINTENANCE", "PLANNED"]).default("ACTIVE"),
});

const updateComponentSchema = z
  .object({
    name: componentNameSchema.optional(),
    status: z.enum(["ACTIVE", "DECOMMISSIONED", "MAINTENANCE", "PLANNED"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

// ── Subsystem existence helper ──────────────────────────────────────────────

async function requireSubsystem(subsystemId: string, turbineId: string, siteId: string, orgId: string) {
  const site = await prisma.site.findFirst({
    where: { id: siteId, organization_id: orgId, deleted_at: null },
  });
  if (!site) throw new AssetError(404, "ASSET_004", `Site with id '${siteId}' not found`);

  const turbine = await prisma.turbine.findFirst({
    where: { id: turbineId, site_id: siteId, deleted_at: null },
  });
  if (!turbine) throw new AssetError(404, "ASSET_004", `Turbine with id '${turbineId}' not found`);

  const subsystem = await prisma.subsystem.findFirst({
    where: { id: subsystemId, turbine_id: turbineId, deleted_at: null },
  });
  if (!subsystem) throw new AssetError(404, "ASSET_004", `Subsystem with id '${subsystemId}' not found`);
  return subsystem;
}

// ── Routes ──────────────────────────────────────────────────────────────────

// GET /components — list
app.get("/", zValidator("query", paginationSchema), async (c) => {
  const subsystemId = c.req.param("subsystemId")!;
  const turbineId = c.req.param("turbineId")!;
  const siteId = c.req.param("siteId")!;
  const orgId = c.req.param("orgId")!;
  await requireSubsystem(subsystemId, turbineId, siteId, orgId);
  const { cursor, limit } = c.req.valid("query");

  const items = await prisma.component.findMany({
    where: { subsystem_id: subsystemId, deleted_at: null },
    take: limit + 1,
    orderBy: { created_at: "desc" },
    ...buildCursorQuery(cursor),
  });

  return c.json(paginatedResponse(items, limit));
});

// POST /components — create
app.post("/", zValidator("json", createComponentSchema), async (c) => {
  const subsystemId = c.req.param("subsystemId")!;
  const turbineId = c.req.param("turbineId")!;
  const siteId = c.req.param("siteId")!;
  const orgId = c.req.param("orgId")!;
  await requireSubsystem(subsystemId, turbineId, siteId, orgId);
  const { name, status } = c.req.valid("json");

  const existing = await prisma.component.findFirst({
    where: { subsystem_id: subsystemId, name, deleted_at: null },
  });
  if (existing) {
    throw new AssetError(409, "ASSET_005", `Component with name '${name}' already exists in this subsystem`);
  }

  const component = await prisma.component.create({
    data: { name, status, subsystem_id: subsystemId },
  });
  return c.json(component, 201);
});

// GET /components/:id — single
app.get("/:id", async (c) => {
  const subsystemId = c.req.param("subsystemId")!;
  const turbineId = c.req.param("turbineId")!;
  const siteId = c.req.param("siteId")!;
  const orgId = c.req.param("orgId")!;
  const id = c.req.param("id")!;
  await requireSubsystem(subsystemId, turbineId, siteId, orgId);

  const component = await prisma.component.findFirst({
    where: { id, subsystem_id: subsystemId, deleted_at: null },
  });
  if (!component) throw new AssetError(404, "ASSET_004", `Component with id '${id}' not found`);

  return c.json(component);
});

// PATCH /components/:id — update
app.patch("/:id", zValidator("json", updateComponentSchema), async (c) => {
  const subsystemId = c.req.param("subsystemId")!;
  const turbineId = c.req.param("turbineId")!;
  const siteId = c.req.param("siteId")!;
  const orgId = c.req.param("orgId")!;
  const id = c.req.param("id")!;
  await requireSubsystem(subsystemId, turbineId, siteId, orgId);
  const data = c.req.valid("json");

  const component = await prisma.component.findFirst({
    where: { id, subsystem_id: subsystemId, deleted_at: null },
  });
  if (!component) throw new AssetError(404, "ASSET_004", `Component with id '${id}' not found`);

  if (data.name && data.name !== component.name) {
    const duplicate = await prisma.component.findFirst({
      where: { subsystem_id: subsystemId, name: data.name, deleted_at: null, id: { not: id } },
    });
    if (duplicate) {
      throw new AssetError(409, "ASSET_005", `Component with name '${data.name}' already exists in this subsystem`);
    }
  }

  const updated = await prisma.component.update({ where: { id }, data });
  return c.json(updated);
});

// DELETE /components/:id — soft delete
app.delete("/:id", async (c) => {
  const subsystemId = c.req.param("subsystemId")!;
  const turbineId = c.req.param("turbineId")!;
  const siteId = c.req.param("siteId")!;
  const orgId = c.req.param("orgId")!;
  const id = c.req.param("id")!;
  await requireSubsystem(subsystemId, turbineId, siteId, orgId);

  const component = await prisma.component.findFirst({
    where: { id, subsystem_id: subsystemId, deleted_at: null },
  });
  if (!component) throw new AssetError(404, "ASSET_004", `Component with id '${id}' not found`);

  await prisma.component.update({
    where: { id },
    data: { deleted_at: new Date() },
  });

  return c.json({ deleted: true, id });
});

export default app;
