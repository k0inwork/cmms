import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Prisma ─────────────────────────────────────────────────────────────

const mockOrg = {
  id: "org-001",
  name: "North Sea Wind Corp",
  description: null,
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  deleted_at: null,
};

const mockSite = {
  id: "site-001",
  organization_id: "org-001",
  name: "Hornsea Reef",
  latitude: 53.75,
  longitude: 1.65,
  time_zone: "Europe/London",
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  deleted_at: null,
};

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    organization: {
      findFirst: vi.fn(),
    },
    site: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { Hono } from "hono";
import prisma from "../../src/lib/prisma.js";
import siteRoutes from "../../src/routes/sites.js";

function makeApp() {
  const app = new Hono();
  app.route("/organizations/:orgId/sites", siteRoutes);
  return app;
}

describe("Site routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.organization.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockOrg);
  });

  // ── GET /organizations/:orgId/sites ─────────────────────────────────────

  describe("GET sites", () => {
    it("returns paginated list of sites", async () => {
      (prisma.site.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockSite]);

      const app = makeApp();
      const res = await app.request("/organizations/org-001/sites");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe("Hornsea Reef");
    });

    it("returns 404 if org does not exist", async () => {
      (prisma.organization.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/organizations/nope/sites");

      expect(res.status).toBe(404);
    });
  });

  // ── POST /organizations/:orgId/sites ────────────────────────────────────

  describe("POST sites", () => {
    it("creates a site", async () => {
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.site.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockSite);

      const app = makeApp();
      const res = await app.request("/organizations/org-001/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Hornsea Reef",
          latitude: 53.75,
          longitude: 1.65,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("Hornsea Reef");
    });

    it("rejects duplicate site name within org with 409", async () => {
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSite);

      const app = makeApp();
      const res = await app.request("/organizations/org-001/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hornsea Reef" }),
      });

      expect(res.status).toBe(409);
    });

    it("rejects invalid latitude with 400", async () => {
      const app = makeApp();
      const res = await app.request("/organizations/org-001/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test", latitude: 999 }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /organizations/:orgId/sites/:id ─────────────────────────────────

  describe("GET site by id", () => {
    it("returns a single site", async () => {
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSite);

      const app = makeApp();
      const res = await app.request("/organizations/org-001/sites/site-001");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("site-001");
    });

    it("returns 404 for missing site", async () => {
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/organizations/org-001/sites/nope");

      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /organizations/:orgId/sites/:id ───────────────────────────────

  describe("PATCH site", () => {
    it("updates a site", async () => {
      const updated = { ...mockSite, name: "Hornsea Reef South" };
      (prisma.site.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockSite) // existence check
        .mockResolvedValueOnce(null); // duplicate name check
      (prisma.site.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const app = makeApp();
      const res = await app.request("/organizations/org-001/sites/site-001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hornsea Reef South" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("Hornsea Reef South");
    });

    it("returns 404 for missing site", async () => {
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/organizations/org-001/sites/nope", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "X" }),
      });

      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /organizations/:orgId/sites/:id ──────────────────────────────

  describe("DELETE site", () => {
    it("soft deletes a site", async () => {
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockSite);
      (prisma.site.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockSite,
        deleted_at: new Date(),
      });

      const app = makeApp();
      const res = await app.request("/organizations/org-001/sites/site-001", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.deleted).toBe(true);

      expect(prisma.site.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "site-001" },
          data: expect.objectContaining({ deleted_at: expect.any(Date) }),
        })
      );
    });

    it("returns 404 for missing site", async () => {
      (prisma.site.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const app = makeApp();
      const res = await app.request("/organizations/org-001/sites/nope", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
