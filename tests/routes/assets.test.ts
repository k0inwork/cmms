import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { signAccessToken } from "../../src/utils/jwt.js";

const mockEvent = {
  id: "evt-001",
  entity_type: "Turbine",
  entity_id: "turb-001",
  action: "UPDATE",
  user_id: "user-001",
  before_state: { status: "ACTIVE" },
  after_state: { status: "MAINTENANCE" },
  metadata: null,
  created_at: new Date("2026-01-01"),
};

const mockTurbine = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Turbine A",
  status: "ACTIVE",
  site: { id: "site-001", name: "Site A", organization_id: "org-001" },
};

const mockSubsystem = {
  id: "22222222-2222-2222-2222-222222222222",
  name: "Rotor",
  turbine: { id: "turb-001", name: "Turbine A", site: { id: "site-001", name: "Site A", organization_id: "org-001" } },
};

const mockComponent = {
  id: "33333333-3333-3333-3333-333333333333",
  name: "Blade A",
  status: "ACTIVE",
  subsystem: { id: "sub-001", name: "Rotor", turbine: { id: "turb-001", name: "Turbine A", site: { id: "site-001", name: "Site A", organization_id: "org-001" } } },
};

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    auditEvent: {
      findMany: vi.fn(),
    },
    turbine: {
      findUnique: vi.fn(),
    },
    subsystem: {
      findUnique: vi.fn(),
    },
    component: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from "../../src/lib/prisma.js";
import assetRoutes from "../../src/routes/assets.js";

function makeApp() {
  const app = new Hono();
  app.route("/assets", assetRoutes);
  return app;
}

const token = signAccessToken({ userId: "user-001", email: "test@test.com", role: "TECHNICIAN", organizationId: "org-001" });

describe("Asset history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated audit events for an asset", async () => {
    (prisma.auditEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockEvent]);

    const res = await makeApp().request("/assets/turb-001/history");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].entity_id).toBe("turb-001");
    expect(body.pagination).toBeDefined();
  });

  it("returns empty list for asset with no history", async () => {
    (prisma.auditEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await makeApp().request("/assets/nope/history");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(0);
  });
});

describe("QR code lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for missing qr_code param", async () => {
    const res = await makeApp().request("/assets/lookup", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid UUID", async () => {
    const res = await makeApp().request("/assets/lookup?qr_code=not-a-uuid", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(400);
  });

  it("returns 401 without auth", async () => {
    const res = await makeApp().request("/assets/lookup?qr_code=11111111-1111-1111-1111-111111111111");
    expect(res.status).toBe(401);
  });

  it("looks up a turbine by QR code", async () => {
    (prisma.turbine.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockTurbine);
    (prisma.subsystem.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.component.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await makeApp().request("/assets/lookup?qr_code=11111111-1111-1111-1111-111111111111", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.type).toBe("Turbine");
    expect(body.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(body.site).toBeDefined();
  });

  it("looks up a component by QR code", async () => {
    (prisma.turbine.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.subsystem.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.component.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockComponent);

    const res = await makeApp().request("/assets/lookup?qr_code=33333333-3333-3333-3333-333333333333", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.type).toBe("Component");
    expect(body.name).toBe("Blade A");
    expect(body.subsystem).toBeDefined();
  });

  it("returns 404 when no asset matches", async () => {
    (prisma.turbine.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.subsystem.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.component.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await makeApp().request("/assets/lookup?qr_code=00000000-0000-0000-0000-000000000000", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });
});
