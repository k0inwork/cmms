import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { paginationSchema, buildCursorQuery, paginatedResponse } from "../utils/pagination.js";
import { NotFoundError } from "../utils/errors.js";
import { authMiddleware, requireRoles, type AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

const TechnicianStatusEnum = z.enum([
  "AVAILABLE", "ASSIGNED", "TRAVELING", "ON_SITE", "ON_BREAK",
  "SICK", "TRAINING", "LEAVE", "UNAVAILABLE",
]);

// ─── GET /technicians ─────────────────────────────────────────────────────────

const listSchema = paginationSchema.extend({
  status: TechnicianStatusEnum.optional(),
  skillId: z.string().uuid().optional(),
  certificationId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
});

app.get("/", authMiddleware(), zValidator("query", listSchema), async (c) => {
  const { cursor, limit, status, skillId, certificationId, siteId } = c.req.valid("query");

  const where: Record<string, unknown> = {
    is_active: true,
    deleted_at: null,
  };

  if (status) where.status = status;
  if (skillId) where.user_skills = { some: { skill_id: skillId } };
  if (certificationId) where.user_certifications = { some: { certification_id: certificationId } };
  if (siteId) where.availability_slots = { some: { site_id: siteId } };

  const users = await prisma.user.findMany({
    where,
    take: limit + 1,
    orderBy: { last_name: "asc" },
    ...buildCursorQuery(cursor),
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      status: true,
      updated_at: true,
      user_skills: {
        include: {
          skill: { select: { id: true, name: true } },
        },
      },
      user_certifications: {
        include: {
          certification: { select: { id: true, name: true } },
        },
      },
      assignments: {
        where: { status: "ASSIGNED" },
        select: { id: true },
      },
    },
  });

  const data = paginatedResponse(users, limit).data.map((u) => ({
    id: u.id,
    name: `${u.first_name} ${u.last_name}`,
    email: u.email,
    status: u.status,
    skills: u.user_skills.map((us) => ({
      id: us.skill.id,
      name: us.skill.name,
      proficiencyLevel: us.proficiency_level,
    })),
    certifications: u.user_certifications.map((uc) => ({
      id: uc.certification.id,
      name: uc.certification.name,
      isValid: !uc.expiry_date || uc.expiry_date > new Date(),
    })),
    activeAssignments: u.assignments.length,
    lastStatusChange: u.updated_at.toISOString(),
  }));

  return c.json({ data, pagination: paginatedResponse(users, limit).pagination });
});

// ─── PATCH /technicians/:id/status ────────────────────────────────────────────

const statusSchema = z.object({
  status: TechnicianStatusEnum,
  notes: z.string().optional(),
});

app.patch("/:id/status", authMiddleware(), zValidator("json", statusSchema), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id")!;
  const { status, notes } = c.req.valid("json");

  // Tech can update own status; dispatcher/admin can update any
  if (user.userId !== id && !["DISPATCHER", "ADMINISTRATOR"].includes(user.role)) {
    return c.json({ error: "Cannot update another technician's status" }, 403);
  }

  const existing = await prisma.user.findFirst({ where: { id, deleted_at: null } });
  if (!existing) {
    throw new NotFoundError("Technician", id);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      status,
      ...(notes ? { availability_slots: { create: { status, start_time: new Date(), end_time: new Date(Date.now() + 8 * 60 * 60 * 1000), notes } } } : {}),
    },
    select: { id: true, status: true, updated_at: true },
  });

  return c.json(updated);
});

// ─── POST /technicians/:id/absence ────────────────────────────────────────────

const absenceSchema = z.object({
  reason: z.enum(["SICK", "PERSONAL_LEAVE", "TRAINING", "VACATION", "OTHER"]),
  startDate: z.string().datetime(),
  expectedReturnDate: z.string().optional().nullable(),
  notes: z.string().optional(),
});

app.post("/:id/absence", authMiddleware(), zValidator("json", absenceSchema), async (c) => {
  const id = c.req.param("id")!;
  const data = c.req.valid("json");

  const existing = await prisma.user.findFirst({ where: { id, deleted_at: null } });
  if (!existing) {
    throw new NotFoundError("Technician", id);
  }

  const [absence, affectedCount] = await Promise.all([
    prisma.absenceRecord.create({
      data: {
        user_id: id,
        reason: data.reason,
        start_date: new Date(data.startDate),
        expected_return_date: data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
        notes: data.notes ?? null,
      },
    }),
    prisma.assignment.count({
      where: { user_id: id, status: "ASSIGNED" },
    }),
  ]);

  return c.json({
    id: absence.id,
    technicianId: id,
    reason: absence.reason,
    startDate: absence.start_date.toISOString(),
    expectedReturnDate: absence.expected_return_date?.toISOString() ?? null,
    approvalStatus: absence.is_approved ? "APPROVED" : "PENDING",
    affectedAssignments: affectedCount,
    replacementSuggestionsAvailable: affectedCount > 0,
  }, 201);
});

// ─── GET /technicians/:id/absence-history ──────────────────────────────────────

const absenceHistorySchema = z.object({
  reason: z.enum(["SICK", "PERSONAL_LEAVE", "TRAINING", "VACATION", "OTHER"]).optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
});

app.get("/:id/absence-history", authMiddleware(), zValidator("query", absenceHistorySchema), async (c) => {
  const id = c.req.param("id")!;
  const { reason, createdAfter, createdBefore } = c.req.valid("query");

  const where: Record<string, unknown> = { user_id: id };
  if (reason) where.reason = reason;
  if (createdAfter || createdBefore) {
    const createdAt: Record<string, Date> = {};
    if (createdAfter) createdAt.gte = new Date(createdAfter);
    if (createdBefore) createdAt.lte = new Date(createdBefore);
    where.created_at = createdAt;
  }

  const records = await prisma.absenceRecord.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: 50,
  });

  return c.json({ data: records });
});

// ─── GET /technicians/:id/assignments ──────────────────────────────────────────

app.get("/:id/assignments", authMiddleware(), async (c) => {
  const id = c.req.param("id")!;

  const assignments = await prisma.assignment.findMany({
    where: { user_id: id, declined_at: null },
    orderBy: { assigned_at: "desc" },
    include: {
      inspection: { select: { id: true, status: true } },
      work_order: { select: { id: true, status: true, title: true } },
    },
    take: 50,
  });

  return c.json({
    data: assignments.map((a) => ({
      id: a.id,
      status: a.status,
      assignedAt: a.assigned_at.toISOString(),
      acceptedAt: a.accepted_at?.toISOString() ?? null,
      type: a.inspection_id ? "INSPECTION" : "WORK_ORDER",
      reference: a.inspection ?? a.work_order,
    })),
  });
});

// ─── GET /technicians/:id/replacement-suggestions ──────────────────────────────

app.get("/:id/replacement-suggestions", authMiddleware(), requireRoles("DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER"), async (c) => {
  const id = c.req.param("id")!;

  const latestAbsence = await prisma.absenceRecord.findFirst({
    where: { user_id: id },
    orderBy: { created_at: "desc" },
  });

  if (!latestAbsence) {
    return c.json({
      absentTechnicianId: id,
      absenceId: null,
      affectedAssignments: [],
      candidates: [],
      escalationRequired: false,
    });
  }

  const [suggestions, affectedAssignments] = await Promise.all([
    prisma.replacementSuggestion.findMany({
      where: { absence_record_id: latestAbsence.id },
      orderBy: { total_score: "desc" },
      include: {
        suggested_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            status: true,
            assignments: {
              where: { status: "ASSIGNED" },
              select: { id: true },
            },
          },
        },
      },
    }),
    prisma.assignment.findMany({
      where: { user_id: id, status: "ASSIGNED" },
      select: {
        id: true,
        inspection: { select: { id: true, status: true } },
        work_order: { select: { id: true, title: true, due_date: true } },
      },
    }),
  ]);

  const candidates = suggestions.map((s) => ({
    technicianId: s.suggested_user.id,
    name: `${s.suggested_user.first_name} ${s.suggested_user.last_name}`,
    totalScore: s.total_score,
    scoreBreakdown: {
      skillMatch: s.skill_match_score,
      certificationMatch: s.cert_match_score,
      proximity: s.proximity_score,
      workloadCapacity: s.workload_score,
      siteFamiliarity: s.familiarity_score,
    },
    currentStatus: s.suggested_user.status,
    currentAssignments: s.suggested_user.assignments.length,
    isAboveThreshold: s.is_above_threshold,
  }));

  return c.json({
    absentTechnicianId: id,
    absenceId: latestAbsence.id,
    affectedAssignments: affectedAssignments.map((a) => ({
      id: a.id,
      type: a.inspection ? "INSPECTION" : "WORK_ORDER",
      title: a.work_order?.title ?? null,
    })),
    candidates,
    escalationRequired: candidates.length > 0 && !candidates.some((c) => c.isAboveThreshold),
  });
});

export default app;
