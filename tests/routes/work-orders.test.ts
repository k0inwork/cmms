import { describe, it, expect, vi, beforeEach } from "vitest";
import { signAccessToken } from "../../src/utils/jwt.js";

// ── Mock Prisma ─────────────────────────────────────────────────────────────

const WO_ID = "aaaaaaaa-0010-0000-0000-000000000001";
const TKT_ID = "aaaaaaaa-0001-0000-0000-000000000001";
const TURB_ID = "aaaaaaaa-0002-0000-0000-000000000001";
const COMPONENT_ID = "aaaaaaaa-0004-0000-0000-000000000001";
const EVIDENCE_ID = "aaaaaaaa-0005-0000-0000-000000000001";
const MISSING_ID = "cccccccc-0000-0000-000000000001";
const CLIENT_ID = "bbbbbbbb-0001-0000-0000-000000000001";
const ASSIGNEE_ID = "aaaaaaaa-0006-0000-0000-000000000001";

const mockWorkOrder = {
  id: WO_ID,
  ticket_id: TKT_ID,
  turbine_id: TURB_ID,
  component_id: null,
  assignee_id: null,
  created_by: "user-disp",
  title: "Replace blade bearing",
  description: "Bearing showing excessive wear",
  priority: "HIGH",
  status: "NEW",
  due_date: null,
  started_at: null,
  completed_at: null,
  resolution_notes: null,
  sync_status: "SYNCED",
  client_id: null,
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  deleted_at: null,
  ticket: { id: TKT_ID, title: "Blade crack detected", status: "NEW" },
  assignee: null,
  creator: { id: "user-disp", first_name: "Dispatch", last_name: "User" },
  turbine: { id: TURB_ID, name: "WTG-001" },
  component: null,
};

const mockAuditEvent = {
  id: "aaaaaaaa-0099-0000-0000-000000000001",
  entity_type: "WORK_ORDER",
  entity_id: WO_ID,
  action: "CREATE",
  user_id: "user-disp",
  before_state: null,
  after_state: { status: "NEW" },
  metadata: null,
  created_at: new Date("2026-01-01"),
  user: { id: "user-disp", first_name: "Dispatch", last_name: "User" },
};

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    workOrder: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    workOrderEvidence: {
      createMany: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    ticket: {
      findFirst: vi.fn(),
    },
    turbine: {
      findFirst: vi.fn(),
    },
    component: {
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  },
}));

import { Hono } from "hono";
import prisma from "../../src/lib/prisma.js";
import workOrderRoutes from "../../src/routes/work-orders.js";

function makeApp() {
  const app = new Hono();
  app.route("/work-orders", workOrderRoutes);
  return app;
}

function dispatcherToken() {
  return signAccessToken({
    userId: "user-disp",
    email: "disp@test.com",
    role: "DISPATCHER",
    organizationId: "org-001",
  });
}

function techToken() {
  return signAccessToken({
    userId: "user-tech",
    email: "tech@test.com",
    role: "TECHNICIAN",
    organizationId: "org-001",
  });
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

describe("Work Orders routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /work-orders ──────────────────────────────────────────────────────────

  describe("GET /work-orders", () => {
    it("returns paginated list", async () => {
      (prisma.workOrder.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { ...mockWorkOrder, _count: { work_order_evidence: 0 } },
      ]);

      const app = makeApp();
      const res = await app.request("/work-orders");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.pagination).toBeDefined();
    });

    it("filters by status", async () => {
      (prisma.workOrder.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const app = makeApp();
      const res = await app.request("/work-orders?status=NEW");

      expect(res.status).toBe(200);
      expect(prisma.workOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "NEW" }),
        }),
      );
    });

    it("filters by ticketId", async () => {
      (prisma.workOrder.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const app = makeApp();
      const res = await app.request(`/work-orders?ticketId=${TKT_ID}`);

      expect(res.status).toBe(200);
      expect(prisma.workOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ ticket_id: TKT_ID }),
        }),
      );
    });

    it("filters by assigneeId", async () => {
      (prisma.workOrder.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const app = makeApp();
      const res = await app.request(`/work-orders?assigneeId=${ASSIGNEE_ID}`);

      expect(res.status).toBe(200);
      expect(prisma.workOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assignee_id: ASSIGNEE_ID }),
        }),
      );
    });
  });

  // ── POST /work-orders ────────────────────────────────────────────────────────

  describe("POST /work-orders", () => {
    const createPayload = {
      ticketId: TKT_ID,
      title: "Replace blade bearing",
      description: "Bearing showing excessive wear",
      priority: "HIGH",
    };

    it("creates a work order from ticket (dispatcher)", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TKT_ID,
        turbine_id: TURB_ID,
        component_id: null,
      });
      (prisma.workOrder.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorkOrder);
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request("/work-orders", {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify(createPayload),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBe(WO_ID);

      expect(prisma.workOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "NEW",
            ticket_id: TKT_ID,
            priority: "HIGH",
          }),
        }),
      );

      expect(prisma.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "CREATE",
            entity_type: "WORK_ORDER",
          }),
        }),
      );
    });

    it("returns existing on duplicate clientId (idempotency)", async () => {
      const existing = { ...mockWorkOrder, client_id: CLIENT_ID };
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const app = makeApp();
      const res = await app.request("/work-orders", {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ ...createPayload, clientId: CLIENT_ID }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.client_id).toBe(CLIENT_ID);
    });

    it("links evidence on create", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TKT_ID,
        turbine_id: TURB_ID,
        component_id: null,
      });
      (prisma.workOrder.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorkOrder);
      (prisma.workOrderEvidence.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 1,
      });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request("/work-orders", {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ ...createPayload, evidenceIds: [EVIDENCE_ID] }),
      });

      expect(res.status).toBe(201);
      expect(prisma.workOrderEvidence.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ evidence_id: EVIDENCE_ID }),
          ]),
        }),
      );
    });

    it("returns 404 for missing ticket", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/work-orders", {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify(createPayload),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 for missing turbine", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TKT_ID,
        turbine_id: null,
      });
      (prisma.turbine.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/work-orders", {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ ...createPayload, turbineId: TURB_ID }),
      });

      expect(res.status).toBe(404);
    });

    it("rejects unauthenticated with 401", async () => {
      const app = makeApp();
      const res = await app.request("/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPayload),
      });

      expect(res.status).toBe(401);
    });

    it("rejects technician with 403", async () => {
      const app = makeApp();
      const res = await app.request("/work-orders", {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify(createPayload),
      });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /work-orders/:id ─────────────────────────────────────────────────────

  describe("GET /work-orders/:id", () => {
    it("returns full work order with evidence and audit events", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWorkOrder,
        work_order_evidence: [],
      });
      (prisma.auditEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        mockAuditEvent,
      ]);

      const app = makeApp();
      const res = await app.request(`/work-orders/${WO_ID}`);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(WO_ID);
      expect(body.audit_events).toHaveLength(1);
    });

    it("returns 404 for missing work order", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(`/work-orders/${MISSING_ID}`);

      expect(res.status).toBe(404);
    });
  });

  // ── PUT /work-orders/:id ──────────────────────────────────────────────────────

  describe("PUT /work-orders/:id", () => {
    it("updates title and priority", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorkOrder);
      (prisma.workOrder.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWorkOrder,
        title: "Updated title",
        priority: "CRITICAL",
      });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request(`/work-orders/${WO_ID}`, {
        method: "PUT",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ title: "Updated title", priority: "CRITICAL" }),
      });

      expect(res.status).toBe(200);
      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Updated title",
            priority: "CRITICAL",
          }),
        }),
      );
    });

    it("returns 404 for missing work order", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(`/work-orders/${MISSING_ID}`, {
        method: "PUT",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ title: "New title" }),
      });

      expect(res.status).toBe(404);
    });

    it("rejects unauthenticated with 401", async () => {
      const app = makeApp();
      const res = await app.request(`/work-orders/${WO_ID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New title" }),
      });

      expect(res.status).toBe(401);
    });
  });

  // ── PATCH /work-orders/:id/status ─────────────────────────────────────────────

  describe("PATCH /work-orders/:id/status", () => {
    it("transitions NEW → TRIAGED", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorkOrder);
      (prisma.workOrder.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWorkOrder,
        status: "TRIAGED",
      });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request(`/work-orders/${WO_ID}/status`, {
        method: "PATCH",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ status: "TRIAGED" }),
      });

      expect(res.status).toBe(200);
      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "TRIAGED" }),
        }),
      );
    });

    it("sets started_at when transitioning to IN_PROGRESS", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWorkOrder,
        status: "ASSIGNED",
      });
      (prisma.workOrder.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWorkOrder,
        status: "IN_PROGRESS",
      });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request(`/work-orders/${WO_ID}/status`, {
        method: "PATCH",
        headers: authHeaders(techToken()),
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });

      expect(res.status).toBe(200);
      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "IN_PROGRESS",
            started_at: expect.any(Date),
          }),
        }),
      );
    });

    it("sets completed_at when transitioning to CLOSED", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWorkOrder,
        status: "PENDING_REVIEW",
      });
      (prisma.workOrder.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWorkOrder,
        status: "CLOSED",
        completed_at: expect.any(Date),
      });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request(`/work-orders/${WO_ID}/status`, {
        method: "PATCH",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ status: "CLOSED" }),
      });

      expect(res.status).toBe(200);
      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ completed_at: expect.any(Date) }),
        }),
      );
    });

    it("returns 422 for invalid transition", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorkOrder);

      const app = makeApp();
      const res = await app.request(`/work-orders/${WO_ID}/status`, {
        method: "PATCH",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ status: "CLOSED" }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.code).toBe("WO_001");
    });

    it("returns 404 for missing work order", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(`/work-orders/${MISSING_ID}/status`, {
        method: "PATCH",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ status: "TRIAGED" }),
      });

      expect(res.status).toBe(404);
    });
  });

  // ── POST /work-orders/:id/assign ──────────────────────────────────────────────

  describe("POST /work-orders/:id/assign", () => {
    it("assigns a user and transitions NEW → ASSIGNED", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorkOrder);
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: ASSIGNEE_ID,
        is_active: true,
      });
      (prisma.workOrder.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWorkOrder,
        status: "ASSIGNED",
        assignee_id: ASSIGNEE_ID,
        assignee: { id: ASSIGNEE_ID, first_name: "Tech", last_name: "User" },
      });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request(`/work-orders/${WO_ID}/assign`, {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ assigneeId: ASSIGNEE_ID }),
      });

      expect(res.status).toBe(200);
      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignee_id: ASSIGNEE_ID,
            status: "ASSIGNED",
          }),
        }),
      );
    });

    it("returns 404 for missing assignee", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorkOrder);
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(`/work-orders/${WO_ID}/assign`, {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ assigneeId: ASSIGNEE_ID }),
      });

      expect(res.status).toBe(404);
    });

    it("rejects technician with 403", async () => {
      const app = makeApp();
      const res = await app.request(`/work-orders/${WO_ID}/assign`, {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({ assigneeId: "user-tech" }),
      });

      expect(res.status).toBe(403);
    });
  });

  // ── POST /work-orders/:id/close ──────────────────────────────────────────────

  describe("POST /work-orders/:id/close", () => {
    it("closes a PENDING_REVIEW work order with resolution", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWorkOrder,
        status: "PENDING_REVIEW",
      });
      (prisma.workOrder.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWorkOrder,
        status: "CLOSED",
        resolution_notes: "Replaced bearing",
        completed_at: expect.any(Date),
      });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request(`/work-orders/${WO_ID}/close`, {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({
          resolutionNotes: "Replaced bearing",
          evidenceIds: [EVIDENCE_ID],
        }),
      });

      expect(res.status).toBe(200);
      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "CLOSED",
            resolution_notes: "Replaced bearing",
          }),
        }),
      );
      expect(prisma.workOrderEvidence.createMany).toHaveBeenCalled();
    });

    it("closes an IN_PROGRESS work order", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWorkOrder,
        status: "IN_PROGRESS",
      });
      (prisma.workOrder.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWorkOrder,
        status: "CLOSED",
      });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request(`/work-orders/${WO_ID}/close`, {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({ resolutionNotes: "Fixed" }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 409 when not in correct status", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWorkOrder,
        status: "NEW",
      });

      const app = makeApp();
      const res = await app.request(`/work-orders/${WO_ID}/close`, {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ resolutionNotes: "Fixed" }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.code).toBe("WO_002");
    });

    it("returns 404 for missing work order", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(`/work-orders/${MISSING_ID}/close`, {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ resolutionNotes: "Fixed" }),
      });

      expect(res.status).toBe(404);
    });
  });

  // ── POST /work-orders/:id/reopen ──────────────────────────────────────────────

  describe("POST /work-orders/:id/reopen", () => {
    it("reopens a CLOSED work order", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWorkOrder,
        status: "CLOSED",
      });
      (prisma.workOrder.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWorkOrder,
        status: "REOPENED",
        completed_at: null,
      });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request(`/work-orders/${WO_ID}/reopen`, {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ reason: "Issue recurred" }),
      });

      expect(res.status).toBe(200);
      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "REOPENED",
            completed_at: null,
            resolution_notes: null,
          }),
        }),
      );
    });

    it("returns 422 when not CLOSED", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWorkOrder,
        status: "IN_PROGRESS",
      });

      const app = makeApp();
      const res = await app.request(`/work-orders/${WO_ID}/reopen`, {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ reason: "Try again" }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.code).toBe("WO_003");
    });

    it("rejects technician with 403", async () => {
      const app = makeApp();
      const res = await app.request(`/work-orders/${WO_ID}/reopen`, {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({ reason: "Reopen" }),
      });

      expect(res.status).toBe(403);
    });
  });

  // ── POST /work-orders/:id/evidence ────────────────────────────────────────────

  describe("POST /work-orders/:id/evidence", () => {
    it("links evidence to a work order", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockWorkOrder);
      (prisma.workOrderEvidence.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 1,
      });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ...mockWorkOrder,
        work_order_evidence: [],
      });

      const app = makeApp();
      const res = await app.request(`/work-orders/${WO_ID}/evidence`, {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({ evidenceIds: [EVIDENCE_ID] }),
      });

      expect(res.status).toBe(200);
      expect(prisma.workOrderEvidence.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skipDuplicates: true,
        }),
      );
    });

    it("returns 404 for missing work order", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(`/work-orders/${MISSING_ID}/evidence`, {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({ evidenceIds: [EVIDENCE_ID] }),
      });

      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /work-orders/:id ──────────────────────────────────────────────────

  describe("DELETE /work-orders/:id", () => {
    it("soft deletes a work order (admin)", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorkOrder);
      (prisma.workOrder.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWorkOrder,
        deleted_at: expect.any(Date),
      });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const adminToken = signAccessToken({
        userId: "user-admin",
        email: "admin@test.com",
        role: "ADMINISTRATOR",
        organizationId: "org-001",
      });

      const app = makeApp();
      const res = await app.request(`/work-orders/${WO_ID}`, {
        method: "DELETE",
        headers: authHeaders(adminToken),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.deleted).toBe(true);
      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deleted_at: expect.any(Date) }),
        }),
      );
    });

    it("returns 404 for missing work order", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const adminToken = signAccessToken({
        userId: "user-admin",
        email: "admin@test.com",
        role: "ADMINISTRATOR",
        organizationId: "org-001",
      });

      const app = makeApp();
      const res = await app.request(`/work-orders/${MISSING_ID}`, {
        method: "DELETE",
        headers: authHeaders(adminToken),
      });

      expect(res.status).toBe(404);
    });

    it("rejects dispatcher with 403", async () => {
      const app = makeApp();
      const res = await app.request(`/work-orders/${WO_ID}`, {
        method: "DELETE",
        headers: authHeaders(dispatcherToken()),
      });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /work-orders/:id/audit-trail ──────────────────────────────────────────

  describe("GET /work-orders/:id/audit-trail", () => {
    it("returns audit events for a work order", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorkOrder);
      (prisma.auditEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        mockAuditEvent,
      ]);

      const app = makeApp();
      const res = await app.request(`/work-orders/${WO_ID}/audit-trail`);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].action).toBe("CREATE");
    });

    it("returns 404 for missing work order", async () => {
      (prisma.workOrder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(`/work-orders/${MISSING_ID}/audit-trail`);

      expect(res.status).toBe(404);
    });
  });
});
