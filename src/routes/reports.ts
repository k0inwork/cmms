import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { authMiddleware, requireRoles, type AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

// ── Schemas ──────────────────────────────────────────────────────────────────

const reportQuerySchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  orgId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  format: z.enum(["json", "csv"]).default("json"),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function toCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.join(","),
    ...data.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");
}

function dateWhere(dateFrom?: string, dateTo?: string, field = "created_at") {
  if (!dateFrom && !dateTo) return {};
  return {
    [field]: {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    },
  };
}

function turbineSiteFilter(orgId?: string, siteId?: string) {
  if (!orgId && !siteId) return {};
  return {
    turbine: {
      site: {
        ...(orgId ? { organization_id: orgId } : {}),
        ...(siteId ? { id: siteId } : {}),
      },
    },
  };
}

function csvResponse(
  c: { text: (body: string, status: number, headers: Record<string, string>) => Response },
  data: Record<string, unknown>[],
  filename: string,
) {
  return c.text(toCSV(data), 200, {
    "Content-Type": "text/csv",
    "Content-Disposition": `attachment; filename=${filename}`,
  });
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /reports/compliance — inspection compliance metrics
app.get(
  "/compliance",
  authMiddleware(),
  requireRoles("ADMINISTRATOR", "OPERATIONS_MANAGER"),
  zValidator("query", reportQuerySchema),
  async (c) => {
    const { dateFrom, dateTo, orgId, siteId, format } = c.req.valid("query");

    const where = {
      deleted_at: null,
      ...dateWhere(dateFrom, dateTo),
      ...turbineSiteFilter(orgId, siteId),
    };

    const statusCounts = await prisma.inspectionRecord.groupBy({
      by: ["status"],
      where,
      _count: true,
    });

    const total = statusCounts.reduce((sum, s) => sum + s._count, 0);
    const completed = statusCounts
      .filter((s) => ["SUBMITTED", "APPROVED"].includes(s.status))
      .reduce((sum, s) => sum + s._count, 0);
    const rejected = statusCounts
      .filter((s) => s.status === "REJECTED")
      .reduce((sum, s) => sum + s._count, 0);

    const overdue = await prisma.inspectionRecord.count({
      where: {
        ...where,
        due_date: { lt: new Date() },
        status: { notIn: ["SUBMITTED", "APPROVED"] },
      },
    });

    if (format === "csv") {
      return csvResponse(
        c,
        statusCounts.map((s) => ({ status: s.status, count: s._count })),
        "compliance-report.csv",
      );
    }

    return c.json({
      report_type: "compliance",
      generated_at: new Date().toISOString(),
      filters: { dateFrom: dateFrom ?? null, dateTo: dateTo ?? null, orgId: orgId ?? null, siteId: siteId ?? null },
      summary: {
        total_inspections: total,
        completed,
        rejected,
        overdue,
        approval_rate: total > 0 ? completed / total : 0,
        rejection_rate: total > 0 ? rejected / total : 0,
      },
      by_status: Object.fromEntries(statusCounts.map((s) => [s.status, s._count])),
    });
  },
);

// GET /reports/inspections — inspection status breakdown with timing
app.get(
  "/inspections",
  authMiddleware(),
  requireRoles("ADMINISTRATOR", "OPERATIONS_MANAGER", "QA_REVIEWER"),
  zValidator("query", reportQuerySchema),
  async (c) => {
    const { dateFrom, dateTo, orgId, siteId, format } = c.req.valid("query");

    const where = {
      deleted_at: null,
      ...dateWhere(dateFrom, dateTo),
      ...turbineSiteFilter(orgId, siteId),
    };

    const statusCounts = await prisma.inspectionRecord.groupBy({
      by: ["status"],
      where,
      _count: true,
    });

    const total = statusCounts.reduce((sum, s) => sum + s._count, 0);

    const completedRecords = await prisma.inspectionRecord.findMany({
      where: { ...where, status: { in: ["SUBMITTED", "APPROVED"] } },
      select: { started_at: true, submitted_at: true },
    });

    const withTiming = completedRecords.filter((r) => r.started_at && r.submitted_at);
    const avgHours =
      withTiming.length > 0
        ? withTiming.reduce(
            (sum, r) => sum + (r.submitted_at!.getTime() - r.started_at!.getTime()),
            0,
          ) /
          withTiming.length /
          (1000 * 60 * 60)
        : null;

    if (format === "csv") {
      return csvResponse(
        c,
        statusCounts.map((s) => ({ status: s.status, count: s._count })),
        "inspections-report.csv",
      );
    }

    return c.json({
      report_type: "inspections",
      generated_at: new Date().toISOString(),
      filters: { dateFrom: dateFrom ?? null, dateTo: dateTo ?? null, orgId: orgId ?? null, siteId: siteId ?? null },
      summary: { total, avg_completion_hours: avgHours },
      by_status: Object.fromEntries(statusCounts.map((s) => [s.status, s._count])),
    });
  },
);

// GET /reports/work-orders — work order status and priority breakdown
app.get(
  "/work-orders",
  authMiddleware(),
  requireRoles("ADMINISTRATOR", "OPERATIONS_MANAGER", "DISPATCHER"),
  zValidator("query", reportQuerySchema),
  async (c) => {
    const { dateFrom, dateTo, orgId, siteId, format } = c.req.valid("query");

    const where = {
      deleted_at: null,
      ...dateWhere(dateFrom, dateTo),
      ...turbineSiteFilter(orgId, siteId),
    };

    const statusCounts = await prisma.workOrder.groupBy({
      by: ["status"],
      where,
      _count: true,
    });

    const priorityCounts = await prisma.workOrder.groupBy({
      by: ["priority"],
      where,
      _count: true,
    });

    const total = statusCounts.reduce((sum, s) => sum + s._count, 0);
    const closed = statusCounts
      .filter((s) => s.status === "CLOSED")
      .reduce((sum, s) => sum + s._count, 0);

    const closedOrders = await prisma.workOrder.findMany({
      where: { ...where, status: "CLOSED" },
      select: { started_at: true, completed_at: true },
    });

    const withTiming = closedOrders.filter((wo) => wo.started_at && wo.completed_at);
    const avgHours =
      withTiming.length > 0
        ? withTiming.reduce(
            (sum, wo) => sum + (wo.completed_at!.getTime() - wo.started_at!.getTime()),
            0,
          ) /
          withTiming.length /
          (1000 * 60 * 60)
        : null;

    if (format === "csv") {
      return csvResponse(
        c,
        statusCounts.map((s) => ({ status: s.status, count: s._count })),
        "work-orders-report.csv",
      );
    }

    return c.json({
      report_type: "work-orders",
      generated_at: new Date().toISOString(),
      filters: { dateFrom: dateFrom ?? null, dateTo: dateTo ?? null, orgId: orgId ?? null, siteId: siteId ?? null },
      summary: { total, closed, avg_completion_hours: avgHours },
      by_status: Object.fromEntries(statusCounts.map((s) => [s.status, s._count])),
      by_priority: Object.fromEntries(priorityCounts.map((s) => [s.priority, s._count])),
    });
  },
);

// GET /reports/technician-productivity — per-technician completion stats
app.get(
  "/technician-productivity",
  authMiddleware(),
  requireRoles("ADMINISTRATOR", "OPERATIONS_MANAGER", "DISPATCHER"),
  zValidator("query", reportQuerySchema),
  async (c) => {
    const { dateFrom, dateTo, orgId, siteId, format } = c.req.valid("query");

    const userWhere: Record<string, unknown> = {
      role: "TECHNICIAN",
      is_active: true,
      deleted_at: null,
    };
    if (orgId) userWhere.organization_id = orgId;

    const technicians = await prisma.user.findMany({
      where: userWhere,
      select: { id: true, first_name: true, last_name: true, email: true },
    });

    const techIds = technicians.map((t) => t.id);
    if (techIds.length === 0) {
      const empty = [] as Record<string, unknown>[];
      if (format === "csv") return csvResponse(c, empty, "technician-productivity.csv");
      return c.json({
        report_type: "technician-productivity",
        generated_at: new Date().toISOString(),
        filters: { dateFrom: dateFrom ?? null, dateTo: dateTo ?? null, orgId: orgId ?? null, siteId: siteId ?? null },
        data: [],
      });
    }

    const siteFilter = siteId ? { turbine: { site: { id: siteId } } } : {};

    const woCounts = await prisma.workOrder.groupBy({
      by: ["assignee_id"],
      where: {
        assignee_id: { in: techIds },
        status: "CLOSED",
        deleted_at: null,
        ...dateWhere(dateFrom, dateTo, "completed_at"),
        ...siteFilter,
      },
      _count: true,
    });

    const inspCounts = await prisma.inspectionRecord.groupBy({
      by: ["technician_id"],
      where: {
        technician_id: { in: techIds },
        status: { in: ["SUBMITTED", "APPROVED"] },
        deleted_at: null,
        ...dateWhere(dateFrom, dateTo, "submitted_at"),
        ...siteFilter,
      },
      _count: true,
    });

    const woMap = Object.fromEntries(woCounts.map((w) => [w.assignee_id, w._count]));
    const inspMap = Object.fromEntries(inspCounts.map((i) => [i.technician_id, i._count]));

    const rows = technicians.map((t) => ({
      technician_id: t.id,
      name: `${t.first_name} ${t.last_name}`,
      email: t.email,
      work_orders_completed: woMap[t.id] ?? 0,
      inspections_completed: inspMap[t.id] ?? 0,
    }));

    if (format === "csv") {
      return csvResponse(c, rows, "technician-productivity.csv");
    }

    return c.json({
      report_type: "technician-productivity",
      generated_at: new Date().toISOString(),
      filters: { dateFrom: dateFrom ?? null, dateTo: dateTo ?? null, orgId: orgId ?? null, siteId: siteId ?? null },
      data: rows,
    });
  },
);

export default app;
