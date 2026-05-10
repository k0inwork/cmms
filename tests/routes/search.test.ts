import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock data ─────────────────────────────────────────────────────────────────

const TKT_ID = "aaaaaaaa-0001-0000-0000-000000000001";
const WO_ID = "aaaaaaaa-0002-0000-0000-000000000001";
const INSP_ID = "aaaaaaaa-0003-0000-0000-000000000001";
const TURB_ID = "aaaaaaaa-0004-0000-0000-000000000001";
const COMP_ID = "aaaaaaaa-0005-0000-0000-000000000001";
const SITE_ID = "aaaaaaaa-0006-0000-0000-000000000001";
const ASSIGNEE_ID = "aaaaaaaa-0007-0000-0000-000000000001";

const mockTicket = {
  id: TKT_ID,
  title: "Blade crack detected",
  description: "Major crack found on blade 2",
  status: "NEW",
  priority: "HIGH",
  created_at: new Date("2026-03-01"),
  updated_at: new Date("2026-03-01"),
  deleted_at: null,
  assignee: { id: ASSIGNEE_ID, first_name: "Jane", last_name: "Doe" },
  turbine: { id: TURB_ID, name: "WTG-001", site: { id: SITE_ID, name: "North Farm" } },
};

const mockWorkOrder = {
  id: WO_ID,
  title: "Fix blade crack",
  description: "Repair blade 2 crack on WTG-001",
  status: "ASSIGNED",
  priority: "HIGH",
  created_at: new Date("2026-03-02"),
  updated_at: new Date("2026-03-02"),
  deleted_at: null,
  assignee: { id: ASSIGNEE_ID, first_name: "Jane", last_name: "Doe" },
  turbine: { id: TURB_ID, name: "WTG-001", site: { id: SITE_ID, name: "North Farm" } },
};

const mockInspection = {
  id: INSP_ID,
  review_notes: "Check blade integrity",
  status: "SUBMITTED",
  created_at: new Date("2026-03-03"),
  updated_at: new Date("2026-03-03"),
  deleted_at: null,
  technician: { id: ASSIGNEE_ID, first_name: "Jane", last_name: "Doe" },
  turbine: { id: TURB_ID, name: "WTG-001", site: { id: SITE_ID, name: "North Farm" } },
  template_version: { template: { id: "tpl-1", name: "Blade Inspection" } },
};

const mockTurbine = {
  id: TURB_ID,
  name: "WTG-001",
  model: "Vestas V90",
  status: "ACTIVE",
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  deleted_at: null,
  site: { id: SITE_ID, name: "North Farm" },
};

const mockComponent = {
  id: COMP_ID,
  name: "Main Bearing",
  status: "ACTIVE",
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  deleted_at: null,
  subsystem: {
    turbine: { id: TURB_ID, name: "WTG-001", site: { id: SITE_ID, name: "North Farm" } },
  },
};

// ── Prisma mock ───────────────────────────────────────────────────────────────

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    ticket: { findMany: vi.fn() },
    workOrder: { findMany: vi.fn() },
    inspectionRecord: { findMany: vi.fn() },
    turbine: { findMany: vi.fn() },
    component: { findMany: vi.fn() },
  },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { Hono } from "hono";
import prisma from "../../src/lib/prisma.js";
import searchRoutes from "../../src/routes/search.js";

function makeApp() {
  const app = new Hono();
  app.route("/search", searchRoutes);
  return app;
}

const app = makeApp();

// ── Helpers ───────────────────────────────────────────────────────────────────

function setAllEmpty() {
  vi.mocked(prisma.ticket.findMany).mockResolvedValue([]);
  vi.mocked(prisma.workOrder.findMany).mockResolvedValue([]);
  vi.mocked(prisma.inspectionRecord.findMany).mockResolvedValue([]);
  vi.mocked(prisma.turbine.findMany).mockResolvedValue([]);
  vi.mocked(prisma.component.findMany).mockResolvedValue([]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAllEmpty();
  });

  it("returns empty results when nothing matches", async () => {
    const res = await app.request("/search?q=nonexistent");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.pagination.has_more).toBe(false);
    expect(body.pagination.next_cursor).toBeNull();
  });

  it("searches across all entity types by default", async () => {
    await app.request("/search?q=blade");
    expect(prisma.ticket.findMany).toHaveBeenCalled();
    expect(prisma.workOrder.findMany).toHaveBeenCalled();
    expect(prisma.inspectionRecord.findMany).toHaveBeenCalled();
    expect(prisma.turbine.findMany).toHaveBeenCalled();
    expect(prisma.component.findMany).toHaveBeenCalled();
  });

  it("limits search to specified type", async () => {
    await app.request("/search?type=ticket&q=blade");
    expect(prisma.ticket.findMany).toHaveBeenCalled();
    expect(prisma.workOrder.findMany).not.toHaveBeenCalled();
    expect(prisma.inspectionRecord.findMany).not.toHaveBeenCalled();
  });

  it("handles multiple comma-separated types", async () => {
    await app.request("/search?type=ticket,work_order&q=blade");
    expect(prisma.ticket.findMany).toHaveBeenCalled();
    expect(prisma.workOrder.findMany).toHaveBeenCalled();
    expect(prisma.inspectionRecord.findMany).not.toHaveBeenCalled();
  });

  it("merges and sorts results from multiple types", async () => {
    vi.mocked(prisma.ticket.findMany).mockResolvedValue([mockTicket as never]);
    vi.mocked(prisma.workOrder.findMany).mockResolvedValue([mockWorkOrder as never]);

    const res = await app.request("/search?type=ticket,work_order&q=blade");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(2);
    // Descending by created_at: WO (Mar 2) then Ticket (Mar 1)
    expect(body.data[0].type).toBe("WORK_ORDER");
    expect(body.data[1].type).toBe("TICKET");
  });

  it("filters by status", async () => {
    await app.request("/search?type=ticket&status=NEW");
    const call = vi.mocked(prisma.ticket.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where).toMatchObject({ AND: expect.arrayContaining([{ status: "NEW" }]) });
  });

  it("filters by priority", async () => {
    await app.request("/search?type=ticket&priority=HIGH");
    const call = vi.mocked(prisma.ticket.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where).toMatchObject({ AND: expect.arrayContaining([{ priority: "HIGH" }]) });
  });

  it("filters by assigneeId", async () => {
    await app.request(`/search?type=ticket&assigneeId=${ASSIGNEE_ID}`);
    const call = vi.mocked(prisma.ticket.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where).toMatchObject({ AND: expect.arrayContaining([{ assignee_id: ASSIGNEE_ID }]) });
  });

  it("filters by turbineId", async () => {
    await app.request(`/search?type=ticket&turbineId=${TURB_ID}`);
    const call = vi.mocked(prisma.ticket.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where).toMatchObject({ AND: expect.arrayContaining([{ turbine_id: TURB_ID }]) });
  });

  it("filters by siteId via turbine relation", async () => {
    await app.request(`/search?type=ticket&siteId=${SITE_ID}`);
    const call = vi.mocked(prisma.ticket.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where).toMatchObject({ AND: expect.arrayContaining([{ turbine: { site_id: SITE_ID } }]) });
  });

  it("filters by date range", async () => {
    await app.request("/search?type=ticket&createdAfter=2026-03-01T00:00:00Z&createdBefore=2026-03-31T23:59:59Z");
    const call = vi.mocked(prisma.ticket.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    const and = call.where as { AND: Record<string, unknown>[] };
    const dateCond = and.AND.find((c) => "created_at" in c);
    expect(dateCond).toBeDefined();
    const dateRange = (dateCond as { created_at: Record<string, Date> }).created_at;
    expect(dateRange.gte).toEqual(new Date("2026-03-01T00:00:00Z"));
    expect(dateRange.lte).toEqual(new Date("2026-03-31T23:59:59Z"));
  });

  it("sorts ascending when order=asc", async () => {
    await app.request("/search?type=ticket&order=asc");
    const call = vi.mocked(prisma.ticket.findMany).mock.calls[0][0] as { orderBy: Record<string, string> };
    expect(call.orderBy).toEqual({ created_at: "asc" });
  });

  it("sorts by updated_at when specified", async () => {
    await app.request("/search?type=ticket&sort=updated_at");
    const call = vi.mocked(prisma.ticket.findMany).mock.calls[0][0] as { orderBy: Record<string, string> };
    expect(call.orderBy).toEqual({ updated_at: "desc" });
  });

  it("paginates with cursor", async () => {
    vi.mocked(prisma.ticket.findMany).mockResolvedValue([mockTicket as never]);

    const res = await app.request("/search?type=ticket&limit=1");
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.pagination.has_more).toBe(false);

    // Cursor is base64 encoded JSON with id and ts
    if (body.pagination.next_cursor) {
      const cursor = JSON.parse(
        Buffer.from(body.pagination.next_cursor, "base64").toString(),
      );
      expect(cursor).toHaveProperty("id");
      expect(cursor).toHaveProperty("ts");
    }
  });

  it("respects limit parameter", async () => {
    vi.mocked(prisma.ticket.findMany).mockResolvedValue([mockTicket as never]);
    vi.mocked(prisma.workOrder.findMany).mockResolvedValue([mockWorkOrder as never]);

    const res = await app.request("/search?type=ticket,work_order&limit=1");
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.pagination.has_more).toBe(true);
    expect(body.pagination.next_cursor).toBeTruthy();
  });

  it("returns correct shape for ticket hits", async () => {
    vi.mocked(prisma.ticket.findMany).mockResolvedValue([mockTicket as never]);

    const res = await app.request("/search?type=ticket");
    const body = await res.json();
    const hit = body.data[0];

    expect(hit).toEqual({
      id: TKT_ID,
      type: "TICKET",
      title: "Blade crack detected",
      description: "Major crack found on blade 2",
      status: "NEW",
      priority: "HIGH",
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      assignee: { id: ASSIGNEE_ID, firstName: "Jane", lastName: "Doe" },
      turbine: { id: TURB_ID, name: "WTG-001" },
      site: { id: SITE_ID, name: "North Farm" },
    });
  });

  it("returns correct shape for work order hits", async () => {
    vi.mocked(prisma.workOrder.findMany).mockResolvedValue([mockWorkOrder as never]);

    const res = await app.request("/search?type=work_order");
    const body = await res.json();
    expect(body.data[0].type).toBe("WORK_ORDER");
    expect(body.data[0].title).toBe("Fix blade crack");
  });

  it("returns correct shape for inspection hits", async () => {
    vi.mocked(prisma.inspectionRecord.findMany).mockResolvedValue([mockInspection as never]);

    const res = await app.request("/search?type=inspection");
    const body = await res.json();
    const hit = body.data[0];

    expect(hit.type).toBe("INSPECTION");
    expect(hit.title).toBe("Blade Inspection");
    expect(hit.assignee).toEqual({ id: ASSIGNEE_ID, firstName: "Jane", lastName: "Doe" });
  });

  it("returns correct shape for turbine hits", async () => {
    vi.mocked(prisma.turbine.findMany).mockResolvedValue([mockTurbine as never]);

    const res = await app.request("/search?type=turbine");
    const body = await res.json();
    const hit = body.data[0];

    expect(hit.type).toBe("TURBINE");
    expect(hit.title).toBe("WTG-001");
    expect(hit.description).toBe("Vestas V90");
    expect(hit.assignee).toBeNull();
    expect(hit.turbine).toEqual({ id: TURB_ID, name: "WTG-001" });
    expect(hit.site).toEqual({ id: SITE_ID, name: "North Farm" });
  });

  it("returns correct shape for component hits", async () => {
    vi.mocked(prisma.component.findMany).mockResolvedValue([mockComponent as never]);

    const res = await app.request("/search?type=component");
    const body = await res.json();
    const hit = body.data[0];

    expect(hit.type).toBe("COMPONENT");
    expect(hit.title).toBe("Main Bearing");
    expect(hit.turbine).toEqual({ id: TURB_ID, name: "WTG-001" });
    expect(hit.site).toEqual({ id: SITE_ID, name: "North Farm" });
  });

  it("returns 400 for invalid query params", async () => {
    const res = await app.request("/search?priority=INVALID");
    expect(res.status).toBe(400);
  });

  it("works without q parameter (filter-only mode)", async () => {
    vi.mocked(prisma.ticket.findMany).mockResolvedValue([mockTicket as never]);

    const res = await app.request("/search?type=ticket&status=NEW");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });
});
