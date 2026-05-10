import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { signAccessToken } from "../../src/utils/jwt.js";

const mockUser = {
  userId: "user-001",
  email: "tech@test.com",
  role: "TECHNICIAN",
  organizationId: "org-001",
};

const INSPECTION_ID = "550e8400-e29b-41d4-a716-446655440010";
const TICKET_ID = "550e8400-e29b-41d4-a716-446655440011";
const mockInspection = {
  id: INSPECTION_ID,
  technician_id: "user-001",
  version: 5,
  sync_status: "PENDING",
  updated_at: new Date("2026-05-10T10:00:00Z"),
  deleted_at: null,
};

const mockTicket = {
  id: TICKET_ID,
  assignee_id: "user-001",
  version: 3,
  sync_status: "SYNCED",
  updated_at: new Date("2026-05-10T11:00:00Z"),
  deleted_at: null,
};

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    inspectionRecord: {
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    ticket: {
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

function authHeader(user = mockUser) {
  const token = signAccessToken(user);
  return { Authorization: `Bearer ${token}` };
}

describe("Sync routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /sync/push", () => {
    it("syncs changes successfully", async () => {
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockInspection);
      (prisma.inspectionRecord.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockInspection,
        sync_status: "SYNCED",
        version: 6,
      });
      (prisma.syncEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const res = await makeApp().request("/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          changes: [
            {
              entityType: "INSPECTION",
              entityId: INSPECTION_ID,
              version: 5,
              data: { status: "IN_PROGRESS" },
              timestamp: "2026-05-10T09:00:00Z",
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results).toHaveLength(1);
      expect(body.results[0].status).toBe("SYNCED");
      expect(body.results[0].serverVersion).toBe(6);
      expect(body.results[0].conflicts).toBeNull();
      expect(prisma.syncEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sync_status: "SYNCED" }),
        })
      );
    });

    it("detects version conflicts", async () => {
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockInspection,
        version: 7,
      });
      (prisma.syncEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const res = await makeApp().request("/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          changes: [
            {
              entityType: "INSPECTION",
              entityId: INSPECTION_ID,
              version: 5,
              data: { status: "IN_PROGRESS" },
              timestamp: "2026-05-10T09:00:00Z",
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results[0].status).toBe("CONFLICT");
      expect(body.results[0].serverVersion).toBe(7);
      expect(body.results[0].conflicts[0].resolution).toBe("MANUAL_REVIEW_REQUIRED");
    });

    it("rejects invalid entity types via validation", async () => {
      const res = await makeApp().request("/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          changes: [
            {
              entityType: "INVALID_TYPE",
              entityId: INSPECTION_ID,
              version: 1,
              data: {},
              timestamp: "2026-05-10T09:00:00Z",
            },
          ],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("rejects missing entity", async () => {
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.syncEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const res = await makeApp().request("/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          changes: [
            {
              entityType: "TICKET",
              entityId: TICKET_ID,
              version: 1,
              data: { title: "Updated" },
              timestamp: "2026-05-10T09:00:00Z",
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results[0].status).toBe("REJECTED");
      expect(body.results[0].conflicts[0].resolution).toBe("ENTITY_NOT_FOUND");
    });

    it("handles batch of multiple changes", async () => {
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockInspection);
      (prisma.inspectionRecord.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockInspection,
        version: 6,
      });
      (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockTicket);
      (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockTicket,
        version: 4,
      });
      (prisma.syncEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const res = await makeApp().request("/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          changes: [
            {
              entityType: "INSPECTION",
              entityId: INSPECTION_ID,
              version: 5,
              data: { status: "IN_PROGRESS" },
              timestamp: "2026-05-10T09:00:00Z",
            },
            {
              entityType: "TICKET",
              entityId: TICKET_ID,
              version: 3,
              data: { title: "Updated ticket" },
              timestamp: "2026-05-10T09:01:00Z",
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results).toHaveLength(2);
      expect(body.results[0].status).toBe("SYNCED");
      expect(body.results[1].status).toBe("SYNCED");
    });

    it("requires auth", async () => {
      const res = await makeApp().request("/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changes: [
            {
              entityType: "INSPECTION",
              entityId: INSPECTION_ID,
              version: 1,
              data: {},
              timestamp: "2026-05-10T09:00:00Z",
            },
          ],
        }),
      });

      expect(res.status).toBe(401);
    });

    it("validates request body", async () => {
      const res = await makeApp().request("/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ changes: [] }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /sync/pull", () => {
    it("pulls changes since timestamp", async () => {
      (prisma.inspectionRecord.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: INSPECTION_ID, updated_at: new Date("2026-05-10T10:00:00Z"), sync_status: "PENDING", version: 5 },
      ]);
      (prisma.ticket.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.workOrder.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.evidenceItem.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await makeApp().request("/sync/pull?since=2026-05-10T00:00:00Z", {
        headers: authHeader(),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.changes).toHaveLength(1);
      expect(body.changes[0].entityType).toBe("INSPECTION");
      expect(body.changes[0].entityId).toBe(INSPECTION_ID);
      expect(body.serverTime).toBeDefined();
      expect(body.hasMore).toBe(false);
    });

    it("filters by entity types", async () => {
      (prisma.ticket.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: TICKET_ID, updated_at: new Date("2026-05-10T11:00:00Z"), sync_status: "SYNCED", version: 3 },
      ]);

      const res = await makeApp().request("/sync/pull?since=2026-05-10T00:00:00Z&entityTypes=TICKET", {
        headers: authHeader(),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.changes).toHaveLength(1);
      expect(body.changes[0].entityType).toBe("TICKET");
      // Only ticket prisma should have been called
      expect(prisma.inspectionRecord.findMany).not.toHaveBeenCalled();
    });

    it("returns hasMore when results exceed limit", async () => {
      const manyRecords = Array.from({ length: 51 }, (_, i) => ({
        id: `550e8400-e29b-41d4-a716-4466554400${String(i).padStart(2, "0")}`,
        updated_at: new Date("2026-05-10T10:00:00Z"),
        sync_status: "SYNCED",
        version: 1,
      }));
      (prisma.inspectionRecord.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(manyRecords);
      (prisma.ticket.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.workOrder.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.evidenceItem.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await makeApp().request("/sync/pull?since=2026-05-10T00:00:00Z&limit=50", {
        headers: authHeader(),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.hasMore).toBe(true);
      expect(body.changes.length).toBeLessThanOrEqual(50);
    });

    it("requires auth", async () => {
      const res = await makeApp().request("/sync/pull?since=2026-05-10T00:00:00Z");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /sync/status", () => {
    it("returns sync status summary", async () => {
      (prisma.syncEvent.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(3)  // pending
        .mockResolvedValueOnce(45) // synced
        .mockResolvedValueOnce(1)  // failed
        .mockResolvedValueOnce(0); // conflicts

      (prisma.syncEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          entity_type: "INSPECTION",
          entity_id: INSPECTION_ID,
          error_message: "Network timeout",
          created_at: new Date("2026-05-10T08:00:00Z"),
        },
      ]);

      const res = await makeApp().request("/sync/status", {
        headers: authHeader(),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.pending).toBe(3);
      expect(body.synced).toBe(45);
      expect(body.failed).toBe(1);
      expect(body.conflicts).toBe(0);
      expect(body.failedRecords).toHaveLength(1);
      expect(body.failedRecords[0].entityType).toBe("INSPECTION");
      expect(body.failedRecords[0].error).toBe("Network timeout");
    });

    it("returns empty failedRecords when no failures", async () => {
      (prisma.syncEvent.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      (prisma.syncEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await makeApp().request("/sync/status", {
        headers: authHeader(),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.failedRecords).toHaveLength(0);
    });

    it("requires auth", async () => {
      const res = await makeApp().request("/sync/status");
      expect(res.status).toBe(401);
    });
  });
});
