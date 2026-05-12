import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { signAccessToken } from "../../src/utils/jwt.js";

// ── Mock Prisma ─────────────────────────────────────────────────────────────

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    inspectionTemplate: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    inspectionTemplateVersion: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    inspectionRecord: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    inspectionFieldData: {
      upsert: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    turbine: {
      findFirst: vi.fn(),
    },
  },
}));

import prisma from "../../src/lib/prisma.js";
import templateRoutes from "../../src/routes/inspection-templates.js";
import inspectionRoutes from "../../src/routes/inspections.js";

function makeApp() {
  const app = new Hono();
  app.route("/templates", templateRoutes);
  app.route("/inspections", inspectionRoutes);
  return app;
}

const TEMPLATE_ID = "a0000000-0000-0000-0000-000000000001";
const VERSION_ID = "b0000000-0000-0000-0000-000000000001";
const TECH_ID = "c0000000-0000-0000-0000-000000000001";
const TURB_ID = "d0000000-0000-0000-0000-000000000001";
const INSP_ID = "e0000000-0000-0000-0000-000000000001";

function adminToken() {
  return signAccessToken({
    userId: "f0000000-0000-0000-0000-000000000001",
    email: "admin@test.com",
    role: "ADMINISTRATOR",
    organizationId: "org-1",
  });
}

function techToken() {
  return signAccessToken({
    userId: TECH_ID,
    email: "tech@test.com",
    role: "TECHNICIAN",
    organizationId: "org-1",
  });
}

function qaToken() {
  return signAccessToken({
    userId: "a1000000-0000-0000-0000-000000000001",
    email: "qa@test.com",
    role: "QA_REVIEWER",
    organizationId: "org-1",
  });
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

const templateFields = [
  { key: "blade_condition", label: "Blade Condition", type: "DROPDOWN", required: true, config: { options: ["Good", "Fair", "Poor"] } },
  { key: "crack_detected", label: "Crack Detected", type: "PASS_FAIL", required: true },
  { key: "vibration_level", label: "Vibration Level (mm/s)", type: "NUMERIC", required: false },
];

describe("E2E: Inspection Flow (US-INSPECT)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── TC-INSPECT-01: Create inspection template with versioned schema ────────

  describe("TC-INSPECT-01: Create inspection template", () => {
    it("creates template with initial version", async () => {
      vi.mocked(prisma.inspectionTemplate.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.inspectionTemplate.create).mockResolvedValue({
        id: TEMPLATE_ID,
        name: "Quarterly Blade Inspection",
        description: "Standard blade check",
        inspection_type: "QUARTERLY",
        is_active: true,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        versions: [
          {
            id: VERSION_ID,
            version: 1,
            schema: templateFields,
            changelog: "Initial version",
          },
        ],
      } as any);

      const app = makeApp();
      const res = await app.request("/templates", {
        method: "POST",
        headers: authHeaders(adminToken()),
        body: JSON.stringify({
          name: "Quarterly Blade Inspection",
          description: "Standard blade check",
          inspection_type: "QUARTERLY",
          fields: templateFields,
          changelog: "Initial version",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("Quarterly Blade Inspection");
      expect(body.versions).toHaveLength(1);
      expect(body.versions[0].version).toBe(1);
    });

    it("requires ADMINISTRATOR role", async () => {
      const app = makeApp();
      const res = await app.request("/templates", {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({
          name: "Test",
          fields: [{ key: "a", label: "A", type: "TEXT" }],
        }),
      });

      expect(res.status).toBe(403);
    });
  });

  // ── TC-INSPECT-02: Start inspection → fill findings → submit ──────────────

  describe("TC-INSPECT-02: Start → fill → submit inspection", () => {
    it("walks the full inspection lifecycle", async () => {
      const app = makeApp();

      // Step 1: Create inspection (assigned to technician)
      vi.mocked(prisma.inspectionTemplateVersion.findFirst).mockResolvedValue({
        id: VERSION_ID,
      } as any);
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: TECH_ID,
        is_active: true,
        deleted_at: null,
      } as any);
      vi.mocked(prisma.turbine.findFirst).mockResolvedValue({
        id: TURB_ID,
        deleted_at: null,
      } as any);
      vi.mocked(prisma.inspectionRecord.create).mockResolvedValue({
        id: INSP_ID,
        template_version_id: VERSION_ID,
        technician_id: TECH_ID,
        turbine_id: TURB_ID,
        status: "ASSIGNED",
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        technician: { id: TECH_ID, first_name: "Tech", last_name: "User" },
        turbine: { id: TURB_ID, name: "WTG-001" },
        template_version: {
          version: 1,
          template: { id: TEMPLATE_ID, name: "Quarterly Blade Inspection" },
        },
      } as any);

      const createRes = await app.request("/inspections", {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({
          templateVersionId: VERSION_ID,
          technicianId: TECH_ID,
          turbineId: TURB_ID,
        }),
      });

      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      expect(created.status).toBe("ASSIGNED");

      // Step 2: Start inspection (transition to IN_PROGRESS) + fill field data
      vi.mocked(prisma.inspectionRecord.findFirst).mockResolvedValue({
        id: INSP_ID,
        status: "ASSIGNED",
        deleted_at: null,
      } as any);
      vi.mocked(prisma.inspectionFieldData.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.inspectionRecord.update).mockResolvedValue({} as any);
      vi.mocked(prisma.inspectionRecord.findFirst).mockResolvedValue({
        id: INSP_ID,
        status: "IN_PROGRESS",
        deleted_at: null,
        technician: { id: TECH_ID, first_name: "Tech", last_name: "User" },
        turbine: { id: TURB_ID, name: "WTG-001" },
        template_version: {
          version: 1,
          template: { id: TEMPLATE_ID, name: "Quarterly Blade Inspection" },
        },
        field_data: [
          { field_key: "blade_condition", value_string: "Fair" },
          { field_key: "crack_detected", value_boolean: false },
          { field_key: "vibration_level", value_numeric: 2.5 },
        ],
      } as any);

      const fillRes = await app.request(`/inspections/${INSP_ID}`, {
        method: "PUT",
        headers: authHeaders(techToken()),
        body: JSON.stringify({
          status: "IN_PROGRESS",
          fieldData: {
            blade_condition: { value: "Fair", type: "DROPDOWN" },
            crack_detected: { value: false, type: "PASS_FAIL" },
            vibration_level: { value: 2.5, type: "NUMERIC" },
          },
        }),
      });

      expect(fillRes.status).toBe(200);

      // Step 3: Submit for review
      vi.mocked(prisma.inspectionRecord.findFirst).mockResolvedValue({
        id: INSP_ID,
        status: "IN_PROGRESS",
        deleted_at: null,
      } as any);
      vi.mocked(prisma.inspectionRecord.update).mockResolvedValue({
        id: INSP_ID,
        status: "SUBMITTED",
        submitted_at: expect.any(Date),
        completed_at: expect.any(Date),
        deleted_at: null,
        technician: { id: TECH_ID, first_name: "Tech", last_name: "User" },
        turbine: { id: TURB_ID, name: "WTG-001" },
        template_version: {
          version: 1,
          template: { id: TEMPLATE_ID, name: "Quarterly Blade Inspection" },
        },
      } as any);

      const submitRes = await app.request(`/inspections/${INSP_ID}/submit`, {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({ notes: "All checks completed" }),
      });

      expect(submitRes.status).toBe(200);
      const submitted = await submitRes.json();
      expect(submitted.status).toBe("SUBMITTED");
    });
  });

  // ── TC-INSPECT-03: QA reviewer approves/rejects ───────────────────────────

  describe("TC-INSPECT-03: QA review", () => {
    it("QA approves submitted inspection", async () => {
      vi.mocked(prisma.inspectionRecord.findFirst).mockResolvedValue({
        id: INSP_ID,
        status: "SUBMITTED",
        deleted_at: null,
      } as any);
      vi.mocked(prisma.inspectionRecord.update).mockResolvedValue({
        id: INSP_ID,
        status: "APPROVED",
        reviewed_by: "a1000000-0000-0000-0000-000000000001",
        reviewed_at: expect.any(Date),
        deleted_at: null,
        technician: { id: TECH_ID, first_name: "Tech", last_name: "User" },
        reviewer: { id: "a1000000-0000-0000-0000-000000000001", first_name: "QA", last_name: "Reviewer" },
        turbine: { id: TURB_ID, name: "WTG-001" },
        template_version: {
          version: 1,
          template: { id: TEMPLATE_ID, name: "Quarterly Blade Inspection" },
        },
      } as any);

      const app = makeApp();
      const res = await app.request(`/inspections/${INSP_ID}/approve`, {
        method: "POST",
        headers: authHeaders(qaToken()),
        body: JSON.stringify({ notes: "Looks good" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("APPROVED");
    });

    it("QA rejects submitted inspection", async () => {
      vi.mocked(prisma.inspectionRecord.findFirst).mockResolvedValue({
        id: INSP_ID,
        status: "SUBMITTED",
        deleted_at: null,
      } as any);
      vi.mocked(prisma.inspectionRecord.update).mockResolvedValue({
        id: INSP_ID,
        status: "REJECTED",
        reviewed_by: "a1000000-0000-0000-0000-000000000001",
        reviewed_at: expect.any(Date),
        deleted_at: null,
        technician: { id: TECH_ID, first_name: "Tech", last_name: "User" },
        reviewer: { id: "a1000000-0000-0000-0000-000000000001", first_name: "QA", last_name: "Reviewer" },
        turbine: { id: TURB_ID, name: "WTG-001" },
        template_version: {
          version: 1,
          template: { id: TEMPLATE_ID, name: "Quarterly Blade Inspection" },
        },
      } as any);

      const app = makeApp();
      const res = await app.request(`/inspections/${INSP_ID}/reject`, {
        method: "POST",
        headers: authHeaders(qaToken()),
        body: JSON.stringify({ action: "REJECT", notes: "Missing photos" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("REJECTED");
    });

    it("QA requests changes on submitted inspection", async () => {
      vi.mocked(prisma.inspectionRecord.findFirst).mockResolvedValue({
        id: INSP_ID,
        status: "SUBMITTED",
        deleted_at: null,
      } as any);
      vi.mocked(prisma.inspectionRecord.update).mockResolvedValue({
        id: INSP_ID,
        status: "CHANGES_REQUESTED",
        reviewed_by: "a1000000-0000-0000-0000-000000000001",
        deleted_at: null,
        technician: { id: TECH_ID, first_name: "Tech", last_name: "User" },
        reviewer: { id: "a1000000-0000-0000-0000-000000000001", first_name: "QA", last_name: "Reviewer" },
        turbine: { id: TURB_ID, name: "WTG-001" },
        template_version: {
          version: 1,
          template: { id: TEMPLATE_ID, name: "Quarterly Blade Inspection" },
        },
      } as any);

      const app = makeApp();
      const res = await app.request(`/inspections/${INSP_ID}/reject`, {
        method: "POST",
        headers: authHeaders(qaToken()),
        body: JSON.stringify({
          action: "REQUEST_CHANGES",
          notes: "Add vibration readings",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("CHANGES_REQUESTED");
    });

    it("technician cannot approve inspection", async () => {
      const app = makeApp();
      const res = await app.request(`/inspections/${INSP_ID}/approve`, {
        method: "POST",
        headers: authHeaders(techToken()),
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(403);
    });
  });
});
