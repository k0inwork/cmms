import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { authMiddleware, type AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

const VALID_ENTITY_TYPES = ["INSPECTION", "TICKET", "WORK_ORDER", "EVIDENCE"] as const;

const entityTableMap: Record<string, string> = {
  INSPECTION: "inspectionRecord",
  TICKET: "ticket",
  WORK_ORDER: "workOrder",
  EVIDENCE: "evidenceItem",
};

// ─── POST /sync/push ──────────────────────────────────────────────────────────

const pushChangeSchema = z.object({
  entityType: z.enum(VALID_ENTITY_TYPES),
  entityId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  version: z.number().int().min(1),
  data: z.record(z.unknown()),
  timestamp: z.string().datetime(),
});

const pushSchema = z.object({
  changes: z.array(pushChangeSchema).min(1).max(100),
});

app.post("/push", authMiddleware(), zValidator("json", pushSchema), async (c) => {
  const user = c.get("user");
  const { changes } = c.req.valid("json");

  const results = await Promise.all(
    changes.map(async (change) => {
      const table = entityTableMap[change.entityType];
      if (!table) {
        return {
          entityType: change.entityType,
          entityId: change.entityId,
          status: "REJECTED" as const,
          serverVersion: null,
          conflicts: null,
        };
      }

      // @ts-expect-error dynamic table access
      const existing = await prisma[table].findFirst({
        where: {
          id: change.entityId,
          deleted_at: null,
        },
      });

      if (!existing) {
        await prisma.syncEvent.create({
          data: {
            user_id: user.userId,
            entity_type: change.entityType,
            entity_id: change.entityId,
            sync_status: "FAILED",
            error_message: "Entity not found",
          },
        });

        return {
          entityType: change.entityType,
          entityId: change.entityId,
          status: "REJECTED" as const,
          serverVersion: null,
          conflicts: [{ field: "id", clientValue: change.entityId, serverValue: null, resolution: "ENTITY_NOT_FOUND" }],
        };
      }

      // Version conflict check — server version must match client version
      if (existing.version !== undefined && existing.version > change.version) {
        await prisma.syncEvent.create({
          data: {
            user_id: user.userId,
            entity_type: change.entityType,
            entity_id: change.entityId,
            sync_status: "CONFLICT",
            conflict_data: {
              clientVersion: change.version,
              serverVersion: existing.version,
            },
          },
        });

        return {
          entityType: change.entityType,
          entityId: change.entityId,
          status: "CONFLICT" as const,
          serverVersion: existing.version,
          conflicts: [
            {
              field: "version",
              clientValue: change.version,
              serverValue: existing.version,
              resolution: "MANUAL_REVIEW_REQUIRED",
            },
          ],
        };
      }

      // Apply the update
      try {
        // @ts-expect-error dynamic table access
        await prisma[table].update({
          where: { id: change.entityId },
          data: {
            ...change.data,
            sync_status: "SYNCED",
            ...(existing.version !== undefined ? { version: existing.version + 1 } : {}),
          },
        });

        await prisma.syncEvent.create({
          data: {
            user_id: user.userId,
            entity_type: change.entityType,
            entity_id: change.entityId,
            sync_status: "SYNCED",
            synced_at: new Date(),
          },
        });

        const newVersion = existing.version !== undefined ? existing.version + 1 : null;

        return {
          entityType: change.entityType,
          entityId: change.entityId,
          status: "SYNCED" as const,
          serverVersion: newVersion,
          conflicts: null,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await prisma.syncEvent.create({
          data: {
            user_id: user.userId,
            entity_type: change.entityType,
            entity_id: change.entityId,
            sync_status: "FAILED",
            error_message: message,
          },
        });

        return {
          entityType: change.entityType,
          entityId: change.entityId,
          status: "FAILED" as const,
          serverVersion: null,
          conflicts: null,
        };
      }
    })
  );

  return c.json({ results });
});

// ─── GET /sync/pull ───────────────────────────────────────────────────────────

const pullSchema = z.object({
  since: z.string().datetime(),
  entityTypes: z.string().optional(),
  cursor: z.string().uuid().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(Math.max(parseInt(v, 10), 1), 100) : 50)),
});

app.get("/pull", authMiddleware(), zValidator("query", pullSchema), async (c) => {
  const user = c.get("user");
  const { since, entityTypes, limit } = c.req.valid("query");

  const sinceDate = new Date(since);
  const types = entityTypes
    ? entityTypes.split(",").filter((t): t is typeof VALID_ENTITY_TYPES[number] => VALID_ENTITY_TYPES.includes(t as typeof VALID_ENTITY_TYPES[number]))
    : [...VALID_ENTITY_TYPES];

  const allChanges: Array<{
    entityType: string;
    entityId: string;
    action: string;
    version: number | null;
    data: Record<string, unknown>;
    timestamp: string;
  }> = [];

  for (const entityType of types) {
    const table = entityTableMap[entityType];
    if (!table) continue;

    const where: Record<string, unknown> = {
      updated_at: { gte: sinceDate },
      deleted_at: null,
    };

    // For user-owned entities, scope to the user
    if (entityType === "INSPECTION") {
      where.technician_id = user.userId;
    } else if (entityType === "EVIDENCE") {
      where.uploaded_by = user.userId;
    } else if (entityType === "TICKET") {
      where.OR = [
        { assignee_id: user.userId },
        { created_by: user.userId },
      ];
    } else if (entityType === "WORK_ORDER") {
      where.OR = [
        { assignee_id: user.userId },
        { created_by: user.userId },
      ];
    }

    // @ts-expect-error dynamic table access
    const records = await prisma[table].findMany({
      where,
      take: limit + 1,
      orderBy: { updated_at: "asc" },
      select: {
        id: true,
        updated_at: true,
        sync_status: true,
        version: true,
      },
    });

    for (const record of records) {
      // Determine action based on sync status or timestamps
      let action = "UPDATE";
      if (record.sync_status === "PENDING") {
        action = "CREATE";
      }

      allChanges.push({
        entityType,
        entityId: record.id,
        action,
        version: record.version ?? null,
        data: {},
        timestamp: record.updated_at.toISOString(),
      });
    }
  }

  // Sort by timestamp and apply pagination
  allChanges.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const hasMore = allChanges.length > limit;
  const changes = hasMore ? allChanges.slice(0, limit) : allChanges;

  return c.json({
    changes,
    serverTime: new Date().toISOString(),
    hasMore,
  });
});

// ─── GET /sync/status ─────────────────────────────────────────────────────────

app.get("/status", authMiddleware(), async (c) => {
  const user = c.get("user");

  const [pending, synced, failed, conflicts] = await Promise.all([
    prisma.syncEvent.count({ where: { user_id: user.userId, sync_status: "PENDING" } }),
    prisma.syncEvent.count({ where: { user_id: user.userId, sync_status: "SYNCED" } }),
    prisma.syncEvent.count({ where: { user_id: user.userId, sync_status: "FAILED" } }),
    prisma.syncEvent.count({ where: { user_id: user.userId, sync_status: "CONFLICT" } }),
  ]);

  const failedRecords = await prisma.syncEvent.findMany({
    where: {
      user_id: user.userId,
      sync_status: { in: ["FAILED", "CONFLICT"] },
    },
    select: {
      entity_type: true,
      entity_id: true,
      error_message: true,
      created_at: true,
    },
    orderBy: { created_at: "desc" },
    take: 10,
  });

  return c.json({
    pending,
    synced,
    failed,
    conflicts,
    failedRecords: failedRecords.map((r) => ({
      entityType: r.entity_type,
      entityId: r.entity_id,
      error: r.error_message,
      lastAttempt: r.created_at.toISOString(),
    })),
  });
});

export default app;
