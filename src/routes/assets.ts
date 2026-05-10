import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import prisma from "../lib/prisma.js";
import { paginationSchema, buildCursorQuery, paginatedResponse } from "../utils/pagination.js";

const app = new Hono();

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
