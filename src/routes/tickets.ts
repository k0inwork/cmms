import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { paginationSchema, buildCursorQuery, paginatedResponse } from "../utils/pagination.js";
import { NotFoundError } from "../utils/errors.js";
import { authMiddleware, requireRoles, type AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

// ── Validation schemas ──────────────────────────────────────────────────────

const ticketStatusSchema = z.enum([
  "NEW",
  "TRIAGED",
  "ASSIGNED",
  "IN_PROGRESS",
  "PENDING_REVIEW",
  "CLOSED",
  "REOPENED",
]);

const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const severitySchema = z.enum(["COSMETIC", "MINOR", "MAJOR", "CRITICAL", "SAFETY"]);

const createTicketSchema = z.object({
  defectId: z.string().uuid().optional(),
  turbineId: z.string().uuid().optional(),
  componentId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().min(1),
  priority: prioritySchema.default("MEDIUM"),
  severity: severitySchema.optional(),
  dueDate: z.string().datetime().optional(),
  slaTarget: z.string().datetime().optional(),
  evidenceIds: z.array(z.string().uuid()).optional(),
  clientId: z.string().uuid().optional(),
});

const statusTransitionSchema = z.object({
  status: ticketStatusSchema,
  notes: z.string().max(2000).optional(),
});

const assignSchema = z.object({
  assigneeId: z.string().uuid(),
});

const closeSchema = z.object({
  resolutionNotes: z.string().min(1),
  rootCause: z.string().optional(),
  evidenceIds: z.array(z.string().uuid()).optional(),
});

const reopenSchema = z.object({
  reason: z.string().min(1).max(2000),
});

const linkEvidenceSchema = z.object({
  evidenceIds: z.array(z.string().uuid()).min(1),
});

const listQuerySchema = paginationSchema.extend({
  status: ticketStatusSchema.optional(),
  priority: prioritySchema.optional(),
  severity: severitySchema.optional(),
  assigneeId: z.string().uuid().optional(),
  turbineId: z.string().uuid().optional(),
  defectId: z.string().uuid().optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
});

// ── State machine ────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, Set<string>> = {
  NEW: new Set(["TRIAGED"]),
  TRIAGED: new Set(["ASSIGNED"]),
  ASSIGNED: new Set(["IN_PROGRESS"]),
  IN_PROGRESS: new Set(["PENDING_REVIEW"]),
  PENDING_REVIEW: new Set(["CLOSED", "IN_PROGRESS"]),
  CLOSED: new Set(["REOPENED"]),
  REOPENED: new Set(["TRIAGED"]),
};

// ── Routes ──────────────────────────────────────────────────────────────────

// GET /tickets — list with filters and cursor pagination
app.get("/", zValidator("query", listQuerySchema), async (c) => {
  const {
    cursor,
    limit,
    status,
    priority,
    severity,
    assigneeId,
    turbineId,
    defectId,
    createdAfter,
    createdBefore,
  } = c.req.valid("query");

  const where: Record<string, unknown> = { deleted_at: null };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (severity) where.severity = severity;
  if (assigneeId) where.assignee_id = assigneeId;
  if (turbineId) where.turbine_id = turbineId;
  if (defectId) where.defect_id = defectId;
  if (createdAfter || createdBefore) {
    where.created_at = {
      ...(createdAfter ? { gte: new Date(createdAfter) } : {}),
      ...(createdBefore ? { lte: new Date(createdBefore) } : {}),
    };
  }

  const items = await prisma.ticket.findMany({
    where,
    take: limit + 1,
    orderBy: { created_at: "desc" },
    include: {
      assignee: { select: { id: true, first_name: true, last_name: true } },
      creator: { select: { id: true, first_name: true, last_name: true } },
      turbine: { select: { id: true, name: true } },
      component: { select: { id: true, name: true } },
      defect: { select: { id: true, severity: true, description: true } },
      _count: { select: { ticket_evidence: true } },
    },
    ...buildCursorQuery(cursor),
  });

  return c.json(paginatedResponse(items, limit));
});

// POST /tickets — create ticket (optionally from defect)
app.post(
  "/",
  authMiddleware(),
  requireRoles("DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER"),
  zValidator("json", createTicketSchema),
  async (c) => {
    const data = c.req.valid("json");
    const user = c.get("user");

    if (data.clientId) {
      const existing = await prisma.ticket.findFirst({
        where: { client_id: data.clientId },
      });
      if (existing) return c.json(existing, 200);
    }

    if (data.defectId) {
      const defect = await prisma.defect.findFirst({
        where: { id: data.defectId, deleted_at: null },
      });
      if (!defect) throw new NotFoundError("Defect", data.defectId);
    }

    if (data.turbineId) {
      const turbine = await prisma.turbine.findFirst({
        where: { id: data.turbineId, deleted_at: null },
      });
      if (!turbine) throw new NotFoundError("Turbine", data.turbineId);
    }

    if (data.componentId) {
      const component = await prisma.component.findFirst({
        where: { id: data.componentId, deleted_at: null },
      });
      if (!component) throw new NotFoundError("Component", data.componentId);
    }

    const ticket = await prisma.ticket.create({
      data: {
        defect_id: data.defectId ?? null,
        turbine_id: data.turbineId ?? null,
        component_id: data.componentId ?? null,
        title: data.title,
        description: data.description,
        priority: data.priority,
        severity: data.severity ?? null,
        created_by: user.userId,
        due_date: data.dueDate ? new Date(data.dueDate) : null,
        sla_target_date: data.slaTarget ? new Date(data.slaTarget) : null,
        client_id: data.clientId ?? null,
        status: "NEW",
      },
      include: {
        assignee: { select: { id: true, first_name: true, last_name: true } },
        creator: { select: { id: true, first_name: true, last_name: true } },
        turbine: { select: { id: true, name: true } },
        component: { select: { id: true, name: true } },
        defect: { select: { id: true, severity: true, description: true } },
      },
    });

    if (data.evidenceIds?.length) {
      await prisma.ticketEvidence.createMany({
        data: data.evidenceIds.map((eid) => ({
          ticket_id: ticket.id,
          evidence_id: eid,
          linked_by: user.userId,
        })),
      });
    }

    await prisma.auditEvent.create({
      data: {
        entity_type: "TICKET",
        entity_id: ticket.id,
        action: "CREATE",
        user_id: user.userId,
        after_state: { status: "NEW", priority: data.priority },
      },
    });

    return c.json(ticket, 201);
  }
);

// GET /tickets/:id — full ticket detail
app.get("/:id", async (c) => {
  const id = c.req.param("id");

  const ticket = await prisma.ticket.findFirst({
    where: { id, deleted_at: null },
    include: {
      assignee: { select: { id: true, first_name: true, last_name: true } },
      creator: { select: { id: true, first_name: true, last_name: true } },
      turbine: { select: { id: true, name: true } },
      component: { select: { id: true, name: true } },
      defect: { select: { id: true, severity: true, description: true } },
      ticket_evidence: {
        include: {
          evidence: { select: { id: true, media_type: true, thumbnail_url: true } },
        },
      },
    },
  });
  if (!ticket) throw new NotFoundError("Ticket", id);

  const auditEvents = await prisma.auditEvent.findMany({
    where: { entity_type: "TICKET", entity_id: id },
    orderBy: { created_at: "asc" },
    include: { user: { select: { id: true, first_name: true, last_name: true } } },
  });

  return c.json({ ...ticket, audit_events: auditEvents });
});

// PATCH /tickets/:id/status — transition ticket status
app.patch(
  "/:id/status",
  authMiddleware(),
  requireRoles("DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER", "TECHNICIAN"),
  zValidator("json", statusTransitionSchema),
  async (c) => {
    const id = c.req.param("id");
    const { status: newStatus, notes } = c.req.valid("json");
    const user = c.get("user");

    const ticket = await prisma.ticket.findFirst({
      where: { id, deleted_at: null },
    });
    if (!ticket) throw new NotFoundError("Ticket", id);

    const allowed = VALID_TRANSITIONS[ticket.status];
    if (!allowed || !allowed.has(newStatus)) {
      return c.json(
        {
          error: `Invalid transition: ${ticket.status} → ${newStatus}`,
          code: "TKT_001",
        },
        422,
      );
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: {
        status: newStatus,
        ...(newStatus === "CLOSED" ? { closed_at: new Date() } : {}),
      },
      include: {
        assignee: { select: { id: true, first_name: true, last_name: true } },
        creator: { select: { id: true, first_name: true, last_name: true } },
        turbine: { select: { id: true, name: true } },
        component: { select: { id: true, name: true } },
      },
    });

    await prisma.auditEvent.create({
      data: {
        entity_type: "TICKET",
        entity_id: id,
        action: "STATUS_CHANGE",
        user_id: user.userId,
        before_state: { status: ticket.status },
        after_state: { status: newStatus },
        metadata: notes ? { notes } : undefined,
      },
    });

    return c.json(updated);
  }
);

// POST /tickets/:id/assign — assign with skill validation
app.post(
  "/:id/assign",
  authMiddleware(),
  requireRoles("DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER"),
  zValidator("json", assignSchema),
  async (c) => {
    const id = c.req.param("id");
    const { assigneeId } = c.req.valid("json");
    const user = c.get("user");

    const ticket = await prisma.ticket.findFirst({
      where: { id, deleted_at: null },
    });
    if (!ticket) throw new NotFoundError("Ticket", id);

    const assignee = await prisma.user.findFirst({
      where: { id: assigneeId, is_active: true, deleted_at: null },
    });
    if (!assignee) throw new NotFoundError("User", assigneeId);

    const status = ticket.status === "NEW" ? "TRIAGED" : ticket.status;

    const updated = await prisma.ticket.update({
      where: { id },
      data: {
        assignee_id: assigneeId,
        status: ["NEW", "TRIAGED"].includes(status) ? "ASSIGNED" : status,
      },
      include: {
        assignee: { select: { id: true, first_name: true, last_name: true } },
        creator: { select: { id: true, first_name: true, last_name: true } },
        turbine: { select: { id: true, name: true } },
        component: { select: { id: true, name: true } },
      },
    });

    await prisma.auditEvent.create({
      data: {
        entity_type: "TICKET",
        entity_id: id,
        action: "ASSIGN",
        user_id: user.userId,
        before_state: { assignee_id: ticket.assignee_id },
        after_state: { assignee_id: assigneeId },
      },
    });

    return c.json(updated);
  }
);

// POST /tickets/:id/close — close with resolution
app.post(
  "/:id/close",
  authMiddleware(),
  requireRoles("DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER", "TECHNICIAN"),
  zValidator("json", closeSchema),
  async (c) => {
    const id = c.req.param("id");
    const { resolutionNotes, rootCause, evidenceIds } = c.req.valid("json");
    const user = c.get("user");

    const ticket = await prisma.ticket.findFirst({
      where: { id, deleted_at: null },
    });
    if (!ticket) throw new NotFoundError("Ticket", id);

    if (ticket.status !== "PENDING_REVIEW" && ticket.status !== "IN_PROGRESS") {
      return c.json(
        { error: "Ticket must be in PENDING_REVIEW or IN_PROGRESS status to close", code: "TKT_002" },
        409,
      );
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: {
        status: "CLOSED",
        closed_at: new Date(),
        resolution_notes: resolutionNotes,
        root_cause: rootCause ?? null,
      },
      include: {
        assignee: { select: { id: true, first_name: true, last_name: true } },
        creator: { select: { id: true, first_name: true, last_name: true } },
        turbine: { select: { id: true, name: true } },
        component: { select: { id: true, name: true } },
      },
    });

    if (evidenceIds?.length) {
      await prisma.ticketEvidence.createMany({
        data: evidenceIds.map((eid) => ({
          ticket_id: id,
          evidence_id: eid,
          linked_by: user.userId,
        })),
      });
    }

    await prisma.auditEvent.create({
      data: {
        entity_type: "TICKET",
        entity_id: id,
        action: "STATUS_CHANGE",
        user_id: user.userId,
        before_state: { status: ticket.status },
        after_state: { status: "CLOSED", resolution_notes: resolutionNotes },
        metadata: rootCause ? { root_cause: rootCause } : undefined,
      },
    });

    return c.json(updated);
  }
);

// POST /tickets/:id/reopen — reopen closed ticket
app.post(
  "/:id/reopen",
  authMiddleware(),
  requireRoles("DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER"),
  zValidator("json", reopenSchema),
  async (c) => {
    const id = c.req.param("id");
    const { reason } = c.req.valid("json");
    const user = c.get("user");

    const ticket = await prisma.ticket.findFirst({
      where: { id, deleted_at: null },
    });
    if (!ticket) throw new NotFoundError("Ticket", id);

    if (ticket.status !== "CLOSED") {
      return c.json(
        { error: "Only CLOSED tickets can be reopened", code: "TKT_004" },
        422,
      );
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: {
        status: "REOPENED",
        closed_at: null,
        resolution_notes: null,
        root_cause: null,
      },
      include: {
        assignee: { select: { id: true, first_name: true, last_name: true } },
        creator: { select: { id: true, first_name: true, last_name: true } },
        turbine: { select: { id: true, name: true } },
        component: { select: { id: true, name: true } },
      },
    });

    await prisma.auditEvent.create({
      data: {
        entity_type: "TICKET",
        entity_id: id,
        action: "STATUS_CHANGE",
        user_id: user.userId,
        before_state: { status: "CLOSED" },
        after_state: { status: "REOPENED" },
        metadata: { reason },
      },
    });

    return c.json(updated);
  }
);

// POST /tickets/:id/evidence — link evidence
app.post(
  "/:id/evidence",
  authMiddleware(),
  requireRoles("TECHNICIAN", "DISPATCHER", "QA_REVIEWER", "ADMINISTRATOR"),
  zValidator("json", linkEvidenceSchema),
  async (c) => {
    const id = c.req.param("id");
    const { evidenceIds } = c.req.valid("json");
    const user = c.get("user");

    const ticket = await prisma.ticket.findFirst({
      where: { id, deleted_at: null },
    });
    if (!ticket) throw new NotFoundError("Ticket", id);

    await prisma.ticketEvidence.createMany({
      data: evidenceIds.map((eid) => ({
        ticket_id: id,
        evidence_id: eid,
        linked_by: user.userId,
      })),
      skipDuplicates: true,
    });

    await prisma.auditEvent.create({
      data: {
        entity_type: "TICKET",
        entity_id: id,
        action: "UPDATE",
        user_id: user.userId,
        metadata: { linked_evidence: evidenceIds },
      },
    });

    const updated = await prisma.ticket.findFirst({
      where: { id, deleted_at: null },
      include: {
        ticket_evidence: {
          include: {
            evidence: { select: { id: true, media_type: true, thumbnail_url: true } },
          },
        },
      },
    });

    return c.json(updated);
  }
);

// GET /tickets/:id/audit-trail — full audit events
app.get("/:id/audit-trail", async (c) => {
  const id = c.req.param("id");

  const ticket = await prisma.ticket.findFirst({
    where: { id, deleted_at: null },
  });
  if (!ticket) throw new NotFoundError("Ticket", id);

  const events = await prisma.auditEvent.findMany({
    where: { entity_type: "TICKET", entity_id: id },
    orderBy: { created_at: "desc" },
    include: { user: { select: { id: true, first_name: true, last_name: true } } },
  });

  return c.json({
    data: events.map((e) => ({
      id: e.id,
      action: e.action,
      userId: e.user_id,
      userName: e.user ? `${e.user.first_name} ${e.user.last_name}` : null,
      details: { ...(e.before_state as Record<string, unknown> ?? {}), ...(e.after_state as Record<string, unknown> ?? {}) },
      metadata: e.metadata,
      timestamp: e.created_at,
    })),
  });
});

export default app;
