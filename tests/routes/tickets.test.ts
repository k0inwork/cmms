import { describe, it, expect, vi, beforeEach } from "vitest";
import { signAccessToken } from "../../src/utils/jwt.js";

// ── Mock Prisma ─────────────────────────────────────────────────────────────

const mockTicket = {
  id: "aaaaaaaa-0001-0000-0000-000000000001",
  defect_id: null,
  turbine_id: "aaaaaaaa-0002-0000-0000-000000000001",
  component_id: null,
  title: "Blade crack detected",
  description: "Major crack found on blade 2",
  priority: "HIGH",
  severity: "MAJOR",
  status: "NEW",
  assignee_id: null,
  created_by: "user-disp",
  due_date: null,
  sla_target_date: null,
  resolution_notes: null,
  root_cause: null,
  closed_at: null,
  sync_status: "SYNCED",
  client_id: null,
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  deleted_at: null,
  assignee: null,
  creator: { id: "user-disp", first_name: "Dispatch", last_name: "User" },
  turbine: { id: "aaaaaaaa-0002-0000-0000-000000000001", name: "WTG-001" },
  component: null,
  defect: null,
};

const TKT_ID = "aaaaaaaa-0001-0000-0000-000000000001";
const TURB_ID = "aaaaaaaa-0002-0000-0000-000000000001";
const DEFECT_ID = "aaaaaaaa-0003-0000-0000-000000000001";
const COMPONENT_ID = "aaaaaaaa-0004-0000-0000-000000000001";
const EVIDENCE_ID = "aaaaaaaa-0005-0000-0000-000000000001";
const MISSING_ID = "cccccccc-0000-0000-0000-000000000001";
const CLIENT_ID = "bbbbbbbb-0001-0000-0000-000000000001";
const ASSIGNEE_ID = "aaaaaaaa-0006-0000-0000-000000000001";

const mockAuditEvent = {
  id: "aaaaaaaa-0099-0000-0000-000000000001",
  entity_type: "TICKET",
  entity_id: TKT_ID,
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
    ticket: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ticketEvidence: {
      createMany: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    defect: {
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
import ticketRoutes from "../../src/routes/tickets.js";

function makeApp() {
  const app = new Hono();
  app.route("/tickets", ticketRoutes);
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

function adminToken() {
  return signAccessToken({
    userId: "user-admin",
    email: "admin@test.com",
    role: "ADMINISTRATOR",
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

function qaToken() {
  return signAccessToken({
    userId: "user-qa",
    email: "qa@test.com",
    role: "QA_REVIEWER",
    organizationId: "org-001",
  });
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

describe("Tickets routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /tickets ─────────────────────────────────────────────────────────────

  describe("GET /tickets", () => {
    it("returns paginated list", async () => {
      (prisma.ticket.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { ...mockTicket, _count: { ticket_evidence: 0 } },
      ]);

      const app = makeApp();
      const res = await app.request("/tickets");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.pagination).toBeDefined();
    });

    it("filters by status", async () => {
      (prisma.ticket.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const app = makeApp();
      const res = await app.request("/tickets?status=NEW");

      expect(res.status).toBe(200);
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "NEW" }),
        }),
      );
    });

    it("filters by priority", async () => {
      (prisma.ticket.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const app = makeApp();
      const res = await app.request("/tickets?priority=HIGH");

      expect(res.status).toBe(200);
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ priority: "HIGH" }),
        }),
      );
    });

    it("filters by assigneeId", async () => {
      (prisma.ticket.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const app = makeApp();
      const res = await app.request(`/tickets?assigneeId=${ASSIGNEE_ID}`);

      expect(res.status).toBe(200);
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assignee_id: ASSIGNEE_ID }),
        }),
      );
    });
  });

  // ── POST /tickets ────────────────────────────────────────────────────────────

  describe("POST /tickets", () => {
    const createPayload = {
      turbineId: TURB_ID,
      title: "Blade crack detected",
      description: "Major crack found on blade 2",
      priority: "HIGH",
      severity: "MAJOR",
    };

    it("creates a ticket (dispatcher)", async () => {
      (prisma.turbine.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: TURB_ID });
      (prisma.ticket.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockTicket);
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request("/tickets", {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify(createPayload),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBe(TKT_ID);

      expect(prisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "NEW",
            priority: "HIGH",
          }),
        }),
      );

      expect(prisma.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "CREATE",
            entity_type: "TICKET",
          }),
        }),
      );
    });

    it("creates ticket from defect", async () => {
      (prisma.defect.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: DEFECT_ID,
        severity: "MAJOR",
      });
      (prisma.turbine.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: TURB_ID });
      (prisma.ticket.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockTicket,
        defect_id: DEFECT_ID,
        defect: { id: DEFECT_ID, severity: "MAJOR", description: "Crack" },
      });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request("/tickets", {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ ...createPayload, defectId: DEFECT_ID }),
      });

      expect(res.status).toBe(201);
      expect(prisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ defect_id: DEFECT_ID }),
        }),
      );
    });

    it("returns existing on duplicate clientId (idempotency)", async () => {
      const existing = { ...mockTicket, client_id: CLIENT_ID };
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const app = makeApp();
      const res = await app.request("/tickets", {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ ...createPayload, clientId: CLIENT_ID }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.client_id).toBe(CLIENT_ID);
    });

    it("links evidence on create", async () => {
      (prisma.turbine.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: TURB_ID });
      (prisma.ticket.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockTicket);
      (prisma.ticketEvidence.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request("/tickets", {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ ...createPayload, evidenceIds: [EVIDENCE_ID] }),
      });

      expect(res.status).toBe(201);
      expect(prisma.ticketEvidence.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ evidence_id: EVIDENCE_ID }),
          ]),
        }),
      );
    });

    it("returns 404 for missing turbine", async () => {
      (prisma.turbine.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/tickets", {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify(createPayload),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 for missing defect", async () => {
      (prisma.defect.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/tickets", {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ ...createPayload, defectId: DEFECT_ID }),
      });

      expect(res.status).toBe(404);
    });

    it("rejects unauthenticated with 401", async () => {
      const app = makeApp();
      const res = await app.request("/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPayload),
      });

      expect(res.status).toBe(401);
    });

    it("rejects technician with 403", async () => {
      const app = makeApp();
      const res = await app.request("/tickets", {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify(createPayload),
      });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /tickets/:id ─────────────────────────────────────────────────────────

  describe("GET /tickets/:id", () => {
    it("returns full ticket with evidence and audit events", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockTicket,
        ticket_evidence: [],
      });
      (prisma.auditEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAuditEvent]);

      const app = makeApp();
      const res = await app.request(`/tickets/${TKT_ID}`);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(TKT_ID);
      expect(body.audit_events).toHaveLength(1);
    });

    it("returns 404 for missing ticket", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(`/tickets/${MISSING_ID}`);

      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /tickets/:id/status ────────────────────────────────────────────────

  describe("PATCH /tickets/:id/status", () => {
    it("transitions NEW → TRIAGED", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTicket);
      (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockTicket,
        status: "TRIAGED",
      });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request(`/tickets/${TKT_ID}/status`, {
        method: "PATCH",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ status: "TRIAGED" }),
      });

      expect(res.status).toBe(200);
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "TRIAGED" }),
        }),
      );
    });

    it("transitions ASSIGNED → IN_PROGRESS", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockTicket,
        status: "ASSIGNED",
      });
      (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockTicket,
        status: "IN_PROGRESS",
      });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request(`/tickets/${TKT_ID}/status`, {
        method: "PATCH",
        headers: authHeaders(techToken()),
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });

      expect(res.status).toBe(200);
    });

    it("sets closed_at when transitioning to CLOSED", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockTicket,
        status: "PENDING_REVIEW",
      });
      (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockTicket,
        status: "CLOSED",
        closed_at: expect.any(Date),
      });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request(`/tickets/${TKT_ID}/status`, {
        method: "PATCH",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ status: "CLOSED" }),
      });

      expect(res.status).toBe(200);
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ closed_at: expect.any(Date) }),
        }),
      );
    });

    it("returns 422 for invalid transition", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTicket);

      const app = makeApp();
      const res = await app.request(`/tickets/${TKT_ID}/status`, {
        method: "PATCH",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ status: "CLOSED" }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.code).toBe("TKT_001");
    });

    it("returns 404 for missing ticket", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(`/tickets/${MISSING_ID}/status`, {
        method: "PATCH",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ status: "TRIAGED" }),
      });

      expect(res.status).toBe(404);
    });
  });

  // ── POST /tickets/:id/assign ─────────────────────────────────────────────────

  describe("POST /tickets/:id/assign", () => {
    it("assigns a user to a NEW ticket and transitions to ASSIGNED", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTicket);
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: ASSIGNEE_ID,
        is_active: true,
      });
      (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockTicket,
        status: "ASSIGNED",
        assignee_id: ASSIGNEE_ID,
        assignee: { id: ASSIGNEE_ID, first_name: "Tech", last_name: "User" },
      });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request(`/tickets/${TKT_ID}/assign`, {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ assigneeId: ASSIGNEE_ID }),
      });

      expect(res.status).toBe(200);
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignee_id: ASSIGNEE_ID,
            status: "ASSIGNED",
          }),
        }),
      );
    });

    it("returns 404 for missing assignee", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTicket);
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(`/tickets/${TKT_ID}/assign`, {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ assigneeId: MISSING_ID }),
      });

      expect(res.status).toBe(404);
    });

    it("rejects technician with 403", async () => {
      const app = makeApp();
      const res = await app.request(`/tickets/${TKT_ID}/assign`, {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({ assigneeId: "user-tech" }),
      });

      expect(res.status).toBe(403);
    });
  });

  // ── POST /tickets/:id/close ──────────────────────────────────────────────────

  describe("POST /tickets/:id/close", () => {
    it("closes a PENDING_REVIEW ticket with resolution", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockTicket,
        status: "PENDING_REVIEW",
      });
      (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockTicket,
        status: "CLOSED",
        resolution_notes: "Repaired blade",
        closed_at: expect.any(Date),
      });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request(`/tickets/${TKT_ID}/close`, {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({
          resolutionNotes: "Repaired blade",
          rootCause: "Fatigue",
          evidenceIds: [EVIDENCE_ID],
        }),
      });

      expect(res.status).toBe(200);
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "CLOSED",
            resolution_notes: "Repaired blade",
          }),
        }),
      );
      expect(prisma.ticketEvidence.createMany).toHaveBeenCalled();
    });

    it("closes an IN_PROGRESS ticket", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockTicket,
        status: "IN_PROGRESS",
      });
      (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockTicket,
        status: "CLOSED",
      });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request(`/tickets/${TKT_ID}/close`, {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({ resolutionNotes: "Fixed" }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 409 when not in correct status", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockTicket,
        status: "NEW",
      });

      const app = makeApp();
      const res = await app.request(`/tickets/${TKT_ID}/close`, {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ resolutionNotes: "Fixed" }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.code).toBe("TKT_002");
    });

    it("returns 404 for missing ticket", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(`/tickets/${MISSING_ID}/close`, {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ resolutionNotes: "Fixed" }),
      });

      expect(res.status).toBe(404);
    });
  });

  // ── POST /tickets/:id/reopen ─────────────────────────────────────────────────

  describe("POST /tickets/:id/reopen", () => {
    it("reopens a CLOSED ticket", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockTicket,
        status: "CLOSED",
      });
      (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockTicket,
        status: "REOPENED",
        closed_at: null,
      });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request(`/tickets/${TKT_ID}/reopen`, {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ reason: "Issue recurred" }),
      });

      expect(res.status).toBe(200);
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "REOPENED",
            closed_at: null,
          }),
        }),
      );
    });

    it("returns 422 when not CLOSED", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockTicket,
        status: "IN_PROGRESS",
      });

      const app = makeApp();
      const res = await app.request(`/tickets/${TKT_ID}/reopen`, {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ reason: "Try again" }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.code).toBe("TKT_004");
    });

    it("rejects technician with 403", async () => {
      const app = makeApp();
      const res = await app.request(`/tickets/${TKT_ID}/reopen`, {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({ reason: "Reopen" }),
      });

      expect(res.status).toBe(403);
    });
  });

  // ── POST /tickets/:id/evidence ───────────────────────────────────────────────

  describe("POST /tickets/:id/evidence", () => {
    it("links evidence to a ticket", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTicket);
      (prisma.ticketEvidence.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
      (prisma.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuditEvent);

      const app = makeApp();
      const res = await app.request(`/tickets/${TKT_ID}/evidence`, {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({ evidenceIds: [EVIDENCE_ID] }),
      });

      expect(res.status).toBe(200);
      expect(prisma.ticketEvidence.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skipDuplicates: true,
        }),
      );
    });

    it("returns 404 for missing ticket", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(`/tickets/${MISSING_ID}/evidence`, {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({ evidenceIds: [EVIDENCE_ID] }),
      });

      expect(res.status).toBe(404);
    });
  });

  // ── GET /tickets/:id/audit-trail ─────────────────────────────────────────────

  describe("GET /tickets/:id/audit-trail", () => {
    it("returns audit events for a ticket", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTicket);
      (prisma.auditEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAuditEvent]);

      const app = makeApp();
      const res = await app.request(`/tickets/${TKT_ID}/audit-trail`);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].action).toBe("CREATE");
    });

    it("returns 404 for missing ticket", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(`/tickets/${MISSING_ID}/audit-trail`);

      expect(res.status).toBe(404);
    });
  });
});
