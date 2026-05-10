import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { NotFoundError, ForbiddenError } from "../utils/errors.js";
import { authMiddleware, requireRoles, type AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

// ─── POST /replacements ────────────────────────────────────────────────────────

const replacementSchema = z.object({
  absenceId: z.string().uuid(),
  candidateId: z.string().uuid(),
  assignmentIds: z.array(z.string().uuid()).min(1),
  reason: z.string().optional(),
});

app.post("/", authMiddleware(), requireRoles("DISPATCHER", "ADMINISTRATOR"), zValidator("json", replacementSchema), async (c) => {
  const user = c.get("user");
  const { absenceId, candidateId, assignmentIds, reason } = c.req.valid("json");

  // Verify absence exists
  const absence = await prisma.absenceRecord.findUnique({ where: { id: absenceId } });
  if (!absence) {
    throw new NotFoundError("AbsenceRecord", absenceId);
  }

  // Verify candidate exists and is active
  const candidate = await prisma.user.findFirst({
    where: { id: candidateId, is_active: true, deleted_at: null },
    select: { id: true, first_name: true, last_name: true },
  });
  if (!candidate) {
    throw new NotFoundError("User", candidateId);
  }

  // Update assignments to the new candidate
  const { count } = await prisma.assignment.updateMany({
    where: { id: { in: assignmentIds } },
    data: {
      user_id: candidateId,
      assigned_by: user.userId,
      assigned_at: new Date(),
      accepted_at: null,
      declined_at: null,
      decline_reason: null,
    },
  });

  // Fetch the updated assignments for response
  const assignments = await prisma.assignment.findMany({
    where: { id: { in: assignmentIds } },
    select: {
      id: true,
      inspection_id: true,
      work_order_id: true,
      status: true,
    },
  });

  return c.json({
    id: assignmentIds[0], // primary assignment ID as reference
    status: "PENDING_ACCEPTANCE",
    reassignedCount: count,
    candidate: { id: candidate.id, name: `${candidate.first_name} ${candidate.last_name}` },
    assignments: assignments.map((a) => ({
      id: a.id,
      type: a.inspection_id ? "INSPECTION" : "WORK_ORDER",
      status: "REASSIGNED",
    })),
    reason: reason ?? null,
  }, 201);
});

// ─── POST /replacements/:id/accept ─────────────────────────────────────────────

app.post("/:id/accept", authMiddleware(), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id")!;

  const assignment = await prisma.assignment.findUnique({ where: { id } });
  if (!assignment) {
    throw new NotFoundError("Assignment", id);
  }

  // Only the assigned replacement can accept
  if (assignment.user_id !== user.userId) {
    throw new ForbiddenError("Only the assigned replacement can accept");
  }

  await prisma.assignment.update({
    where: { id },
    data: { accepted_at: new Date() },
  });

  return c.json({ status: "ACCEPTED", assignmentId: id });
});

// ─── POST /replacements/:id/decline ────────────────────────────────────────────

const declineSchema = z.object({
  reason: z.string().optional(),
});

app.post("/:id/decline", authMiddleware(), zValidator("json", declineSchema), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id")!;
  const { reason } = c.req.valid("json");

  const assignment = await prisma.assignment.findUnique({ where: { id } });
  if (!assignment) {
    throw new NotFoundError("Assignment", id);
  }

  if (assignment.user_id !== user.userId) {
    throw new ForbiddenError("Only the assigned replacement can decline");
  }

  await prisma.assignment.update({
    where: { id },
    data: {
      declined_at: new Date(),
      decline_reason: reason ?? null,
    },
  });

  return c.json({ status: "DECLINED", assignmentId: id });
});

export default app;
