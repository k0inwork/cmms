import { describe, it, expect, vi, beforeEach } from "vitest";
import { signAccessToken } from "../../src/utils/jwt.js";
import { Hono } from "hono";

// ── Mock Prisma ─────────────────────────────────────────────────────────────

const mockAuditEvent = {
  id: "aaaaaaaa-0001-0000-0000-000000000001",
  entity_type: "TICKET",
  entity_id: "aaaaaaaa-0002-0000-0000-000000000001",
  action: "CREATE",
  user_id: "user-admin",
  before_state: null,
  after_state: { status: "NEW" },
  metadata: null,
  created_at: new Date("2026-01-01T00:00:00Z"),
  user: { id: "user-admin", first_name: "Admin", last_name: "User", email: "admin@test.com" },
};

const mockStatusChangeEvent = {
  ...mockAuditEvent,
  id: "aaaaaaaa-0001-0000-0000-000000000002",
  action: "STATUS_CHANGE",
  before_state: { status: "NEW" },
  after_state: { status: "TRIAGED" },
};

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    auditEvent: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import prisma from "../../src/lib/prisma.js";
import auditRoutes from "../../src/routes/audit.js";

function makeApp() {
  const app = new Hono();
  app.route("/audit", auditRoutes);
  return app;
}

function authHeader(role = "ADMINISTRATOR") {
  const token = signAccessToken({
    userId: "user-admin",
    email: "admin@test.com",
    role,
    organizationId: "org-001",
  });
  return { Authorization: `Bearer ${token}` };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Audit Trail API", () => {
  const app = makeApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /audit ────────────────────────────────────────────────────────────

  describe("GET /audit", () => {
    it("returns paginated audit events", async () => {
      vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([mockAuditEvent] as any);

      const res = await app.request("/audit", { headers: authHeader() });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].action).toBe("CREATE");
      expect(body.pagination).toBeDefined();
    });

    it("filters by entityType", async () => {
      vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([]);

      const res = await app.request("/audit?entityType=TICKET", { headers: authHeader() });
      expect(res.status).toBe(200);

      const call = vi.mocked(prisma.auditEvent.findMany).mock.calls[0][0] as Record<string, unknown>;
      expect((call.where as Record<string, unknown>).entity_type).toBe("TICKET");
    });

    it("filters by action", async () => {
      vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([]);

      const res = await app.request("/audit?action=STATUS_CHANGE", { headers: authHeader() });
      expect(res.status).toBe(200);

      const call = vi.mocked(prisma.auditEvent.findMany).mock.calls[0][0] as Record<string, unknown>;
      expect((call.where as Record<string, unknown>).action).toBe("STATUS_CHANGE");
    });

    it("filters by userId", async () => {
      vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([]);

      const res = await app.request("/audit?userId=aaaaaaaa-0000-0000-0000-000000000001", { headers: authHeader() });
      expect(res.status).toBe(200);

      const call = vi.mocked(prisma.auditEvent.findMany).mock.calls[0][0] as Record<string, unknown>;
      expect((call.where as Record<string, unknown>).user_id).toBe("aaaaaaaa-0000-0000-0000-000000000001");
    });

    it("filters by entityId", async () => {
      vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([]);

      const res = await app.request(
        "/audit?entityId=aaaaaaaa-0002-0000-0000-000000000001",
        { headers: authHeader() },
      );
      expect(res.status).toBe(200);

      const call = vi.mocked(prisma.auditEvent.findMany).mock.calls[0][0] as Record<string, unknown>;
      expect((call.where as Record<string, unknown>).entity_id).toBe("aaaaaaaa-0002-0000-0000-000000000001");
    });

    it("filters by date range", async () => {
      vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([]);

      const res = await app.request(
        "/audit?createdAfter=2026-01-01T00:00:00Z&createdBefore=2026-01-31T23:59:59Z",
        { headers: authHeader() },
      );
      expect(res.status).toBe(200);

      const call = vi.mocked(prisma.auditEvent.findMany).mock.calls[0][0] as Record<string, unknown>;
      const createdAt = call.where as Record<string, unknown>;
      expect((createdAt.created_at as Record<string, unknown>).gte).toBeInstanceOf(Date);
      expect((createdAt.created_at as Record<string, unknown>).lte).toBeInstanceOf(Date);
    });

    it("requires auth", async () => {
      const res = await app.request("/audit");
      expect(res.status).toBe(401);
    });

    it("rejects non-admin roles", async () => {
      const res = await app.request("/audit", { headers: authHeader("TECHNICIAN") });
      expect(res.status).toBe(403);
    });
  });

  // ── GET /audit/:id ────────────────────────────────────────────────────────

  describe("GET /audit/:id", () => {
    it("returns single audit event", async () => {
      vi.mocked(prisma.auditEvent.findFirst).mockResolvedValue(mockAuditEvent as any);

      const res = await app.request(
        `/audit/${mockAuditEvent.id}`,
        { headers: authHeader() },
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.id).toBe(mockAuditEvent.id);
      expect(body.action).toBe("CREATE");
      expect(body.before_state).toBeNull();
      expect(body.after_state).toEqual({ status: "NEW" });
    });

    it("returns 404 for missing event", async () => {
      vi.mocked(prisma.auditEvent.findFirst).mockResolvedValue(null);

      const res = await app.request(
        "/audit/cccccccc-0000-0000-0000-000000000001",
        { headers: authHeader() },
      );
      expect(res.status).toBe(404);
    });
  });

  // ── GET /audit/entity/:entityType/:entityId ───────────────────────────────

  describe("GET /audit/entity/:entityType/:entityId", () => {
    it("returns events for a specific entity", async () => {
      vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([
        mockAuditEvent,
        mockStatusChangeEvent,
      ] as any);

      const res = await app.request(
        "/audit/entity/TICKET/aaaaaaaa-0002-0000-0000-000000000001",
        { headers: authHeader("DISPATCHER") },
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toHaveLength(2);
      expect(body.data[0].action).toBe("CREATE");
    });

    it("allows QA_REVIEWER access", async () => {
      vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([]);

      const res = await app.request(
        "/audit/entity/TICKET/aaaaaaaa-0002-0000-0000-000000000001",
        { headers: authHeader("QA_REVIEWER") },
      );
      expect(res.status).toBe(200);
    });

    it("rejects TECHNICIAN access", async () => {
      const res = await app.request(
        "/audit/entity/TICKET/aaaaaaaa-0002-0000-0000-000000000001",
        { headers: authHeader("TECHNICIAN") },
      );
      expect(res.status).toBe(403);
    });
  });
});
