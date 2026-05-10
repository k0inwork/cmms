import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import prisma from "../lib/prisma.js";

const app = new Hono();

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_TYPES = ["TICKET", "WORK_ORDER", "INSPECTION", "TURBINE", "COMPONENT"] as const;
type EntityType = (typeof VALID_TYPES)[number];

// ── Validation schema ─────────────────────────────────────────────────────────

const searchQuerySchema = z.object({
  q: z.string().min(1).optional(),
  type: z
    .string()
    .optional()
    .transform((v): EntityType[] => {
      if (!v) return [...VALID_TYPES];
      return v
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((t): t is EntityType => (VALID_TYPES as readonly string[]).includes(t));
    }),
  status: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  assigneeId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  turbineId: z.string().uuid().optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  sort: z.enum(["created_at", "updated_at"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(Math.max(parseInt(v, 10), 1), 100) : 25)),
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchHit {
  id: string;
  type: EntityType;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: { id: string; firstName: string; lastName: string } | null;
  turbine: { id: string; name: string } | null;
  site: { id: string; name: string } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function textFilter(q: string, fields: string[]) {
  return { OR: fields.map((f) => ({ [f]: { contains: q, mode: "insensitive" as const } })) };
}

function buildWhere(conditions: Record<string, unknown>[]) {
  return conditions.length === 1 ? conditions[0] : { AND: conditions };
}

function cursorCondition(
  sort: string,
  order: "asc" | "desc",
  cursorId: string,
  cursorTs: string,
) {
  const d = new Date(cursorTs);
  const dir = order === "desc" ? "lt" : "gt";
  return {
    OR: [{ [sort]: { [dir]: d } }, { [sort]: d, id: { [dir]: cursorId } }],
  };
}

function encodeCursor(id: string, ts: string): string {
  return Buffer.from(JSON.stringify({ id, ts })).toString("base64");
}

function decodeCursor(cursor: string): { id: string; ts: string } | null {
  try {
    return JSON.parse(Buffer.from(cursor, "base64").toString());
  } catch {
    return null;
  }
}

// ── Entity search functions ───────────────────────────────────────────────────

interface SearchParams {
  q?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  siteId?: string;
  turbineId?: string;
  createdAfter?: string;
  createdBefore?: string;
  sort: string;
  order: "asc" | "desc";
  take: number;
  cursorId?: string;
  cursorTs?: string;
}

function addDateAndCursor(
  conds: Record<string, unknown>[],
  p: SearchParams,
) {
  const dateFilter: Record<string, unknown> = {};
  if (p.createdAfter) dateFilter.gte = new Date(p.createdAfter);
  if (p.createdBefore) dateFilter.lte = new Date(p.createdBefore);
  if (Object.keys(dateFilter).length > 0) conds.push({ [p.sort]: dateFilter });
  if (p.cursorId && p.cursorTs) conds.push(cursorCondition(p.sort, p.order, p.cursorId, p.cursorTs));
}

async function searchTickets(p: SearchParams): Promise<SearchHit[]> {
  const conds: Record<string, unknown>[] = [{ deleted_at: null }];
  if (p.q) conds.push(textFilter(p.q, ["title", "description"]));
  if (p.status) conds.push({ status: p.status });
  if (p.priority) conds.push({ priority: p.priority });
  if (p.assigneeId) conds.push({ assignee_id: p.assigneeId });
  if (p.turbineId) conds.push({ turbine_id: p.turbineId });
  if (p.siteId) conds.push({ turbine: { site_id: p.siteId } });
  addDateAndCursor(conds, p);

  const items = await prisma.ticket.findMany({
    where: buildWhere(conds),
    take: p.take,
    orderBy: { [p.sort]: p.order },
    include: {
      assignee: { select: { id: true, first_name: true, last_name: true } },
      turbine: {
        select: { id: true, name: true, site: { select: { id: true, name: true } } },
      },
    },
  });

  return items.map((t) => ({
    id: t.id,
    type: "TICKET" as const,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    createdAt: t.created_at.toISOString(),
    updatedAt: t.updated_at.toISOString(),
    assignee: t.assignee
      ? { id: t.assignee.id, firstName: t.assignee.first_name, lastName: t.assignee.last_name }
      : null,
    turbine: t.turbine ? { id: t.turbine.id, name: t.turbine.name } : null,
    site: t.turbine?.site ?? null,
  }));
}

async function searchWorkOrders(p: SearchParams): Promise<SearchHit[]> {
  const conds: Record<string, unknown>[] = [{ deleted_at: null }];
  if (p.q) conds.push(textFilter(p.q, ["title", "description"]));
  if (p.status) conds.push({ status: p.status });
  if (p.priority) conds.push({ priority: p.priority });
  if (p.assigneeId) conds.push({ assignee_id: p.assigneeId });
  if (p.turbineId) conds.push({ turbine_id: p.turbineId });
  if (p.siteId) conds.push({ turbine: { site_id: p.siteId } });
  addDateAndCursor(conds, p);

  const items = await prisma.workOrder.findMany({
    where: buildWhere(conds),
    take: p.take,
    orderBy: { [p.sort]: p.order },
    include: {
      assignee: { select: { id: true, first_name: true, last_name: true } },
      turbine: {
        select: { id: true, name: true, site: { select: { id: true, name: true } } },
      },
    },
  });

  return items.map((w) => ({
    id: w.id,
    type: "WORK_ORDER" as const,
    title: w.title,
    description: w.description,
    status: w.status,
    priority: w.priority,
    createdAt: w.created_at.toISOString(),
    updatedAt: w.updated_at.toISOString(),
    assignee: w.assignee
      ? { id: w.assignee.id, firstName: w.assignee.first_name, lastName: w.assignee.last_name }
      : null,
    turbine: w.turbine ? { id: w.turbine.id, name: w.turbine.name } : null,
    site: w.turbine?.site ?? null,
  }));
}

async function searchInspections(p: SearchParams): Promise<SearchHit[]> {
  const conds: Record<string, unknown>[] = [{ deleted_at: null }];
  if (p.q) {
    conds.push({
      OR: [
        { review_notes: { contains: p.q, mode: "insensitive" } },
        { template_version: { template: { name: { contains: p.q, mode: "insensitive" } } } },
      ],
    });
  }
  if (p.status) conds.push({ status: p.status });
  if (p.assigneeId) conds.push({ technician_id: p.assigneeId });
  if (p.turbineId) conds.push({ turbine_id: p.turbineId });
  if (p.siteId) conds.push({ turbine: { site_id: p.siteId } });
  addDateAndCursor(conds, p);

  const items = await prisma.inspectionRecord.findMany({
    where: buildWhere(conds),
    take: p.take,
    orderBy: { [p.sort]: p.order },
    include: {
      technician: { select: { id: true, first_name: true, last_name: true } },
      turbine: {
        select: { id: true, name: true, site: { select: { id: true, name: true } } },
      },
      template_version: {
        select: { template: { select: { id: true, name: true } } },
      },
    },
  });

  return items.map((i) => ({
    id: i.id,
    type: "INSPECTION" as const,
    title: i.template_version?.template?.name ?? `Inspection ${i.id.slice(0, 8)}`,
    description: i.review_notes ?? null,
    status: i.status,
    priority: null,
    createdAt: i.created_at.toISOString(),
    updatedAt: i.updated_at.toISOString(),
    assignee: i.technician
      ? { id: i.technician.id, firstName: i.technician.first_name, lastName: i.technician.last_name }
      : null,
    turbine: i.turbine ? { id: i.turbine.id, name: i.turbine.name } : null,
    site: i.turbine?.site ?? null,
  }));
}

async function searchTurbines(p: SearchParams): Promise<SearchHit[]> {
  const conds: Record<string, unknown>[] = [{ deleted_at: null }];
  if (p.q) conds.push(textFilter(p.q, ["name", "model"]));
  if (p.status) conds.push({ status: p.status });
  if (p.siteId) conds.push({ site_id: p.siteId });
  addDateAndCursor(conds, p);

  const items = await prisma.turbine.findMany({
    where: buildWhere(conds),
    take: p.take,
    orderBy: { [p.sort]: p.order },
    include: { site: { select: { id: true, name: true } } },
  });

  return items.map((t) => ({
    id: t.id,
    type: "TURBINE" as const,
    title: t.name,
    description: t.model ?? null,
    status: t.status,
    priority: null,
    createdAt: t.created_at.toISOString(),
    updatedAt: t.updated_at.toISOString(),
    assignee: null,
    turbine: { id: t.id, name: t.name },
    site: t.site ?? null,
  }));
}

async function searchComponents(p: SearchParams): Promise<SearchHit[]> {
  const conds: Record<string, unknown>[] = [{ deleted_at: null }];
  if (p.q) conds.push(textFilter(p.q, ["name"]));
  if (p.status) conds.push({ status: p.status });
  if (p.turbineId) conds.push({ subsystem: { turbine_id: p.turbineId } });
  if (p.siteId) conds.push({ subsystem: { turbine: { site_id: p.siteId } } });
  addDateAndCursor(conds, p);

  const items = await prisma.component.findMany({
    where: buildWhere(conds),
    take: p.take,
    orderBy: { [p.sort]: p.order },
    include: {
      subsystem: {
        select: {
          turbine: {
            select: { id: true, name: true, site: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  return items.map((c) => ({
    id: c.id,
    type: "COMPONENT" as const,
    title: c.name,
    description: null,
    status: c.status,
    priority: null,
    createdAt: c.created_at.toISOString(),
    updatedAt: c.updated_at.toISOString(),
    assignee: null,
    turbine: c.subsystem?.turbine ? { id: c.subsystem.turbine.id, name: c.subsystem.turbine.name } : null,
    site: c.subsystem?.turbine?.site ?? null,
  }));
}

// ── Route ─────────────────────────────────────────────────────────────────────

app.get("/", zValidator("query", searchQuerySchema), async (c) => {
  const {
    q,
    type: types,
    status,
    priority,
    assigneeId,
    siteId,
    turbineId,
    createdAfter,
    createdBefore,
    sort,
    order,
    cursor,
    limit,
  } = c.req.valid("query");

  const cursorData = cursor ? decodeCursor(cursor) : null;
  const sp: SearchParams = {
    q,
    status,
    priority,
    assigneeId,
    siteId,
    turbineId,
    createdAfter,
    createdBefore,
    sort,
    order,
    take: limit + 1,
    cursorId: cursorData?.id,
    cursorTs: cursorData?.ts,
  };

  const queries: Promise<SearchHit[]>[] = [];
  if (types.includes("TICKET")) queries.push(searchTickets(sp));
  if (types.includes("WORK_ORDER")) queries.push(searchWorkOrders(sp));
  if (types.includes("INSPECTION")) queries.push(searchInspections(sp));
  if (types.includes("TURBINE")) queries.push(searchTurbines(sp));
  if (types.includes("COMPONENT")) queries.push(searchComponents(sp));

  const all = (await Promise.all(queries)).flat();

  // Sort merged results
  all.sort((a, b) => {
    const aVal = sort === "created_at" ? a.createdAt : a.updatedAt;
    const bVal = sort === "created_at" ? b.createdAt : b.updatedAt;
    const cmp = aVal.localeCompare(bVal);
    return order === "desc" ? -cmp : cmp;
  });

  const has_more = all.length > limit;
  const data = has_more ? all.slice(0, limit) : all;
  const next_cursor =
    has_more && data.length > 0
      ? encodeCursor(data[data.length - 1].id, sort === "created_at" ? data[data.length - 1].createdAt : data[data.length - 1].updatedAt)
      : null;

  return c.json({ data, pagination: { next_cursor, has_more } });
});

export default app;
