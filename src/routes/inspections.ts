import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { paginationSchema, buildCursorQuery, paginatedResponse } from "../utils/pagination.js";
import { NotFoundError } from "../utils/errors.js";
import { authMiddleware, requireRoles, type AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

// ── Validation schemas ──────────────────────────────────────────────────────

const inspectionStatusSchema = z.enum([
  "ASSIGNED",
  "IN_PROGRESS",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
]);

const fieldDataTypeSchema = z.enum([
  "TEXT",
  "NUMERIC",
  "PASS_FAIL",
  "DROPDOWN",
  "PHOTO",
  "VIDEO",
  "ANNOTATION",
  "SIGNATURE",
]);

const fieldValueSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.record(z.unknown()), z.null()]),
  type: fieldDataTypeSchema.optional(),
});

const createInspectionSchema = z.object({
  templateVersionId: z.string().uuid(),
  technicianId: z.string().uuid(),
  turbineId: z.string().uuid(),
  componentId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  clientId: z.string().uuid().optional(),
});

const updateInspectionSchema = z.object({
  fieldData: z.record(fieldValueSchema).optional(),
  status: z.enum(["IN_PROGRESS"]).optional(),
});

const submitSchema = z.object({
  notes: z.string().max(2000).optional(),
});

const approveSchema = z.object({
  notes: z.string().max(2000).optional(),
});

const rejectSchema = z.object({
  action: z.enum(["REJECT", "REQUEST_CHANGES"]),
  notes: z.string().max(2000).optional(),
});

const listQuerySchema = paginationSchema.extend({
  assigneeId: z.string().uuid().optional(),
  turbineId: z.string().uuid().optional(),
  componentId: z.string().uuid().optional(),
  status: inspectionStatusSchema.optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
});

// ── Constants ────────────────────────────────────────────────────────────────

const EDITABLE_STATUSES = new Set(["ASSIGNED", "IN_PROGRESS", "CHANGES_REQUESTED"]);

// ── Routes ──────────────────────────────────────────────────────────────────

// GET /inspections — list with filters and cursor pagination
app.get("/", zValidator("query", listQuerySchema), async (c) => {
  const {
    cursor,
    limit,
    assigneeId,
    turbineId,
    componentId,
    status,
    createdAfter,
    createdBefore,
  } = c.req.valid("query");

  const where: Record<string, unknown> = { deleted_at: null };
  if (assigneeId) where.technician_id = assigneeId;
  if (turbineId) where.turbine_id = turbineId;
  if (componentId) where.component_id = componentId;
  if (status) where.status = status;
  if (createdAfter || createdBefore) {
    where.created_at = {
      ...(createdAfter ? { gte: new Date(createdAfter) } : {}),
      ...(createdBefore ? { lte: new Date(createdBefore) } : {}),
    };
  }

  const items = await prisma.inspectionRecord.findMany({
    where,
    take: limit + 1,
    orderBy: { created_at: "desc" },
    include: {
      technician: { select: { id: true, first_name: true, last_name: true } },
      turbine: { select: { id: true, name: true } },
      component: { select: { id: true, name: true } },
      template_version: {
        select: { version: true, template: { select: { id: true, name: true } } },
      },
      _count: { select: { defects: true } },
    },
    ...buildCursorQuery(cursor),
  });

  return c.json(paginatedResponse(items, limit));
});

// POST /inspections — create inspection record
app.post(
  "/",
  authMiddleware(),
  requireRoles("TECHNICIAN", "DISPATCHER", "ADMINISTRATOR"),
  zValidator("json", createInspectionSchema),
  async (c) => {
    const {
      templateVersionId,
      technicianId,
      turbineId,
      componentId,
      dueDate,
      clientId,
    } = c.req.valid("json");

    if (clientId) {
      const existing = await prisma.inspectionRecord.findFirst({
        where: { client_id: clientId },
      });
      if (existing) return c.json(existing, 200);
    }

    const templateVersion = await prisma.inspectionTemplateVersion.findFirst({
      where: { id: templateVersionId },
    });
    if (!templateVersion) throw new NotFoundError("InspectionTemplateVersion", templateVersionId);

    const technician = await prisma.user.findFirst({
      where: { id: technicianId, is_active: true, deleted_at: null },
    });
    if (!technician) throw new NotFoundError("User", technicianId);

    const turbine = await prisma.turbine.findFirst({
      where: { id: turbineId, deleted_at: null },
    });
    if (!turbine) throw new NotFoundError("Turbine", turbineId);

    const record = await prisma.inspectionRecord.create({
      data: {
        template_version_id: templateVersionId,
        technician_id: technicianId,
        turbine_id: turbineId,
        component_id: componentId ?? null,
        due_date: dueDate ? new Date(dueDate) : null,
        client_id: clientId ?? null,
        status: "ASSIGNED",
      },
      include: {
        technician: { select: { id: true, first_name: true, last_name: true } },
        turbine: { select: { id: true, name: true } },
        template_version: {
          select: { version: true, template: { select: { id: true, name: true } } },
        },
      },
    });

    const user = c.get("user");
    await prisma.auditEvent.create({
      data: {
        entity_type: "InspectionRecord",
        entity_id: record.id,
        action: "CREATE",
        user_id: user?.userId ?? "system",
        after_state: { status: record.status, technician_id: technicianId, turbine_id: turbineId },
      },
    });

    return c.json(record, 201);
  }
);

// GET /inspections/:id — full inspection record with field data
app.get("/:id", async (c) => {
  const id = c.req.param("id");

  const record = await prisma.inspectionRecord.findFirst({
    where: { id, deleted_at: null },
    include: {
      technician: { select: { id: true, first_name: true, last_name: true } },
      reviewer: { select: { id: true, first_name: true, last_name: true } },
      turbine: { select: { id: true, name: true } },
      component: { select: { id: true, name: true } },
      template_version: {
        select: { version: true, template: { select: { id: true, name: true } } },
      },
      field_data: true,
      defects: { select: { id: true, severity: true, description: true } },
      evidence: { select: { id: true, media_type: true, thumbnail_url: true } },
    },
  });
  if (!record) throw new NotFoundError("InspectionRecord", id);

  return c.json(record);
});

// PUT /inspections/:id — update field data (only in editable statuses)
app.put(
  "/:id",
  authMiddleware(),
  zValidator("json", updateInspectionSchema),
  async (c) => {
    const id = c.req.param("id");
    const { fieldData, status } = c.req.valid("json");

    const record = await prisma.inspectionRecord.findFirst({
      where: { id, deleted_at: null },
    });
    if (!record) throw new NotFoundError("InspectionRecord", id);

    if (!EDITABLE_STATUSES.has(record.status)) {
      return c.json(
        { error: `Cannot update inspection in status: ${record.status}`, code: "INSP_002" },
        409,
      );
    }

    const updateData: Record<string, unknown> = {};

    if (status === "IN_PROGRESS" && record.status === "ASSIGNED") {
      updateData.status = "IN_PROGRESS";
      updateData.started_at = new Date();
    }

    if (fieldData) {
      const upserts = Object.entries(fieldData).map(([key, fv]) => {
        const type = fv.type ?? "TEXT";
        const data: Record<string, unknown> = { field_type: type };

        if (typeof fv.value === "string") data.value_string = fv.value;
        else if (typeof fv.value === "number") data.value_numeric = fv.value;
        else if (typeof fv.value === "boolean") data.value_boolean = fv.value;
        else if (fv.value !== null && typeof fv.value === "object")
          data.value_json = fv.value;
        else data.value_string = fv.value === null ? null : String(fv.value);

        return prisma.inspectionFieldData.upsert({
          where: {
            inspection_id_field_key: { inspection_id: id, field_key: key },
          },
          create: { inspection_id: id, field_key: key, field_type: type, ...data },
          update: data,
        });
      });

      await Promise.all(upserts);
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.inspectionRecord.update({ where: { id }, data: updateData });
    }

    const user = c.get("user");
    await prisma.auditEvent.create({
      data: {
        entity_type: "InspectionRecord",
        entity_id: id,
        action: "UPDATE",
        user_id: user?.userId ?? "system",
        before_state: { status: record.status },
        after_state: updateData.status ? { status: updateData.status } : { status: record.status, field_data_updated: !!fieldData },
      },
    });

    const updated = await prisma.inspectionRecord.findFirst({
      where: { id, deleted_at: null },
      include: {
        technician: { select: { id: true, first_name: true, last_name: true } },
        turbine: { select: { id: true, name: true } },
        template_version: {
          select: { version: true, template: { select: { id: true, name: true } } },
        },
        field_data: true,
      },
    });

    return c.json(updated);
  }
);

// POST /inspections/:id/submit — submit for review
app.post(
  "/:id/submit",
  authMiddleware(),
  zValidator("json", submitSchema),
  async (c) => {
    const id = c.req.param("id");
    const { notes } = c.req.valid("json");

    const record = await prisma.inspectionRecord.findFirst({
      where: { id, deleted_at: null },
    });
    if (!record) throw new NotFoundError("InspectionRecord", id);

    if (record.status !== "IN_PROGRESS" && record.status !== "CHANGES_REQUESTED") {
      return c.json(
        { error: `Cannot submit inspection in status: ${record.status}`, code: "INSP_002" },
        409,
      );
    }

    const updated = await prisma.inspectionRecord.update({
      where: { id },
      data: {
        status: "SUBMITTED",
        submitted_at: new Date(),
        completed_at: new Date(),
        ...(notes ? { review_notes: notes } : {}),
      },
      include: {
        technician: { select: { id: true, first_name: true, last_name: true } },
        turbine: { select: { id: true, name: true } },
        template_version: {
          select: { version: true, template: { select: { id: true, name: true } } },
        },
      },
    });

    const user = c.get("user");
    await prisma.auditEvent.create({
      data: {
        entity_type: "InspectionRecord",
        entity_id: id,
        action: "STATUS_CHANGE",
        user_id: user?.userId ?? "system",
        before_state: { status: record.status },
        after_state: { status: "SUBMITTED" },
      },
    });

    return c.json(updated);
  }
);

// POST /inspections/:id/approve — QA approve
app.post(
  "/:id/approve",
  authMiddleware(),
  requireRoles("QA_REVIEWER", "ADMINISTRATOR"),
  zValidator("json", approveSchema),
  async (c) => {
    const id = c.req.param("id");
    const { notes } = c.req.valid("json");
    const user = c.get("user");

    const record = await prisma.inspectionRecord.findFirst({
      where: { id, deleted_at: null },
    });
    if (!record) throw new NotFoundError("InspectionRecord", id);

    if (record.status !== "SUBMITTED") {
      return c.json(
        { error: "Can only approve submitted inspections", code: "INSP_002" },
        409,
      );
    }

    const updated = await prisma.inspectionRecord.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewed_by: user.userId,
        reviewed_at: new Date(),
        ...(notes ? { review_notes: notes } : {}),
      },
      include: {
        technician: { select: { id: true, first_name: true, last_name: true } },
        reviewer: { select: { id: true, first_name: true, last_name: true } },
        turbine: { select: { id: true, name: true } },
        template_version: {
          select: { version: true, template: { select: { id: true, name: true } } },
        },
      },
    });

    await prisma.auditEvent.create({
      data: {
        entity_type: "InspectionRecord",
        entity_id: id,
        action: "APPROVE",
        user_id: user.userId,
        before_state: { status: record.status },
        after_state: { status: "APPROVED", reviewed_by: user.userId },
      },
    });

    return c.json(updated);
  }
);

// POST /inspections/:id/reject — QA reject or request changes
app.post(
  "/:id/reject",
  authMiddleware(),
  requireRoles("QA_REVIEWER", "ADMINISTRATOR"),
  zValidator("json", rejectSchema),
  async (c) => {
    const id = c.req.param("id");
    const { action, notes } = c.req.valid("json");
    const user = c.get("user");

    const record = await prisma.inspectionRecord.findFirst({
      where: { id, deleted_at: null },
    });
    if (!record) throw new NotFoundError("InspectionRecord", id);

    if (record.status !== "SUBMITTED") {
      return c.json(
        { error: "Can only reject submitted inspections", code: "INSP_002" },
        409,
      );
    }

    const newStatus = action === "REQUEST_CHANGES" ? "CHANGES_REQUESTED" : "REJECTED";

    const updated = await prisma.inspectionRecord.update({
      where: { id },
      data: {
        status: newStatus,
        reviewed_by: user.userId,
        reviewed_at: new Date(),
        ...(notes ? { review_notes: notes } : {}),
      },
      include: {
        technician: { select: { id: true, first_name: true, last_name: true } },
        reviewer: { select: { id: true, first_name: true, last_name: true } },
        turbine: { select: { id: true, name: true } },
        template_version: {
          select: { version: true, template: { select: { id: true, name: true } } },
        },
      },
    });

    await prisma.auditEvent.create({
      data: {
        entity_type: "InspectionRecord",
        entity_id: id,
        action: "REJECT",
        user_id: user.userId,
        before_state: { status: record.status },
        after_state: { status: newStatus, reviewed_by: user.userId },
      },
    });

    return c.json(updated);
  }
);

export default app;
