import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { randomUUID } from "crypto";
import prisma from "../lib/prisma.js";
import { paginationSchema, buildCursorQuery, paginatedResponse } from "../utils/pagination.js";
import { NotFoundError } from "../utils/errors.js";
import { authMiddleware, requireRoles, type AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "video/mp4",
  "video/quicktime",
  "application/pdf",
];

// ─── POST /evidence/upload-url ────────────────────────────────────────────────
const uploadUrlSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.enum(["PHOTO", "VIDEO", "PDF", "DOCUMENT", "SENSOR_EXPORT"]),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
});

app.post("/upload-url", authMiddleware(), requireRoles("TECHNICIAN", "QA_REVIEWER", "ADMINISTRATOR"), zValidator("json", uploadUrlSchema), async (c) => {
  const { fileName, fileSize, mimeType } = c.req.valid("json");

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return c.json({ error: "Unsupported file type", code: "EVID_001" }, 400);
  }

  if (fileSize > MAX_FILE_SIZE) {
    return c.json({ error: "File too large", code: "EVID_002" }, 400);
  }

  const evidenceId = randomUUID();
  const key = `evidence/${evidenceId}/${fileName}`;

  return c.json({
    uploadUrl: `https://s3.example.com/upload`,
    evidenceId,
    fields: {
      key,
      policy: "placeholder-policy",
      signature: "placeholder-signature",
    },
  });
});

// ─── POST /evidence ───────────────────────────────────────────────────────────
const createEvidenceSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string().min(1),
  fileType: z.enum(["PHOTO", "VIDEO", "PDF", "DOCUMENT", "SENSOR_EXPORT"]),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
  assetId: z.string().uuid().optional().nullable(),
  inspectionId: z.string().uuid().optional().nullable(),
  ticketId: z.string().uuid().optional().nullable(),
  capturedAt: z.string().datetime().optional().nullable(),
  deviceSource: z.string().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
});

app.post("/", authMiddleware(), requireRoles("TECHNICIAN", "QA_REVIEWER", "ADMINISTRATOR"), zValidator("json", createEvidenceSchema), async (c) => {
  const user = c.get("user");
  const data = c.req.valid("json");

  const fileUrl = `https://s3.example.com/evidence/${data.id}/${data.fileName}`;

  const evidence = await prisma.evidenceItem.create({
    data: {
      id: data.id,
      media_type: data.fileType,
      file_url: fileUrl,
      file_size_bytes: data.fileSize,
      mime_type: data.mimeType,
      uploaded_by: user.userId,
      asset_id: data.assetId ?? null,
      inspection_id: data.inspectionId ?? null,
      client_id: data.clientId ?? null,
      metadata: {
        fileName: data.fileName,
        capturedAt: data.capturedAt ?? null,
        deviceSource: data.deviceSource ?? null,
      },
    },
  });

  if (data.ticketId) {
    await prisma.ticketEvidence.create({
      data: {
        ticket_id: data.ticketId,
        evidence_id: evidence.id,
        linked_by: user.userId,
      },
    });
  }

  return c.json(evidence, 201);
});

// ─── GET /evidence ────────────────────────────────────────────────────────────
const listEvidenceSchema = paginationSchema.extend({
  assetId: z.string().uuid().optional(),
  componentId: z.string().uuid().optional(),
  inspectionId: z.string().uuid().optional(),
  mediaType: z.enum(["PHOTO", "VIDEO", "PDF", "DOCUMENT", "SENSOR_EXPORT"]).optional(),
  authorId: z.string().uuid().optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  approvalStatus: z.enum(["PENDING", "APPROVED", "FLAGGED"]).optional(),
});

app.get("/", authMiddleware(), zValidator("query", listEvidenceSchema), async (c) => {
  const { cursor, limit, assetId, componentId, inspectionId, mediaType, authorId, createdAfter, createdBefore, approvalStatus } = c.req.valid("query");

  const where: Record<string, unknown> = {
    deleted_at: null,
  };

  if (assetId) where.asset_id = assetId;
  if (componentId) where.component_id = componentId;
  if (inspectionId) where.inspection_id = inspectionId;
  if (mediaType) where.media_type = mediaType;
  if (authorId) where.uploaded_by = authorId;
  if (approvalStatus) where.status = approvalStatus;
  if (createdAfter || createdBefore) {
    const createdAt: Record<string, Date> = {};
    if (createdAfter) createdAt.gte = new Date(createdAfter);
    if (createdBefore) createdAt.lte = new Date(createdBefore);
    where.created_at = createdAt;
  }

  const items = await prisma.evidenceItem.findMany({
    where,
    take: limit + 1,
    orderBy: { created_at: "desc" },
    ...buildCursorQuery(cursor),
    include: {
      uploader: { select: { id: true, first_name: true, last_name: true } },
    },
  });

  return c.json(paginatedResponse(items, limit));
});

// ─── GET /evidence/:id ────────────────────────────────────────────────────────
app.get("/:id", authMiddleware(), async (c) => {
  const id = c.req.param("id")!;

  const evidence = await prisma.evidenceItem.findFirst({
    where: { id, deleted_at: null },
    include: {
      uploader: { select: { id: true, first_name: true, last_name: true } },
      annotations: true,
      ticket_evidence: { select: { ticket_id: true } },
      work_order_evidence: { select: { work_order_id: true } },
    },
  });

  if (!evidence) {
    throw new NotFoundError("Evidence", id);
  }

  return c.json(evidence);
});

// ─── POST /evidence/:id/annotations ───────────────────────────────────────────
const annotationSchema = z.object({
  annotations: z.array(
    z.object({
      type: z.enum(["ARROW", "CIRCLE", "TEXT"]),
      data: z.record(z.unknown()),
      color: z.string().optional(),
    })
  ).min(1),
});

app.post("/:id/annotations", authMiddleware(), zValidator("json", annotationSchema), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const { annotations } = c.req.valid("json");

  const evidence = await prisma.evidenceItem.findFirst({
    where: { id: id!, deleted_at: null },
  });

  if (!evidence) {
    throw new NotFoundError("Evidence", id!);
  }

  const created = await prisma.evidenceAnnotation.createMany({
    data: annotations.map((a) => ({
      evidence_id: id,
      author_id: user.userId,
      annotation_type: a.type,
      data: { ...a.data, ...(a.color ? { color: a.color } : {}) },
    })),
  });

  return c.json({ created: created.count }, 201);
});

// ─── PUT /evidence/:id/approve ────────────────────────────────────────────────
app.put("/:id/approve", authMiddleware(), requireRoles("QA_REVIEWER", "ADMINISTRATOR"), async (c) => {
  const id = c.req.param("id")!;

  const evidence = await prisma.evidenceItem.findFirst({
    where: { id, deleted_at: null },
  });

  if (!evidence) {
    throw new NotFoundError("Evidence", id);
  }

  const updated = await prisma.evidenceItem.update({
    where: { id },
    data: { status: "APPROVED" },
  });

  return c.json(updated);
});

// ─── PUT /evidence/:id/flag ───────────────────────────────────────────────────
const flagSchema = z.object({
  reason: z.string().optional(),
});

app.put("/:id/flag", authMiddleware(), requireRoles("QA_REVIEWER", "ADMINISTRATOR"), zValidator("json", flagSchema), async (c) => {
  const id = c.req.param("id")!;
  const { reason } = c.req.valid("json");

  const evidence = await prisma.evidenceItem.findFirst({
    where: { id, deleted_at: null },
  });

  if (!evidence) {
    throw new NotFoundError("Evidence", id);
  }

  const updated = await prisma.evidenceItem.update({
    where: { id },
    data: {
      status: "FLAGGED",
      metadata: {
        ...(typeof evidence.metadata === "object" && evidence.metadata ? evidence.metadata : {}),
        flagReason: reason ?? null,
      },
    },
  });

  return c.json(updated);
});

export default app;
