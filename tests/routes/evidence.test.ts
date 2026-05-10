import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { signAccessToken } from "../../src/utils/jwt.js";

const mockUser = {
  userId: "user-001",
  email: "tech@test.com",
  role: "TECHNICIAN",
  organizationId: "org-001",
};

const mockQAUser = {
  userId: "user-002",
  email: "qa@test.com",
  role: "QA_REVIEWER",
  organizationId: "org-001",
};

const EVID_ID = "550e8400-e29b-41d4-a716-446655440001";
const TICKET_ID = "550e8400-e29b-41d4-a716-446655440002";

const mockEvidence = {
  id: EVID_ID,
  media_type: "PHOTO",
  status: "PENDING",
  file_url: `https://s3.example.com/evidence/${EVID_ID}/photo.jpg`,
  thumbnail_url: null,
  file_size_bytes: 4500000,
  mime_type: "image/jpeg",
  version: 1,
  uploaded_by: "user-001",
  asset_id: null,
  inspection_id: null,
  component_id: null,
  description: null,
  metadata: { fileName: "photo.jpg", capturedAt: null, deviceSource: null },
  sync_status: "SYNCED",
  client_id: null,
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  deleted_at: null,
};

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    evidenceItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    evidenceAnnotation: {
      createMany: vi.fn(),
    },
    ticketEvidence: {
      create: vi.fn(),
    },
  },
}));

import prisma from "../../src/lib/prisma.js";
import evidenceRoutes from "../../src/routes/evidence.js";

function makeApp() {
  const app = new Hono();
  app.route("/evidence", evidenceRoutes);
  return app;
}

function authHeader(user = mockUser) {
  const token = signAccessToken(user);
  return { Authorization: `Bearer ${token}` };
}

describe("Evidence routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /evidence/upload-url", () => {
    it("returns presigned URL and evidence ID", async () => {
      const res = await makeApp().request("/evidence/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          fileName: "blade_damage.jpg",
          fileType: "PHOTO",
          fileSize: 4500000,
          mimeType: "image/jpeg",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.uploadUrl).toBeDefined();
      expect(body.evidenceId).toBeDefined();
      expect(body.fields).toBeDefined();
    });

    it("rejects unsupported MIME types (EVID_001)", async () => {
      const res = await makeApp().request("/evidence/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          fileName: "file.exe",
          fileType: "DOCUMENT",
          fileSize: 1000,
          mimeType: "application/x-executable",
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("EVID_001");
    });

    it("rejects files exceeding size limit (EVID_002)", async () => {
      const res = await makeApp().request("/evidence/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          fileName: "big.mp4",
          fileType: "VIDEO",
          fileSize: 200 * 1024 * 1024,
          mimeType: "video/mp4",
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("EVID_002");
    });

    it("requires auth", async () => {
      const res = await makeApp().request("/evidence/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "photo.jpg",
          fileType: "PHOTO",
          fileSize: 1000,
          mimeType: "image/jpeg",
        }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /evidence", () => {
    it("creates evidence metadata record", async () => {
      (prisma.evidenceItem.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvidence);

      const res = await makeApp().request("/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          id: EVID_ID,
          fileName: "photo.jpg",
          fileType: "PHOTO",
          fileSize: 4500000,
          mimeType: "image/jpeg",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBe(EVID_ID);
      expect(prisma.evidenceItem.create).toHaveBeenCalledOnce();
    });

    it("links evidence to ticket when ticketId provided", async () => {
      (prisma.evidenceItem.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvidence);
      (prisma.ticketEvidence.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await makeApp().request("/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          id: EVID_ID,
          fileName: "photo.jpg",
          fileType: "PHOTO",
          fileSize: 4500000,
          mimeType: "image/jpeg",
          ticketId: TICKET_ID,
        }),
      });

      expect(prisma.ticketEvidence.create).toHaveBeenCalledOnce();
    });
  });

  describe("GET /evidence", () => {
    it("returns paginated evidence list", async () => {
      (prisma.evidenceItem.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockEvidence]);

      const res = await makeApp().request("/evidence", {
        headers: authHeader(),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.pagination).toBeDefined();
    });

    it("applies filters", async () => {
      (prisma.evidenceItem.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await makeApp().request("/evidence?mediaType=PHOTO&approvalStatus=PENDING", {
        headers: authHeader(),
      });

      const call = (prisma.evidenceItem.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.where.media_type).toBe("PHOTO");
      expect(call.where.status).toBe("PENDING");
    });
  });

  describe("GET /evidence/:id", () => {
    it("returns evidence with annotations and relations", async () => {
      (prisma.evidenceItem.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockEvidence,
        uploader: { id: "user-001", first_name: "Tech", last_name: "User" },
        annotations: [],
        ticket_evidence: [],
        work_order_evidence: [],
      });

      const res = await makeApp().request(`/evidence/${EVID_ID}`, {
        headers: authHeader(),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(EVID_ID);
      expect(body.uploader).toBeDefined();
    });

    it("returns 404 for missing evidence", async () => {
      (prisma.evidenceItem.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await makeApp().request("/evidence/nope", {
        headers: authHeader(),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /evidence/:id/annotations", () => {
    it("creates annotations", async () => {
      (prisma.evidenceItem.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvidence);
      (prisma.evidenceAnnotation.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });

      const res = await makeApp().request(`/evidence/${EVID_ID}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          annotations: [
            { type: "ARROW", data: { x: 10, y: 20 }, color: "#FF0000" },
            { type: "TEXT", data: { text: "Crack", x: 50, y: 60 } },
          ],
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.created).toBe(2);
    });

    it("returns 404 for missing evidence", async () => {
      (prisma.evidenceItem.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await makeApp().request("/evidence/nope/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          annotations: [{ type: "ARROW", data: { x: 1, y: 2 } }],
        }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /evidence/:id/approve", () => {
    it("approves evidence as QA reviewer", async () => {
      (prisma.evidenceItem.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvidence);
      (prisma.evidenceItem.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockEvidence,
        status: "APPROVED",
      });

      const res = await makeApp().request(`/evidence/${EVID_ID}/approve`, {
        method: "PUT",
        headers: authHeader(mockQAUser),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("APPROVED");
    });

    it("rejects non-QA users", async () => {
      const res = await makeApp().request(`/evidence/${EVID_ID}/approve`, {
        method: "PUT",
        headers: authHeader(mockUser), // TECHNICIAN
      });

      expect(res.status).toBe(403);
    });
  });

  describe("PUT /evidence/:id/flag", () => {
    it("flags evidence with reason", async () => {
      (prisma.evidenceItem.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvidence);
      (prisma.evidenceItem.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockEvidence,
        status: "FLAGGED",
        metadata: { flagReason: "Blurry image" },
      });

      const res = await makeApp().request(`/evidence/${EVID_ID}/flag`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader(mockQAUser) },
        body: JSON.stringify({ reason: "Blurry image" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("FLAGGED");
    });

    it("returns 404 for missing evidence", async () => {
      (prisma.evidenceItem.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await makeApp().request("/evidence/nope/flag", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader(mockQAUser) },
        body: JSON.stringify({ reason: "test" }),
      });

      expect(res.status).toBe(404);
    });
  });
});
