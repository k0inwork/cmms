import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { paginationSchema, buildCursorQuery, paginatedResponse } from "../utils/pagination.js";
import { authMiddleware } from "../middleware/auth.js";

const app = new Hono();

// GET /assets/lookup?qr_code=<uuid> — QR code scanner lookup
app.get(
  "/lookup",
  authMiddleware(),
  zValidator("query", z.object({ qr_code: z.string().uuid() })),
  async (c) => {
    const { qr_code } = c.req.valid("query");

    // Search across asset hierarchy: Turbine, Subsystem, Component
    const [turbine, subsystem, component] = await Promise.all([
      prisma.turbine.findUnique({
        where: { id: qr_code },
        include: { site: { select: { id: true, name: true, organization_id: true } } },
      }),
      prisma.subsystem.findUnique({
        where: { id: qr_code },
        include: { turbine: { select: { id: true, name: true, site: { select: { id: true, name: true, organization_id: true } } } } },
      }),
      prisma.component.findUnique({
        where: { id: qr_code },
        include: { subsystem: { select: { id: true, name: true, turbine: { select: { id: true, name: true, site: { select: { id: true, name: true, organization_id: true } } } } } } },
      }),
    ]);

    const entity = turbine ?? subsystem ?? component;
    if (!entity) {
      return c.json({ error: "Asset not found" }, 404);
    }

    const entityType = turbine ? "Turbine" : subsystem ? "Subsystem" : "Component";

    // Normalize hierarchy into a consistent response
    let hierarchy: Record<string, unknown>;
    if (turbine) {
      hierarchy = {
        type: entityType,
        id: turbine.id,
        name: turbine.name,
        status: turbine.status,
        site: turbine.site,
      };
    } else if (subsystem) {
      hierarchy = {
        type: entityType,
        id: subsystem.id,
        name: subsystem.name,
        turbine: subsystem.turbine,
      };
    } else {
      hierarchy = {
        type: entityType,
        id: component!.id,
        name: component!.name,
        status: component!.status,
        subsystem: component!.subsystem,
      };
    }

    return c.json(hierarchy);
  },
);

// GET /assets/:id/history — audit history for any asset
app.get("/:id/history", zValidator("query", paginationSchema), async (c) => {
  const id = c.req.param("id")!;
  const { cursor, limit } = c.req.valid("query");

  const events = await prisma.auditEvent.findMany({
    where: { entity_id: id },
    take: limit + 1,
    orderBy: { created_at: "desc" },
    ...buildCursorQuery(cursor),
  });

  return c.json(paginatedResponse(events, limit));
});

export default app;
