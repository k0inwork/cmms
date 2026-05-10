import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { paginationSchema, buildCursorQuery, paginatedResponse } from "../utils/pagination.js";
import { AssetError } from "../utils/errors.js";

const app = new Hono();

// IEC 61400-25 compliant turbine name: alphanumeric, dashes, underscores, dots
const turbineNameSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9_.\- ]*$/,
    "Turbine name must start with alphanumeric and contain only letters, numbers, underscores, dots, dashes, or spaces"
  );

const createTurbineSchema = z.object({
  name: turbineNameSchema,
  status: z.enum(["ACTIVE", "DECOMMISSIONED", "MAINTENANCE", "PLANNED"]).default("ACTIVE"),
  model: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

const updateTurbineSchema = z
  .object({
    name: turbineNameSchema.optional(),
    status: z.enum(["ACTIVE", "DECOMMISSIONED", "MAINTENANCE", "PLANNED"]).optional(),
    model: z.string().max(200).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

// ── Site existence helper ────────────────────────────────────────────────────

async function requireSite(siteId: string, orgId: string) {
  const site = await prisma.site.findFirst({
    where: { id: siteId, organization_id: orgId, deleted_at: null },
  });
  if (!site) throw new AssetError(404, "ASSET_004", `Site with id '${siteId}' not found`);
  return site;
}

// ── Routes ──────────────────────────────────────────────────────────────────

// GET /turbines — list with cursor pagination
app.get("/", zValidator("query", paginationSchema), async (c) => {
  const siteId = c.req.param("siteId")!;
  const orgId = c.req.param("orgId")!;
  await requireSite(siteId, orgId);
  const { cursor, limit } = c.req.valid("query");

  const items = await prisma.turbine.findMany({
    where: { site_id: siteId, deleted_at: null },
    take: limit + 1,
    orderBy: { created_at: "desc" },
    ...buildCursorQuery(cursor),
  });

  return c.json(paginatedResponse(items, limit));
});

// POST /turbines — create
app.post("/", zValidator("json", createTurbineSchema), async (c) => {
  const siteId = c.req.param("siteId")!;
  const orgId = c.req.param("orgId")!;
  await requireSite(siteId, orgId);
  const { name, status, model, latitude, longitude } = c.req.valid("json");

  const existing = await prisma.turbine.findFirst({
    where: { site_id: siteId, name, deleted_at: null },
  });
  if (existing) {
    throw new AssetError(409, "ASSET_005", `Turbine with name '${name}' already exists in this site`);
  }

  const turbine = await prisma.turbine.create({
    data: { name, status, model, latitude, longitude, site_id: siteId },
  });
  return c.json(turbine, 201);
});

// GET /turbines/:id — single
app.get("/:id", async (c) => {
  const siteId = c.req.param("siteId")!;
  const orgId = c.req.param("orgId")!;
  const id = c.req.param("id")!;
  await requireSite(siteId, orgId);

  const turbine = await prisma.turbine.findFirst({
    where: { id, site_id: siteId, deleted_at: null },
  });
  if (!turbine) throw new AssetError(404, "ASSET_004", `Turbine with id '${id}' not found`);

  return c.json(turbine);
});

// PATCH /turbines/:id — update
app.patch("/:id", zValidator("json", updateTurbineSchema), async (c) => {
  const siteId = c.req.param("siteId")!;
  const orgId = c.req.param("orgId")!;
  const id = c.req.param("id")!;
  await requireSite(siteId, orgId);
  const data = c.req.valid("json");

  const turbine = await prisma.turbine.findFirst({
    where: { id, site_id: siteId, deleted_at: null },
  });
  if (!turbine) throw new AssetError(404, "ASSET_004", `Turbine with id '${id}' not found`);

  if (data.name && data.name !== turbine.name) {
    const duplicate = await prisma.turbine.findFirst({
      where: { site_id: siteId, name: data.name, deleted_at: null, id: { not: id } },
    });
    if (duplicate) {
      throw new AssetError(409, "ASSET_005", `Turbine with name '${data.name}' already exists in this site`);
    }
  }

  const updated = await prisma.turbine.update({ where: { id }, data });
  return c.json(updated);
});

// DELETE /turbines/:id — soft delete
app.delete("/:id", async (c) => {
  const siteId = c.req.param("siteId")!;
  const orgId = c.req.param("orgId")!;
  const id = c.req.param("id")!;
  await requireSite(siteId, orgId);

  const turbine = await prisma.turbine.findFirst({
    where: { id, site_id: siteId, deleted_at: null },
  });
  if (!turbine) throw new AssetError(404, "ASSET_004", `Turbine with id '${id}' not found`);

  await prisma.turbine.update({
    where: { id },
    data: { deleted_at: new Date() },
  });

  return c.json({ deleted: true, id });
});

export default app;
