import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import type { Prisma } from "@prisma/client";
import { paginationSchema, buildCursorQuery, paginatedResponse } from "../utils/pagination.js";
import { NotFoundError, ConflictError } from "../utils/errors.js";
import { authMiddleware, requireRoles, type AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

// ── Validation schemas ──────────────────────────────────────────────────────

const fieldTypeSchema = z.enum([
  "TEXT",
  "NUMERIC",
  "PASS_FAIL",
  "DROPDOWN",
  "PHOTO",
  "VIDEO",
  "SIGNATURE",
]);

const fieldSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  type: fieldTypeSchema,
  required: z.boolean().default(false),
  config: z.record(z.unknown()).optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  inspection_type: z.string().max(100).optional(),
  turbine_model: z.string().max(100).optional(),
  site_id: z.string().uuid().optional(),
  fields: z.array(fieldSchema).min(1),
  changelog: z.string().max(1000).optional(),
});

const updateTemplateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    inspection_type: z.string().max(100).nullable().optional(),
    turbine_model: z.string().max(100).nullable().optional(),
    site_id: z.string().uuid().nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

const createVersionSchema = z.object({
  fields: z.array(fieldSchema).min(1),
  changelog: z.string().max(1000).optional(),
});

// ── Routes ──────────────────────────────────────────────────────────────────

// GET /templates — list with cursor pagination
app.get("/", zValidator("query", paginationSchema), async (c) => {
  const { cursor, limit } = c.req.valid("query");

  const items = await prisma.inspectionTemplate.findMany({
    where: { deleted_at: null },
    take: limit + 1,
    orderBy: { created_at: "desc" },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
    ...buildCursorQuery(cursor),
  });

  return c.json(paginatedResponse(items, limit));
});

// GET /templates/:id — single template with latest version
app.get("/:id", async (c) => {
  const id = c.req.param("id");

  const template = await prisma.inspectionTemplate.findFirst({
    where: { id, deleted_at: null },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!template) throw new NotFoundError("InspectionTemplate", id);

  return c.json(template);
});

// POST /templates — create template + initial version (admin-only)
app.post(
  "/",
  authMiddleware(),
  requireRoles("ADMINISTRATOR"),
  zValidator("json", createTemplateSchema),
  async (c) => {
    const { fields, changelog, ...templateData } = c.req.valid("json");
    const user = c.get("user");

    const existing = await prisma.inspectionTemplate.findFirst({
      where: { name: templateData.name, deleted_at: null },
    });
    if (existing) {
      throw new ConflictError(`Inspection template with name '${templateData.name}' already exists`);
    }

    const template = await prisma.inspectionTemplate.create({
      data: {
        ...templateData,
        versions: {
          create: {
            version: 1,
            schema: fields as unknown as Prisma.InputJsonValue,
            changelog: changelog ?? "Initial version",
            created_by: user.userId,
          },
        },
      },
      include: {
        versions: { orderBy: { version: "desc" }, take: 1 },
      },
    });

    return c.json(template, 201);
  }
);

// PATCH /templates/:id — update template metadata (admin-only)
app.patch(
  "/:id",
  authMiddleware(),
  requireRoles("ADMINISTRATOR"),
  zValidator("json", updateTemplateSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const template = await prisma.inspectionTemplate.findFirst({
      where: { id, deleted_at: null },
    });
    if (!template) throw new NotFoundError("InspectionTemplate", id);

    if (data.name && data.name !== template.name) {
      const duplicate = await prisma.inspectionTemplate.findFirst({
        where: { name: data.name, deleted_at: null, id: { not: id } },
      });
      if (duplicate) {
        throw new ConflictError(`Inspection template with name '${data.name}' already exists`);
      }
    }

    const updated = await prisma.inspectionTemplate.update({
      where: { id },
      data,
      include: {
        versions: { orderBy: { version: "desc" }, take: 1 },
      },
    });
    return c.json(updated);
  }
);

// DELETE /templates/:id — soft delete (admin-only)
app.delete(
  "/:id",
  authMiddleware(),
  requireRoles("ADMINISTRATOR"),
  async (c) => {
    const id = c.req.param("id");

    const template = await prisma.inspectionTemplate.findFirst({
      where: { id, deleted_at: null },
    });
    if (!template) throw new NotFoundError("InspectionTemplate", id!);

    await prisma.inspectionTemplate.update({
      where: { id: id! },
      data: { deleted_at: new Date(), is_active: false },
    });

    return c.json({ deleted: true, id: id! });
  }
);

// GET /templates/:id/versions — list all versions
app.get("/:id/versions", zValidator("query", paginationSchema), async (c) => {
  const templateId = c.req.param("id");
  const { cursor, limit } = c.req.valid("query");

  const template = await prisma.inspectionTemplate.findFirst({
    where: { id: templateId, deleted_at: null },
  });
  if (!template) throw new NotFoundError("InspectionTemplate", templateId);

  const items = await prisma.inspectionTemplateVersion.findMany({
    where: { template_id: templateId },
    take: limit + 1,
    orderBy: { version: "desc" },
    ...(cursor ? buildCursorQuery(cursor) : {}),
  });

  return c.json(paginatedResponse(items, limit));
});

// POST /templates/:id/versions — create new version (admin-only)
app.post(
  "/:id/versions",
  authMiddleware(),
  requireRoles("ADMINISTRATOR"),
  zValidator("json", createVersionSchema),
  async (c) => {
    const templateId = c.req.param("id");
    const { fields, changelog } = c.req.valid("json");
    const user = c.get("user");

    const template = await prisma.inspectionTemplate.findFirst({
      where: { id: templateId, deleted_at: null },
    });
    if (!template) throw new NotFoundError("InspectionTemplate", templateId);

    const latestVersion = await prisma.inspectionTemplateVersion.findFirst({
      where: { template_id: templateId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const nextVersion = (latestVersion?.version ?? 0) + 1;

    const version = await prisma.inspectionTemplateVersion.create({
      data: {
        template_id: templateId,
        version: nextVersion,
        schema: fields as unknown as Prisma.InputJsonValue,
        changelog: changelog ?? `Version ${nextVersion}`,
        created_by: user.userId,
      },
    });

    return c.json(version, 201);
  }
);

export default app;
