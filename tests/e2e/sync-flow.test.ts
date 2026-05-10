import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { signAccessToken } from "../../src/utils/jwt.js";

// ── Mock Prisma ─────────────────────────────────────────────────────────────

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    ticket: {
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    inspectionRecord: {
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    workOrder: {
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    evidenceItem: {
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    syncEvent: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import prisma from "../../src/lib/prisma.js";
import syncRoutes from "../../src/routes/sync.js";

function makeApp() {
  const app = new Hono();
  app.route("/sync", syncRoutes);
  return app;
}

const TECH_ID = "c0000000-0000-0000-0000-000000000001";
const TKT_ID = "a0000000-0000-0000-0000-000000000001";
const INSP_ID = "e0000000-0000-0000-0000-000000000001";

function techToken() {
  return signAccessToken({
    userId: TECH_ID,
    email: "tech@test.com",
    role: "TECHNICIAN",
    organizationId: "org-1",
  });
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

describe("E2E: Sync Flow (US-SYNC)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── TC-SYNC-01: Push offline changes → conflict detected → resolution ──────

  describe("TC-SYNC-01: Push with conflict detection", () => {
    it("accepts push when client version matches server", async () => {
      vi.mocked(prisma.ticket.findFirst).mockResolvedValue({
        id: TKT_ID,
        version: 3,
        deleted_at: null,
      } as any);
      vi.mocked(prisma.ticket.update).mockResolvedValue({} as any);
      vi.mocked(prisma.syncEvent.create).mockResolvedValue({} as any);

      const app = makeApp();
      const res = await app.request("/sync/push", {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({
          changes: [
            {
              entityType: "TICKET",
              entityId: TKT_ID,
              version: 3,
              data: { title: "Updated title" },
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results).toHaveLength(1);
      expect(body.results[0].status).toBe("SYNCED");
      expect(body.results[0].serverVersion).toBe(4);
      expect(body.results[0].conflicts).toBeNull();

      // Verify sync event was logged
      expect(prisma.syncEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sync_status: "SYNCED",
            entity_type: "TICKET",
            entity_id: TKT_ID,
          }),
        })
      );
    });

    it("detects version conflict and returns CONFLICT status", async () => {
      vi.mocked(prisma.ticket.findFirst).mockResolvedValue({
        id: TKT_ID,
        version: 5,
        deleted_at: null,
      } as any);
      vi.mocked(prisma.syncEvent.create).mockResolvedValue({} as any);

      const app = makeApp();
      const res = await app.request("/sync/push", {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({
          changes: [
            {
              entityType: "TICKET",
              entityId: TKT_ID,
              version: 3,
              data: { title: "Stale update" },
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results[0].status).toBe("CONFLICT");
      expect(body.results[0].serverVersion).toBe(5);
      expect(body.results[0].conflicts).toHaveLength(1);
      expect(body.results[0].conflicts[0].field).toBe("version");
      expect(body.results[0].conflicts[0].resolution).toBe("MANUAL_REVIEW_REQUIRED");

      // Verify conflict sync event was logged
      expect(prisma.syncEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sync_status: "CONFLICT",
          }),
        })
      );
    });

    it("rejects push for nonexistent entity", async () => {
      vi.mocked(prisma.ticket.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.syncEvent.create).mockResolvedValue({} as any);

      const app = makeApp();
      const res = await app.request("/sync/push", {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({
          changes: [
            {
              entityType: "TICKET",
              entityId: TKT_ID,
              version: 1,
              data: {},
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results[0].status).toBe("REJECTED");
      expect(body.results[0].conflicts[0].resolution).toBe("ENTITY_NOT_FOUND");
    });

    it("processes multiple changes in batch", async () => {
      const SECOND_TKT_ID = "a0000000-0000-0000-0000-000000000002";

      vi.mocked(prisma.ticket.findFirst)
        .mockResolvedValueOnce({ id: TKT_ID, version: 2, deleted_at: null } as any)
        .mockResolvedValueOnce(null);
      vi.mocked(prisma.ticket.update).mockResolvedValue({} as any);
      vi.mocked(prisma.syncEvent.create).mockResolvedValue({} as any);

      const app = makeApp();
      const res = await app.request("/sync/push", {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({
          changes: [
            {
              entityType: "TICKET",
              entityId: TKT_ID,
              version: 2,
              data: { title: "Update 1" },
              timestamp: new Date().toISOString(),
            },
            {
              entityType: "TICKET",
              entityId: SECOND_TKT_ID,
              version: 1,
              data: {},
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results).toHaveLength(2);
      expect(body.results[0].status).toBe("SYNCED");
      expect(body.results[1].status).toBe("REJECTED");
    });
  });

  // ── TC-SYNC-02: Pull latest data after sync ────────────────────────────────

  describe("TC-SYNC-02: Pull latest data", () => {
    it("pulls changes since a given timestamp", async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Mock for INSPECTION type (scoped to technician_id)
      vi.mocked(prisma.inspectionRecord.findMany).mockResolvedValue([
        {
          id: INSP_ID,
          updated_at: new Date(),
          sync_status: "PENDING",
          version: 2,
        },
      ] as any);

      // Mock for TICKET type (scoped to assignee_id or created_by)
      vi.mocked(prisma.ticket.findMany).mockResolvedValue([
        {
          id: TKT_ID,
          updated_at: new Date(),
          sync_status: "SYNCED",
          version: 5,
        },
      ] as any);

      // Mock for WORK_ORDER type
      vi.mocked(prisma.workOrder.findMany).mockResolvedValue([]);

      // Mock for EVIDENCE type
      vi.mocked(prisma.evidenceItem.findMany).mockResolvedValue([]);

      const app = makeApp();
      const res = await app.request(`/sync/pull?since=${encodeURIComponent(since)}`, {
        headers: authHeaders(techToken()),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.changes.length).toBeGreaterThanOrEqual(2);
      expect(body.serverTime).toBeDefined();
      expect(body.hasMore).toBe(false);

      // Verify the inspection was tagged as CREATE (PENDING sync_status)
      const inspectionChange = body.changes.find(
        (c: any) => c.entityType === "INSPECTION"
      );
      expect(inspectionChange).toBeDefined();
      expect(inspectionChange.action).toBe("CREATE");

      // Verify the ticket was tagged as UPDATE
      const ticketChange = body.changes.find(
        (c: any) => c.entityType === "TICKET"
      );
      expect(ticketChange).toBeDefined();
      expect(ticketChange.action).toBe("UPDATE");
    });

    it("filters by entity type", async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      vi.mocked(prisma.inspectionRecord.findMany).mockResolvedValue([
        {
          id: INSP_ID,
          updated_at: new Date(),
          sync_status: "SYNCED",
          version: 1,
        },
      ] as any);

      const app = makeApp();
      const res = await app.request(
        `/sync/pull?since=${encodeURIComponent(since)}&entityTypes=INSPECTION`,
        { headers: authHeaders(techToken()) }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.changes).toHaveLength(1);
      expect(body.changes[0].entityType).toBe("INSPECTION");
    });

    it("requires auth", async () => {
      const app = makeApp();
      const res = await app.request(
        `/sync/pull?since=${encodeURIComponent(new Date().toISOString())}`
      );

      expect(res.status).toBe(401);
    });
  });

  // ── Sync status overview ───────────────────────────────────────────────────

  describe("Sync status", () => {
    it("shows sync status summary", async () => {
      vi.mocked(prisma.syncEvent.count)
        .mockResolvedValueOnce(2)  // pending
        .mockResolvedValueOnce(10) // synced
        .mockResolvedValueOnce(1)  // failed
        .mockResolvedValueOnce(3); // conflicts
      vi.mocked(prisma.syncEvent.findMany).mockResolvedValue([
        {
          entity_type: "TICKET",
          entity_id: TKT_ID,
          error_message: "Version conflict",
          created_at: new Date(),
        },
      ] as any);

      const app = makeApp();
      const res = await app.request("/sync/status", {
        headers: authHeaders(techToken()),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.pending).toBe(2);
      expect(body.synced).toBe(10);
      expect(body.failed).toBe(1);
      expect(body.conflicts).toBe(3);
      expect(body.failedRecords).toHaveLength(1);
    });
  });
});
