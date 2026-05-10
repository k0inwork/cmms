import { describe, it, expect, vi, beforeEach } from "vitest";
import { signAccessToken } from "../../src/utils/jwt.js";

// ── Mock Prisma ─────────────────────────────────────────────────────────────

const mockRecord = {
  id: "aaaaaaaa-0001-0000-0000-000000000001",
  template_version_id: "aaaaaaaa-0002-0000-0000-000000000001",
  technician_id: "aaaaaaaa-0003-0000-0000-000000000001",
  turbine_id: "aaaaaaaa-0004-0000-0000-000000000001",
  component_id: null,
  status: "ASSIGNED",
  started_at: null,
  completed_at: null,
  submitted_at: null,
  reviewed_at: null,
  reviewed_by: null,
  review_notes: null,
  due_date: null,
  sync_status: "SYNCED",
  client_id: null,
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  deleted_at: null,
  technician: { id: "aaaaaaaa-0003-0000-0000-000000000001", first_name: "Jane", last_name: "Doe" },
  turbine: { id: "aaaaaaaa-0004-0000-0000-000000000001", name: "WTG-001" },
  component: null,
  template_version: {
    version: 1,
    template: { id: "aaaaaaaa-0005-0000-0000-000000000001", name: "Blade Inspection" },
  },
};

const INSP_ID = "aaaaaaaa-0001-0000-0000-000000000001";
const TVER_ID = "aaaaaaaa-0002-0000-0000-000000000001";
const TECH_ID = "aaaaaaaa-0003-0000-0000-000000000001";
const TURB_ID = "aaaaaaaa-0004-0000-0000-000000000001";
const CLIENT_ID = "bbbbbbbb-0001-0000-0000-000000000001";
const MISSING_ID = "cccccccc-0000-0000-0000-000000000001";

const mockFieldData = [
  {
    id: "dddddddd-0001-0000-0000-000000000001",
    inspection_id: INSP_ID,
    field_key: "crack_length_mm",
    field_type: "NUMERIC",
    value_string: null,
    value_numeric: 145,
    value_boolean: null,
    value_json: null,
    created_at: new Date("2026-01-01"),
    updated_at: new Date("2026-01-01"),
  },
];

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    inspectionRecord: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    inspectionFieldData: {
      upsert: vi.fn(),
    },
    inspectionTemplateVersion: {
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    turbine: {
      findFirst: vi.fn(),
    },
  },
}));

import { Hono } from "hono";
import prisma from "../../src/lib/prisma.js";
import inspectionRoutes from "../../src/routes/inspections.js";

function makeApp() {
  const app = new Hono();
  app.route("/inspections", inspectionRoutes);
  return app;
}

function techToken() {
  return signAccessToken({
    userId: "user-tech",
    email: "tech@test.com",
    role: "TECHNICIAN",
    organizationId: "org-001",
  });
}

function dispatcherToken() {
  return signAccessToken({
    userId: "user-disp",
    email: "disp@test.com",
    role: "DISPATCHER",
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

function adminToken() {
  return signAccessToken({
    userId: "user-admin",
    email: "admin@test.com",
    role: "ADMINISTRATOR",
    organizationId: "org-001",
  });
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

describe("Inspection Records routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /inspections ───────────────────────────────────────────────────────

  describe("GET /inspections", () => {
    it("returns paginated list", async () => {
      (prisma.inspectionRecord.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { ...mockRecord, _count: { defects: 0 } },
      ]);

      const app = makeApp();
      const res = await app.request("/inspections");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.pagination).toBeDefined();
    });

    it("filters by status", async () => {
      (prisma.inspectionRecord.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const app = makeApp();
      const res = await app.request("/inspections?status=SUBMITTED");

      expect(res.status).toBe(200);
      expect(prisma.inspectionRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "SUBMITTED" }),
        }),
      );
    });

    it("filters by assigneeId", async () => {
      (prisma.inspectionRecord.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const app = makeApp();
      const res = await app.request(`/inspections?assigneeId=${TECH_ID}`);

      expect(res.status).toBe(200);
      expect(prisma.inspectionRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ technician_id: TECH_ID }),
        }),
      );
    });
  });

  // ── POST /inspections ──────────────────────────────────────────────────────

  describe("POST /inspections", () => {
    const createPayload = {
      templateVersionId: TVER_ID,
      technicianId: TECH_ID,
      turbineId: TURB_ID,
    };

    it("creates an inspection record (technician)", async () => {
      (prisma.inspectionTemplateVersion.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TVER_ID,
      });
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TECH_ID,
      });
      (prisma.turbine.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TURB_ID,
      });
      (prisma.inspectionRecord.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecord);

      const app = makeApp();
      const res = await app.request("/inspections", {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify(createPayload),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBe(INSP_ID);

      expect(prisma.inspectionRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "ASSIGNED",
            template_version_id: TVER_ID,
          }),
        }),
      );
    });

    it("returns existing record on duplicate clientId (idempotency)", async () => {
      const existing = { ...mockRecord, client_id: CLIENT_ID };
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const app = makeApp();
      const res = await app.request("/inspections", {
        method: "POST",
        headers: authHeaders(dispatcherToken()),
        body: JSON.stringify({ ...createPayload, clientId: CLIENT_ID }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.client_id).toBe(CLIENT_ID);
    });

    it("returns 404 for missing template version", async () => {
      (prisma.inspectionTemplateVersion.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      const app = makeApp();
      const res = await app.request("/inspections", {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify(createPayload),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 for missing technician", async () => {
      (prisma.inspectionTemplateVersion.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TVER_ID,
      });
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/inspections", {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify(createPayload),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 for missing turbine", async () => {
      (prisma.inspectionTemplateVersion.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TVER_ID,
      });
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: TECH_ID });
      (prisma.turbine.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/inspections", {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify(createPayload),
      });

      expect(res.status).toBe(404);
    });

    it("rejects unauthenticated with 401", async () => {
      const app = makeApp();
      const res = await app.request("/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPayload),
      });

      expect(res.status).toBe(401);
    });

    it("rejects QA role with 403", async () => {
      const app = makeApp();
      const res = await app.request("/inspections", {
        method: "POST",
        headers: authHeaders(qaToken()),
        body: JSON.stringify(createPayload),
      });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /inspections/:id ───────────────────────────────────────────────────

  describe("GET /inspections/:id", () => {
    it("returns full inspection with field data", async () => {
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockRecord,
        field_data: mockFieldData,
        defects: [],
        evidence: [],
        reviewer: null,
      });

      const app = makeApp();
      const res = await app.request(`/inspections/${INSP_ID}`);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(INSP_ID);
      expect(body.field_data).toHaveLength(1);
    });

    it("returns 404 for missing record", async () => {
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(`/inspections/${MISSING_ID}`);

      expect(res.status).toBe(404);
    });
  });

  // ── PUT /inspections/:id ───────────────────────────────────────────────────

  describe("PUT /inspections/:id", () => {
    it("updates field data and sets status to IN_PROGRESS", async () => {
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockRecord)
        .mockResolvedValueOnce({
          ...mockRecord,
          status: "IN_PROGRESS",
          started_at: expect.any(Date),
          field_data: [],
        });
      (prisma.inspectionFieldData.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.inspectionRecord.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const app = makeApp();
      const res = await app.request(`/inspections/${INSP_ID}`, {
        method: "PUT",
        headers: authHeaders(techToken()),
        body: JSON.stringify({
          status: "IN_PROGRESS",
          fieldData: { crack_length_mm: { value: 152, type: "NUMERIC" } },
        }),
      });

      expect(res.status).toBe(200);
      expect(prisma.inspectionRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "IN_PROGRESS" }),
        }),
      );
      expect(prisma.inspectionFieldData.upsert).toHaveBeenCalled();
    });

    it("returns 409 when status is not editable", async () => {
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockRecord,
        status: "SUBMITTED",
      });

      const app = makeApp();
      const res = await app.request(`/inspections/${INSP_ID}`, {
        method: "PUT",
        headers: authHeaders(techToken()),
        body: JSON.stringify({
          fieldData: { notes: { value: "test" } },
        }),
      });

      expect(res.status).toBe(409);
    });

    it("allows update when status is CHANGES_REQUESTED", async () => {
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ...mockRecord, status: "CHANGES_REQUESTED" })
        .mockResolvedValueOnce({
          ...mockRecord,
          status: "CHANGES_REQUESTED",
          field_data: [],
        });
      (prisma.inspectionFieldData.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const app = makeApp();
      const res = await app.request(`/inspections/${INSP_ID}`, {
        method: "PUT",
        headers: authHeaders(techToken()),
        body: JSON.stringify({
          fieldData: { notes: { value: "updated" } },
        }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 404 for missing record", async () => {
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(`/inspections/${MISSING_ID}`, {
        method: "PUT",
        headers: authHeaders(techToken()),
        body: JSON.stringify({ fieldData: {} }),
      });

      expect(res.status).toBe(404);
    });
  });

  // ── POST /inspections/:id/submit ───────────────────────────────────────────

  describe("POST /inspections/:id/submit", () => {
    it("submits an in-progress inspection", async () => {
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockRecord,
        status: "IN_PROGRESS",
      });
      (prisma.inspectionRecord.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockRecord,
        status: "SUBMITTED",
        submitted_at: new Date(),
      });

      const app = makeApp();
      const res = await app.request(`/inspections/${INSP_ID}/submit`, {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({ notes: "Ready for review" }),
      });

      expect(res.status).toBe(200);
      expect(prisma.inspectionRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "SUBMITTED" }),
        }),
      );
    });

    it("submits a changes_requested inspection (re-submit)", async () => {
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockRecord,
        status: "CHANGES_REQUESTED",
      });
      (prisma.inspectionRecord.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockRecord,
        status: "SUBMITTED",
      });

      const app = makeApp();
      const res = await app.request(`/inspections/${INSP_ID}/submit`, {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
    });

    it("returns 409 when already submitted", async () => {
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockRecord,
        status: "SUBMITTED",
      });

      const app = makeApp();
      const res = await app.request(`/inspections/${INSP_ID}/submit`, {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(409);
    });

    it("returns 409 when status is ASSIGNED (not started)", async () => {
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockRecord,
        status: "ASSIGNED",
      });

      const app = makeApp();
      const res = await app.request(`/inspections/${INSP_ID}/submit`, {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(409);
    });
  });

  // ── POST /inspections/:id/approve ──────────────────────────────────────────

  describe("POST /inspections/:id/approve", () => {
    it("approves a submitted inspection (QA)", async () => {
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockRecord,
        status: "SUBMITTED",
      });
      (prisma.inspectionRecord.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockRecord,
        status: "APPROVED",
        reviewed_by: "user-qa",
        reviewed_at: new Date(),
        reviewer: { id: "user-qa", first_name: "QA", last_name: "Reviewer" },
      });

      const app = makeApp();
      const res = await app.request(`/inspections/${INSP_ID}/approve`, {
        method: "POST",
        headers: authHeaders(qaToken()),
        body: JSON.stringify({ notes: "Looks good" }),
      });

      expect(res.status).toBe(200);
      expect(prisma.inspectionRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "APPROVED",
            reviewed_by: "user-qa",
          }),
        }),
      );
    });

    it("rejects non-QA/non-admin with 403", async () => {
      const app = makeApp();
      const res = await app.request(`/inspections/${INSP_ID}/approve`, {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(403);
    });

    it("returns 409 when not in SUBMITTED status", async () => {
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockRecord,
        status: "APPROVED",
      });

      const app = makeApp();
      const res = await app.request(`/inspections/${INSP_ID}/approve`, {
        method: "POST",
        headers: authHeaders(qaToken()),
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(409);
    });

    it("allows admin to approve", async () => {
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockRecord,
        status: "SUBMITTED",
      });
      (prisma.inspectionRecord.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockRecord,
        status: "APPROVED",
        reviewer: { id: "user-admin", first_name: "Admin", last_name: "User" },
      });

      const app = makeApp();
      const res = await app.request(`/inspections/${INSP_ID}/approve`, {
        method: "POST",
        headers: authHeaders(adminToken()),
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
    });
  });

  // ── POST /inspections/:id/reject ───────────────────────────────────────────

  describe("POST /inspections/:id/reject", () => {
    it("rejects a submitted inspection", async () => {
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockRecord,
        status: "SUBMITTED",
      });
      (prisma.inspectionRecord.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockRecord,
        status: "REJECTED",
        reviewed_by: "user-qa",
        reviewer: { id: "user-qa", first_name: "QA", last_name: "Reviewer" },
      });

      const app = makeApp();
      const res = await app.request(`/inspections/${INSP_ID}/reject`, {
        method: "POST",
        headers: authHeaders(qaToken()),
        body: JSON.stringify({ action: "REJECT", notes: "Missing data" }),
      });

      expect(res.status).toBe(200);
      expect(prisma.inspectionRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "REJECTED" }),
        }),
      );
    });

    it("requests changes on a submitted inspection", async () => {
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockRecord,
        status: "SUBMITTED",
      });
      (prisma.inspectionRecord.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockRecord,
        status: "CHANGES_REQUESTED",
        reviewed_by: "user-qa",
        reviewer: { id: "user-qa", first_name: "QA", last_name: "Reviewer" },
      });

      const app = makeApp();
      const res = await app.request(`/inspections/${INSP_ID}/reject`, {
        method: "POST",
        headers: authHeaders(qaToken()),
        body: JSON.stringify({ action: "REQUEST_CHANGES", notes: "Re-inspect blade" }),
      });

      expect(res.status).toBe(200);
      expect(prisma.inspectionRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "CHANGES_REQUESTED" }),
        }),
      );
    });

    it("rejects non-QA/non-admin with 403", async () => {
      const app = makeApp();
      const res = await app.request(`/inspections/${INSP_ID}/reject`, {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({ action: "REJECT" }),
      });

      expect(res.status).toBe(403);
    });

    it("returns 409 when not in SUBMITTED status", async () => {
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockRecord,
        status: "ASSIGNED",
      });

      const app = makeApp();
      const res = await app.request(`/inspections/${INSP_ID}/reject`, {
        method: "POST",
        headers: authHeaders(qaToken()),
        body: JSON.stringify({ action: "REJECT" }),
      });

      expect(res.status).toBe(409);
    });

    it("returns 404 for missing record", async () => {
      (prisma.inspectionRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request(`/inspections/${MISSING_ID}/reject`, {
        method: "POST",
        headers: authHeaders(qaToken()),
        body: JSON.stringify({ action: "REJECT" }),
      });

      expect(res.status).toBe(404);
    });
  });
});
