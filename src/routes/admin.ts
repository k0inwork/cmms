import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { hashPassword } from "../utils/password.js";
import { paginationSchema, buildCursorQuery, paginatedResponse } from "../utils/pagination.js";
import { NotFoundError, ConflictError } from "../utils/errors.js";
import { authMiddleware, requireRoles, AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

// All admin routes require auth + ADMINISTRATOR role
app.use("*", authMiddleware());
app.use("*", requireRoles("ADMINISTRATOR"));

// ── Enum schemas ──────────────────────────────────────────────────────────────

const RoleEnum = z.enum([
  "TECHNICIAN", "DISPATCHER", "QA_REVIEWER", "OPERATIONS_MANAGER", "ADMINISTRATOR",
]);

const StatusEnum = z.enum([
  "AVAILABLE", "ASSIGNED", "TRAVELING", "ON_SITE", "ON_BREAK",
  "SICK", "TRAINING", "LEAVE", "UNAVAILABLE",
]);

// ── Validation schemas ────────────────────────────────────────────────────────

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: RoleEnum,
  status: StatusEnum.optional(),
});

const updateUserSchema = z
  .object({
    email: z.string().email().optional(),
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    role: RoleEnum.optional(),
    status: StatusEnum.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

const assignSkillSchema = z.object({
  skillId: z.string().min(1),
  proficiencyLevel: z.number().int().min(1).max(10),
  acquiredDate: z.string().datetime(),
});

const assignCertSchema = z.object({
  certificationId: z.string().min(1),
  issuedDate: z.string().datetime(),
  expiryDate: z.string().datetime().optional().nullable(),
  certificateUrl: z.string().url().optional(),
});

const createSkillSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
});

const updateSkillSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    category: z.string().max(100).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

const createCertSchema = z.object({
  name: z.string().min(1).max(200),
  issuingBody: z.string().max(200).optional(),
  validityMonths: z.number().int().min(1).optional(),
  description: z.string().max(1000).optional(),
});

const updateCertSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    issuingBody: z.string().max(200).optional().nullable(),
    validityMonths: z.number().int().min(1).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

const createWorkflowRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  trigger: z.string().min(1),
  conditions: z.record(z.unknown()).optional(),
  actions: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

const updateWorkflowRuleSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional().nullable(),
    trigger: z.string().min(1).optional(),
    conditions: z.record(z.unknown()).optional().nullable(),
    actions: z.record(z.unknown()).optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

// ── User field selection ──────────────────────────────────────────────────────

const userSelect = {
  id: true,
  email: true,
  first_name: true,
  last_name: true,
  role: true,
  is_active: true,
  status: true,
  organization_id: true,
  created_at: true,
  updated_at: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════════════

app.get("/users", zValidator("query", paginationSchema), async (c) => {
  const { cursor, limit } = c.req.valid("query");
  const admin = c.get("user");

  const items = await prisma.user.findMany({
    where: { deleted_at: null },
    take: limit + 1,
    orderBy: { created_at: "desc" },
    select: userSelect,
    ...buildCursorQuery(cursor),
  });

  return c.json(paginatedResponse(items, limit));
});

app.post("/users", zValidator("json", createUserSchema), async (c) => {
  const data = c.req.valid("json");
  const admin = c.get("user");

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new ConflictError(`User with email '${data.email}' already exists`);

  const password_hash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      password_hash,
      first_name: data.firstName,
      last_name: data.lastName,
      role: data.role,
      status: data.status ?? "AVAILABLE",
      organization_id: admin.organizationId,
    },
    select: userSelect,
  });

  return c.json(user, 201);
});

app.get("/users/:id", async (c) => {
  const id = c.req.param("id");
  const admin = c.get("user");

  const user = await prisma.user.findFirst({
    where: { id, organization_id: admin.organizationId, deleted_at: null },
    select: {
      ...userSelect,
      user_skills: { include: { skill: true } },
      user_certifications: { include: { certification: true } },
    },
  });
  if (!user) throw new NotFoundError("User", id);

  return c.json(user);
});

app.patch("/users/:id", zValidator("json", updateUserSchema), async (c) => {
  const id = c.req.param("id");
  const data = c.req.valid("json");
  const admin = c.get("user");

  const existing = await prisma.user.findFirst({
    where: { id, organization_id: admin.organizationId, deleted_at: null },
  });
  if (!existing) throw new NotFoundError("User", id);

  if (data.email && data.email !== existing.email) {
    const dup = await prisma.user.findUnique({ where: { email: data.email } });
    if (dup) throw new ConflictError(`User with email '${data.email}' already exists`);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(data.email && { email: data.email }),
      ...(data.firstName && { first_name: data.firstName }),
      ...(data.lastName && { last_name: data.lastName }),
      ...(data.role && { role: data.role }),
      ...(data.status && { status: data.status }),
    },
    select: userSelect,
  });

  return c.json(updated);
});

app.post("/users/:id/activate", async (c) => {
  const id = c.req.param("id");
  const admin = c.get("user");

  const existing = await prisma.user.findFirst({
    where: { id, organization_id: admin.organizationId, deleted_at: null },
  });
  if (!existing) throw new NotFoundError("User", id);

  const updated = await prisma.user.update({
    where: { id },
    data: { is_active: true },
    select: { id: true, email: true, first_name: true, last_name: true, is_active: true },
  });

  return c.json(updated);
});

app.post("/users/:id/deactivate", async (c) => {
  const id = c.req.param("id");
  const admin = c.get("user");

  const existing = await prisma.user.findFirst({
    where: { id, organization_id: admin.organizationId, deleted_at: null },
  });
  if (!existing) throw new NotFoundError("User", id);

  const updated = await prisma.user.update({
    where: { id },
    data: { is_active: false },
    select: { id: true, email: true, first_name: true, last_name: true, is_active: true },
  });

  return c.json(updated);
});

// ── User Skill Assignment ─────────────────────────────────────────────────────

app.post("/users/:id/skills", zValidator("json", assignSkillSchema), async (c) => {
  const userId = c.req.param("id");
  const { skillId, proficiencyLevel, acquiredDate } = c.req.valid("json");
  const admin = c.get("user");

  const user = await prisma.user.findFirst({
    where: { id: userId, organization_id: admin.organizationId, deleted_at: null },
  });
  if (!user) throw new NotFoundError("User", userId);

  const skill = await prisma.skill.findUnique({ where: { id: skillId } });
  if (!skill) throw new NotFoundError("Skill", skillId);

  const existing = await prisma.userSkill.findUnique({
    where: { user_id_skill_id: { user_id: userId, skill_id: skillId } },
  });
  if (existing) throw new ConflictError("Skill already assigned to this user");

  const assigned = await prisma.userSkill.create({
    data: {
      user_id: userId,
      skill_id: skillId,
      proficiency_level: proficiencyLevel,
      acquired_date: new Date(acquiredDate),
    },
    include: { skill: true },
  });

  return c.json(assigned, 201);
});

app.delete("/users/:id/skills/:skillId", async (c) => {
  const userId = c.req.param("id");
  const skillId = c.req.param("skillId");
  const admin = c.get("user");

  const user = await prisma.user.findFirst({
    where: { id: userId, organization_id: admin.organizationId, deleted_at: null },
  });
  if (!user) throw new NotFoundError("User", userId);

  const link = await prisma.userSkill.findUnique({
    where: { user_id_skill_id: { user_id: userId, skill_id: skillId } },
  });
  if (!link) throw new NotFoundError("UserSkill", `${userId}/${skillId}`);

  await prisma.auditEvent.create({
    data: {
      entity_type: "UserSkill",
      entity_id: link.id,
      action: "DELETE",
      user_id: admin.userId,
      before_state: { user_id: userId, skill_id: skillId },
    },
  });

  await prisma.userSkill.update({
    where: { user_id_skill_id: { user_id: userId, skill_id: skillId } },
    data: { deleted_at: new Date() },
  });

  return c.json({ deleted: true });
});

// ── User Certification Assignment ─────────────────────────────────────────────

app.post("/users/:id/certifications", zValidator("json", assignCertSchema), async (c) => {
  const userId = c.req.param("id");
  const { certificationId, issuedDate, expiryDate, certificateUrl } = c.req.valid("json");
  const admin = c.get("user");

  const user = await prisma.user.findFirst({
    where: { id: userId, organization_id: admin.organizationId, deleted_at: null },
  });
  if (!user) throw new NotFoundError("User", userId);

  const cert = await prisma.certification.findUnique({ where: { id: certificationId } });
  if (!cert) throw new NotFoundError("Certification", certificationId);

  const existing = await prisma.userCertification.findUnique({
    where: { user_id_certification_id: { user_id: userId, certification_id: certificationId } },
  });
  if (existing) throw new ConflictError("Certification already assigned to this user");

  const assigned = await prisma.userCertification.create({
    data: {
      user_id: userId,
      certification_id: certificationId,
      issued_date: new Date(issuedDate),
      expiry_date: expiryDate ? new Date(expiryDate) : null,
      certificate_url: certificateUrl ?? null,
    },
    include: { certification: true },
  });

  return c.json(assigned, 201);
});

app.delete("/users/:id/certifications/:certId", async (c) => {
  const userId = c.req.param("id");
  const certId = c.req.param("certId");
  const admin = c.get("user");

  const user = await prisma.user.findFirst({
    where: { id: userId, organization_id: admin.organizationId, deleted_at: null },
  });
  if (!user) throw new NotFoundError("User", userId);

  const link = await prisma.userCertification.findUnique({
    where: { user_id_certification_id: { user_id: userId, certification_id: certId } },
  });
  if (!link) throw new NotFoundError("UserCertification", `${userId}/${certId}`);

  await prisma.auditEvent.create({
    data: {
      entity_type: "UserCertification",
      entity_id: link.id,
      action: "DELETE",
      user_id: admin.userId,
      before_state: { user_id: userId, certification_id: certId },
    },
  });

  await prisma.userCertification.update({
    where: { user_id_certification_id: { user_id: userId, certification_id: certId } },
    data: { deleted_at: new Date() },
  });

  return c.json({ deleted: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SKILLS
// ═══════════════════════════════════════════════════════════════════════════════

app.get("/skills", zValidator("query", paginationSchema), async (c) => {
  const { cursor, limit } = c.req.valid("query");

  const items = await prisma.skill.findMany({
    where: { deleted_at: null },
    take: limit + 1,
    orderBy: { created_at: "desc" },
    ...buildCursorQuery(cursor),
  });

  return c.json(paginatedResponse(items, limit));
});

app.post("/skills", zValidator("json", createSkillSchema), async (c) => {
  const data = c.req.valid("json");

  const existing = await prisma.skill.findFirst({ where: { name: data.name, deleted_at: null } });
  if (existing) throw new ConflictError(`Skill with name '${data.name}' already exists`);

  const skill = await prisma.skill.create({ data });
  return c.json(skill, 201);
});

app.patch("/skills/:id", zValidator("json", updateSkillSchema), async (c) => {
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const existing = await prisma.skill.findFirst({ where: { id, deleted_at: null } });
  if (!existing) throw new NotFoundError("Skill", id);

  if (data.name && data.name !== existing.name) {
    const dup = await prisma.skill.findFirst({ where: { name: data.name, deleted_at: null } });
    if (dup) throw new ConflictError(`Skill with name '${data.name}' already exists`);
  }

  const updated = await prisma.skill.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.description !== undefined && { description: data.description }),
    },
  });

  return c.json(updated);
});

app.delete("/skills/:id", async (c) => {
  const id = c.req.param("id");
  const admin = c.get("user");

  const existing = await prisma.skill.findFirst({ where: { id, deleted_at: null } });
  if (!existing) throw new NotFoundError("Skill", id);

  await prisma.skill.update({
    where: { id },
    data: { deleted_at: new Date() },
  });

  await prisma.auditEvent.create({
    data: {
      entity_type: "Skill",
      entity_id: id,
      action: "DELETE",
      user_id: admin.userId,
      before_state: { ...existing },
    },
  });

  return c.json({ deleted: true, id });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CERTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

app.get("/certifications", zValidator("query", paginationSchema), async (c) => {
  const { cursor, limit } = c.req.valid("query");

  const items = await prisma.certification.findMany({
    where: { deleted_at: null },
    take: limit + 1,
    orderBy: { created_at: "desc" },
    ...buildCursorQuery(cursor),
  });

  return c.json(paginatedResponse(items, limit));
});

app.post("/certifications", zValidator("json", createCertSchema), async (c) => {
  const data = c.req.valid("json");

  const existing = await prisma.certification.findFirst({ where: { name: data.name, deleted_at: null } });
  if (existing) throw new ConflictError(`Certification with name '${data.name}' already exists`);

  const cert = await prisma.certification.create({
    data: {
      name: data.name,
      issuing_body: data.issuingBody ?? null,
      validity_months: data.validityMonths ?? null,
      description: data.description ?? null,
    },
  });
  return c.json(cert, 201);
});

app.patch("/certifications/:id", zValidator("json", updateCertSchema), async (c) => {
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const existing = await prisma.certification.findFirst({ where: { id, deleted_at: null } });
  if (!existing) throw new NotFoundError("Certification", id);

  if (data.name && data.name !== existing.name) {
    const dup = await prisma.certification.findFirst({ where: { name: data.name, deleted_at: null } });
    if (dup) throw new ConflictError(`Certification with name '${data.name}' already exists`);
  }

  const updated = await prisma.certification.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.issuingBody !== undefined && { issuing_body: data.issuingBody }),
      ...(data.validityMonths !== undefined && { validity_months: data.validityMonths }),
      ...(data.description !== undefined && { description: data.description }),
    },
  });

  return c.json(updated);
});

app.delete("/certifications/:id", async (c) => {
  const id = c.req.param("id");
  const admin = c.get("user");

  const existing = await prisma.certification.findFirst({ where: { id, deleted_at: null } });
  if (!existing) throw new NotFoundError("Certification", id);

  await prisma.certification.update({
    where: { id },
    data: { deleted_at: new Date() },
  });

  await prisma.auditEvent.create({
    data: {
      entity_type: "Certification",
      entity_id: id,
      action: "DELETE",
      user_id: admin.userId,
      before_state: { ...existing },
    },
  });

  return c.json({ deleted: true, id });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW RULES (stub — in-memory, not persisted to DB)
// ═══════════════════════════════════════════════════════════════════════════════

interface WorkflowRule {
  id: string;
  name: string;
  description?: string;
  trigger: string;
  conditions?: Record<string, unknown>;
  actions?: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const workflowRules = new Map<string, WorkflowRule>();
let ruleCounter = 0;

export function _resetWorkflowRules() {
  workflowRules.clear();
  ruleCounter = 0;
}

app.get("/workflow-rules", (c) => {
  const rules = Array.from(workflowRules.values());
  return c.json({ data: rules });
});

app.post("/workflow-rules", zValidator("json", createWorkflowRuleSchema), async (c) => {
  const data = c.req.valid("json");
  const id = `wfr-stub-${++ruleCounter}`;

  const rule: WorkflowRule = {
    id,
    name: data.name,
    description: data.description,
    trigger: data.trigger,
    conditions: data.conditions,
    actions: data.actions,
    isActive: data.isActive ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  workflowRules.set(id, rule);
  return c.json(rule, 201);
});

app.patch("/workflow-rules/:id", zValidator("json", updateWorkflowRuleSchema), async (c) => {
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const existing = workflowRules.get(id);
  if (!existing) throw new NotFoundError("WorkflowRule", id);

  const updated: WorkflowRule = {
    ...existing,
    ...(data.name !== undefined && { name: data.name }),
    ...(data.description !== undefined && { description: data.description ?? undefined }),
    ...(data.trigger !== undefined && { trigger: data.trigger }),
    ...(data.conditions !== undefined && { conditions: data.conditions ?? undefined }),
    ...(data.actions !== undefined && { actions: data.actions ?? undefined }),
    ...(data.isActive !== undefined && { isActive: data.isActive }),
    updatedAt: new Date(),
  };

  workflowRules.set(id, updated);
  return c.json(updated);
});

app.delete("/workflow-rules/:id", async (c) => {
  const id = c.req.param("id");

  const existing = workflowRules.get(id);
  if (!existing) throw new NotFoundError("WorkflowRule", id);

  workflowRules.delete(id);
  return c.json({ deleted: true, id });
});

export default app;
