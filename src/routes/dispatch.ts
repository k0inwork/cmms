import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { authMiddleware, requireRoles, type AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

// ─── GET /dispatch/coverage ────────────────────────────────────────────────────

const coverageSchema = z.object({
  date: z.string().datetime().optional(),
  siteId: z.string().uuid().optional(),
  skillId: z.string().uuid().optional(),
  view: z.enum(["DAY", "WEEK"]).default("DAY"),
});

app.get("/coverage", authMiddleware(), requireRoles("DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER"), zValidator("query", coverageSchema), async (c) => {
  const { date, siteId } = c.req.valid("query");

  const where: Record<string, unknown> = {
    is_active: true,
    deleted_at: null,
    status: { notIn: ["SICK", "LEAVE", "UNAVAILABLE"] },
  };

  if (siteId) {
    where.availability_slots = { some: { site_id: siteId } };
  }

  const technicians = await prisma.user.findMany({
    where,
    orderBy: { last_name: "asc" },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      status: true,
      assignments: {
        where: { status: "ASSIGNED", declined_at: null },
        select: {
          id: true,
          assigned_at: true,
          inspection: { select: { id: true, status: true } },
          work_order: { select: { id: true, title: true } },
        },
      },
    },
  });

  const result = technicians.map((t) => ({
    id: t.id,
    name: `${t.first_name} ${t.last_name}`,
    status: t.status,
    assignments: t.assignments.map((a) => ({
      id: a.id,
      type: a.inspection ? "INSPECTION" : "WORK_ORDER",
      title: a.work_order?.title ?? null,
    })),
    coverageGaps: [],
  }));

  return c.json({
    date: date ?? new Date().toISOString(),
    siteId: siteId ?? null,
    technicians: result,
    gaps: [],
  });
});

// ─── GET /dispatch/sla-risk ────────────────────────────────────────────────────

app.get("/sla-risk", authMiddleware(), requireRoles("DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER"), async (c) => {
  // Find tickets with SLA target within next 24h or already past
  const riskThreshold = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [tickets, workOrders] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        sla_target_date: { lte: riskThreshold },
        status: { notIn: ["CLOSED"] },
        deleted_at: null,
      },
      include: {
        assignee: { select: { id: true, first_name: true, last_name: true } },
      },
      orderBy: { sla_target_date: "asc" },
      take: 25,
    }),
    prisma.workOrder.findMany({
      where: {
        due_date: { lte: riskThreshold },
        status: { notIn: ["CLOSED"] },
        deleted_at: null,
      },
      include: {
        assignee: { select: { id: true, first_name: true, last_name: true } },
      },
      orderBy: { due_date: "asc" },
      take: 25,
    }),
  ]);

  const atRisk = [
    ...tickets.map((t) => {
      const remaining = t.sla_target_date ? t.sla_target_date.getTime() - Date.now() : 0;
      return {
        id: t.id,
        type: "TICKET" as const,
        title: t.title,
        assigneeId: t.assignee_id,
        assigneeName: t.assignee ? `${t.assignee.first_name} ${t.assignee.last_name}` : null,
        slaTarget: t.sla_target_date?.toISOString() ?? null,
        slaRemainingMs: remaining,
        riskLevel: remaining < 0 ? "CRITICAL" : remaining < 4 * 60 * 60 * 1000 ? "HIGH" : "MEDIUM",
      };
    }),
    ...workOrders.map((w) => {
      const remaining = w.due_date ? w.due_date.getTime() - Date.now() : 0;
      return {
        id: w.id,
        type: "WORK_ORDER" as const,
        title: w.title,
        assigneeId: w.assignee_id,
        assigneeName: w.assignee ? `${w.assignee.first_name} ${w.assignee.last_name}` : null,
        slaTarget: w.due_date?.toISOString() ?? null,
        slaRemainingMs: remaining,
        riskLevel: remaining < 0 ? "CRITICAL" : remaining < 4 * 60 * 60 * 1000 ? "HIGH" : "MEDIUM",
      };
    }),
  ];

  return c.json({ atRisk });
});

// ─── POST /dispatch/assign ─────────────────────────────────────────────────────

const assignSchema = z.object({
  assignmentType: z.enum(["INSPECTION", "WORK_ORDER"]),
  assignmentId: z.string().uuid(),
  technicianId: z.string().uuid(),
});

app.post("/assign", authMiddleware(), requireRoles("DISPATCHER", "ADMINISTRATOR"), zValidator("json", assignSchema), async (c) => {
  const user = c.get("user");
  const { assignmentType, assignmentId, technicianId } = c.req.valid("json");

  // Verify technician exists and is available
  const technician = await prisma.user.findFirst({
    where: { id: technicianId, is_active: true, deleted_at: null },
  });
  if (!technician) {
    return c.json({ error: "Technician not found", code: "DISP_002" }, 422);
  }

  if (["SICK", "LEAVE", "UNAVAILABLE"].includes(technician.status)) {
    return c.json({ error: "Technician is unavailable", code: "DISP_002" }, 422);
  }

  // Verify the target entity exists
  if (assignmentType === "INSPECTION") {
    const inspection = await prisma.inspectionRecord.findFirst({
      where: { id: assignmentId, deleted_at: null },
    });
    if (!inspection) {
      return c.json({ error: "Inspection not found", code: "DISP_003" }, 404);
    }
  } else {
    const wo = await prisma.workOrder.findFirst({
      where: { id: assignmentId, deleted_at: null },
    });
    if (!wo) {
      return c.json({ error: "Work order not found", code: "DISP_003" }, 404);
    }
  }

  const assignment = await prisma.assignment.create({
    data: {
      user_id: technicianId,
      inspection_id: assignmentType === "INSPECTION" ? assignmentId : null,
      work_order_id: assignmentType === "WORK_ORDER" ? assignmentId : null,
      status: "ASSIGNED",
      assigned_by: user.userId,
    },
  });

  return c.json(assignment, 201);
});

export default app;
