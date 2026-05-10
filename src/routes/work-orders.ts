import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { paginationSchema, buildCursorQuery, paginatedResponse } from "../utils/pagination.js";
import { NotFoundError } from "../utils/errors.js";
import { authMiddleware, requireRoles, type AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

// ── Validation schemas ──────────────────────────────────────────────────────

const woStatusSchema = z.enum([
  "NEW",
  "TRIAGED",
  "ASSIGNED",
  "IN_PROGRESS",
  "PENDING_REVIEW",
  "CLOSED",
  "REOPENED",
]);

const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

const createWorkOrderSchema = z.object({
  ticketId: z.string().uuid(),
  turbineId: z.string().uuid().optional(),
  componentId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().min(1),
  priority: prioritySchema.default("MEDIUM"),
  dueDate: z.string().datetime().optional(),
  evidenceIds: z.array(z.string().uuid()).optional(),
  clientId: z.string().uuid().optional(),
});

const updateWorkOrderSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().min(1).optional(),
  priority: prioritySchema.optional(),
  dueDate: z.string().datetime().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
});

const statusTransitionSchema = z.object({
  status: woStatusSchema,
  notes: z.string().max(2000).optional(),
});

const assignSchema = z.object({
  assigneeId: z.string().uuid(),
});

const closeSchema = z.object({
  resolutionNotes: z.string().min(1),
  evidenceIds: z.array(z.string().uuid()).optional(),
});

const reopenSchema = z.object({
  reason: z.string().min(1).max(2000),
});

const linkEvidenceSchema = z.object({
  evidenceIds: z.array(z.string().uuid()).min(1),
});

const listQuerySchema = paginationSchema.extend({
  ticketId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  turbineId: z.string().uuid().optional(),
  status: woStatusSchema.optional(),
  priority: prioritySchema.optional(),
});

// ── State machine (same as tickets) ────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, Set<string>> = {
  NEW: new Set(["TRIAGED"]),
  TRIAGED: new Set(["ASSIGNED"]),
  ASSIGNED: new Set(["IN_PROGRESS"]),
  IN_PROGRESS: new Set(["PENDING_REVIEW"]),
  PENDING_REVIEW: new Set(["CLOSED", "IN_PROGRESS"]),
  CLOSED: new Set(["REOPENED"]),
  REOPENED: new Set(["TRIAGED"]),
};

// ── Shared includes ─────────────────────────────────────────────────────────

const woInclude = {
  ticket: { select: { id: true, title: true, status: true } },
  assignee: { select: { id: true, first_name: true, last_name: true } },
  creator: { select: { id: true, first_name: true, last_name: true } },
  turbine: { select: { id: true, name: true } },
  component: { select: { id: true, name: true } },
};

// ── Routes ──────────────────────────────────────────────────────────────────

// GET /work-orders — list with filters and cursor pagination
app.get("/", zValidator("query", listQuerySchema), async (c) => {
  const { cursor, limit, ticketId, assigneeId, turbineId, status, priority } =
    c.req.valid("query");

  const where: Record<string, unknown> = { deleted_at: null };
  if (ticketId) where.ticket_id = ticketId;
  if (assigneeId) where.assignee_id = assigneeId;
  if (turbineId) where.turbine_id = turbineId;
  if (status) where.status = status;
  if (priority) where.priority = priority;

  const items = await prisma.workOrder.findMany({
    where,
    take: limit + 1,
    orderBy: { created_at: "desc" },
    include: {
      ...woInclude,
      _count: { select: { work_order_evidence: true } },
    },
    ...buildCursorQuery(cursor),
  });

  return c.json(paginatedResponse(items, limit));
});

// POST /work-orders — create work order from ticket
app.post(
  "/",
  authMiddleware(),
  requireRoles("DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER"),
  zValidator("json", createWorkOrderSchema),
  async (c) => {
    const data = c.req.valid("json");
    const user = c.get("user");

    // Idempotency check
    if (data.clientId) {
      const existing = await prisma.workOrder.findFirst({
        where: { client_id: data.clientId },
      });
      if (existing) return c.json(existing, 200);
    }

    // Validate ticket exists
    const ticket = await prisma.ticket.findFirst({
      where: { id: data.ticketId, deleted_at: null },
    });
    if (!ticket) throw new NotFoundError("Ticket", data.ticketId);

    // Validate turbine if provided
    if (data.turbineId) {
      const turbine = await prisma.turbine.findFirst({
        where: { id: data.turbineId, deleted_at: null },
      });
      if (!turbine) throw new NotFoundError("Turbine", data.turbineId);
    }

    // Validate component if provided
    if (data.componentId) {
      const component = await prisma.component.findFirst({
        where: { id: data.componentId, deleted_at: null },
      });
      if (!component) throw new NotFoundError("Component", data.componentId);
    }

    // Validate assignee if provided
    if (data.assigneeId) {
      const assignee = await prisma.user.findFirst({
        where: { id: data.assigneeId, is_active: true, deleted_at: null },
      });
      if (!assignee) throw new NotFoundError("User", data.assigneeId);
    }

    const wo = await prisma.workOrder.create({
      data: {
        ticket_id: data.ticketId,
        turbine_id: data.turbineId ?? ticket.turbine_id ?? null,
        component_id: data.componentId ?? ticket.component_id ?? null,
        assignee_id: data.assigneeId ?? null,
        created_by: user.userId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        due_date: data.dueDate ? new Date(data.dueDate) : null,
        client_id: data.clientId ?? null,
        status: "NEW",
      },
      include: woInclude,
    });

    if (data.evidenceIds?.length) {
      await prisma.workOrderEvidence.createMany({
        data: data.evidenceIds.map((eid) => ({
          work_order_id: wo.id,
          evidence_id: eid,
          linked_by: user.userId,
        })),
      });
    }

    await prisma.auditEvent.create({
      data: {
        entity_type: "WORK_ORDER",
        entity_id: wo.id,
        action: "CREATE",
        user_id: user.userId,
        after_state: { status: "NEW", priority: data.priority },
      },
    });

    return c.json(wo, 201);
  },
);

// GET /work-orders/:id — full detail
app.get("/:id", async (c) => {
  const id = c.req.param("id");

  const wo = await prisma.workOrder.findFirst({
    where: { id, deleted_at: null },
    include: {
      ...woInclude,
      work_order_evidence: {
        include: {
          evidence: { select: { id: true, media_type: true, thumbnail_url: true } },
        },
      },
    },
  });
  if (!wo) throw new NotFoundError("WorkOrder", id);

  const auditEvents = await prisma.auditEvent.findMany({
    where: { entity_type: "WORK_ORDER", entity_id: id },
    orderBy: { created_at: "asc" },
    include: { user: { select: { id: true, first_name: true, last_name: true } } },
  });

  return c.json({ ...wo, audit_events: auditEvents });
});

// PUT /work-orders/:id — update fields
app.put(
  "/:id",
  authMiddleware(),
  requireRoles("DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER"),
  zValidator("json", updateWorkOrderSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const user = c.get("user");

    const wo = await prisma.workOrder.findFirst({
      where: { id, deleted_at: null },
    });
    if (!wo) throw new NotFoundError("WorkOrder", id);

    // Validate assignee if changing
    if (data.assigneeId) {
      const assignee = await prisma.user.findFirst({
        where: { id: data.assigneeId, is_active: true, deleted_at: null },
      });
      if (!assignee) throw new NotFoundError("User", data.assigneeId);
    }

    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.dueDate !== undefined
          ? { due_date: data.dueDate ? new Date(data.dueDate) : null }
          : {}),
        ...(data.assigneeId !== undefined ? { assignee_id: data.assigneeId } : {}),
      },
      include: woInclude,
    });

    await prisma.auditEvent.create({
      data: {
        entity_type: "WORK_ORDER",
        entity_id: id,
        action: "UPDATE",
        user_id: user.userId,
        before_state: {
          title: wo.title,
          priority: wo.priority,
          assignee_id: wo.assignee_id,
        },
        after_state: {
          title: updated.title,
          priority: updated.priority,
          assignee_id: updated.assignee_id,
        },
      },
    });

    return c.json(updated);
  },
);

// PATCH /work-orders/:id/status — transition status
app.patch(
  "/:id/status",
  authMiddleware(),
  requireRoles("DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER", "TECHNICIAN"),
  zValidator("json", statusTransitionSchema),
  async (c) => {
    const id = c.req.param("id");
    const { status: newStatus, notes } = c.req.valid("json");
    const user = c.get("user");

    const wo = await prisma.workOrder.findFirst({
      where: { id, deleted_at: null },
    });
    if (!wo) throw new NotFoundError("WorkOrder", id);

    const allowed = VALID_TRANSITIONS[wo.status];
    if (!allowed || !allowed.has(newStatus)) {
      return c.json(
        {
          error: `Invalid transition: ${wo.status} → ${newStatus}`,
          code: "WO_001",
        },
        422,
      );
    }

    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === "IN_PROGRESS") updateData.started_at = new Date();
    if (newStatus === "CLOSED") updateData.completed_at = new Date();

    const updated = await prisma.workOrder.update({
      where: { id },
      data: updateData,
      include: woInclude,
    });

    await prisma.auditEvent.create({
      data: {
        entity_type: "WORK_ORDER",
        entity_id: id,
        action: "STATUS_CHANGE",
        user_id: user.userId,
        before_state: { status: wo.status },
        after_state: { status: newStatus },
        metadata: notes ? { notes } : undefined,
      },
    });

    return c.json(updated);
  },
);

// POST /work-orders/:id/assign — assign technician
app.post(
  "/:id/assign",
  authMiddleware(),
  requireRoles("DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER"),
  zValidator("json", assignSchema),
  async (c) => {
    const id = c.req.param("id");
    const { assigneeId } = c.req.valid("json");
    const user = c.get("user");

    const wo = await prisma.workOrder.findFirst({
      where: { id, deleted_at: null },
    });
    if (!wo) throw new NotFoundError("WorkOrder", id);

    const assignee = await prisma.user.findFirst({
      where: { id: assigneeId, is_active: true, deleted_at: null },
    });
    if (!assignee) throw new NotFoundError("User", assigneeId);

    const status = ["NEW", "TRIAGED"].includes(wo.status) ? "ASSIGNED" : wo.status;

    const updated = await prisma.workOrder.update({
      where: { id },
      data: { assignee_id: assigneeId, status },
      include: woInclude,
    });

    await prisma.auditEvent.create({
      data: {
        entity_type: "WORK_ORDER",
        entity_id: id,
        action: "ASSIGN",
        user_id: user.userId,
        before_state: { assignee_id: wo.assignee_id },
        after_state: { assignee_id: assigneeId },
      },
    });

    return c.json(updated);
  },
);

// POST /work-orders/:id/close — close with resolution
app.post(
  "/:id/close",
  authMiddleware(),
  requireRoles("DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER", "TECHNICIAN"),
  zValidator("json", closeSchema),
  async (c) => {
    const id = c.req.param("id");
    const { resolutionNotes, evidenceIds } = c.req.valid("json");
    const user = c.get("user");

    const wo = await prisma.workOrder.findFirst({
      where: { id, deleted_at: null },
    });
    if (!wo) throw new NotFoundError("WorkOrder", id);

    if (wo.status !== "PENDING_REVIEW" && wo.status !== "IN_PROGRESS") {
      return c.json(
        { error: "Work order must be in PENDING_REVIEW or IN_PROGRESS to close", code: "WO_002" },
        409,
      );
    }

    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        status: "CLOSED",
        completed_at: new Date(),
        resolution_notes: resolutionNotes,
      },
      include: woInclude,
    });

    if (evidenceIds?.length) {
      await prisma.workOrderEvidence.createMany({
        data: evidenceIds.map((eid) => ({
          work_order_id: id,
          evidence_id: eid,
          linked_by: user.userId,
        })),
      });
    }

    await prisma.auditEvent.create({
      data: {
        entity_type: "WORK_ORDER",
        entity_id: id,
        action: "STATUS_CHANGE",
        user_id: user.userId,
        before_state: { status: wo.status },
        after_state: { status: "CLOSED", resolution_notes: resolutionNotes },
      },
    });

    return c.json(updated);
  },
);

// POST /work-orders/:id/reopen — reopen closed work order
app.post(
  "/:id/reopen",
  authMiddleware(),
  requireRoles("DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER"),
  zValidator("json", reopenSchema),
  async (c) => {
    const id = c.req.param("id");
    const { reason } = c.req.valid("json");
    const user = c.get("user");

    const wo = await prisma.workOrder.findFirst({
      where: { id, deleted_at: null },
    });
    if (!wo) throw new NotFoundError("WorkOrder", id);

    if (wo.status !== "CLOSED") {
      return c.json(
        { error: "Only CLOSED work orders can be reopened", code: "WO_003" },
        422,
      );
    }

    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        status: "REOPENED",
        completed_at: null,
        resolution_notes: null,
      },
      include: woInclude,
    });

    await prisma.auditEvent.create({
      data: {
        entity_type: "WORK_ORDER",
        entity_id: id,
        action: "STATUS_CHANGE",
        user_id: user.userId,
        before_state: { status: "CLOSED" },
        after_state: { status: "REOPENED" },
        metadata: { reason },
      },
    });

    return c.json(updated);
  },
);

// POST /work-orders/:id/evidence — link evidence
app.post(
  "/:id/evidence",
  authMiddleware(),
  requireRoles("TECHNICIAN", "DISPATCHER", "QA_REVIEWER", "ADMINISTRATOR"),
  zValidator("json", linkEvidenceSchema),
  async (c) => {
    const id = c.req.param("id");
    const { evidenceIds } = c.req.valid("json");
    const user = c.get("user");

    const wo = await prisma.workOrder.findFirst({
      where: { id, deleted_at: null },
    });
    if (!wo) throw new NotFoundError("WorkOrder", id);

    await prisma.workOrderEvidence.createMany({
      data: evidenceIds.map((eid) => ({
        work_order_id: id,
        evidence_id: eid,
        linked_by: user.userId,
      })),
      skipDuplicates: true,
    });

    await prisma.auditEvent.create({
      data: {
        entity_type: "WORK_ORDER",
        entity_id: id,
        action: "UPDATE",
        user_id: user.userId,
        metadata: { linked_evidence: evidenceIds },
      },
    });

    const updated = await prisma.workOrder.findFirst({
      where: { id, deleted_at: null },
      include: {
        work_order_evidence: {
          include: {
            evidence: { select: { id: true, media_type: true, thumbnail_url: true } },
          },
        },
      },
    });

    return c.json(updated);
  },
);

// DELETE /work-orders/:id — soft delete
app.delete(
  "/:id",
  authMiddleware(),
  requireRoles("ADMINISTRATOR", "OPERATIONS_MANAGER"),
  async (c) => {
    const id = c.req.param("id")!;
    const user = c.get("user");

    const wo = await prisma.workOrder.findFirst({
      where: { id, deleted_at: null },
    });
    if (!wo) throw new NotFoundError("WorkOrder", id);

    await prisma.workOrder.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    await prisma.auditEvent.create({
      data: {
        entity_type: "WORK_ORDER",
        entity_id: id,
        action: "DELETE",
        user_id: user.userId,
        before_state: { status: wo.status, title: wo.title },
      },
    });

    return c.json({ deleted: true, id });
  },
);

// GET /work-orders/:id/audit-trail — full audit events
app.get("/:id/audit-trail", async (c) => {
  const id = c.req.param("id");

  const wo = await prisma.workOrder.findFirst({
    where: { id, deleted_at: null },
  });
  if (!wo) throw new NotFoundError("WorkOrder", id);

  const events = await prisma.auditEvent.findMany({
    where: { entity_type: "WORK_ORDER", entity_id: id },
    orderBy: { created_at: "desc" },
    include: { user: { select: { id: true, first_name: true, last_name: true } } },
  });

  return c.json({
    data: events.map((e) => ({
      id: e.id,
      action: e.action,
      userId: e.user_id,
      userName: e.user ? `${e.user.first_name} ${e.user.last_name}` : null,
      details: {
        ...((e.before_state as Record<string, unknown>) ?? {}),
        ...((e.after_state as Record<string, unknown>) ?? {}),
      },
      metadata: e.metadata,
      timestamp: e.created_at,
    })),
  });
});

export default app;
