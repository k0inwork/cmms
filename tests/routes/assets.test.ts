import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

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

vi.mock("../../src/lib/prisma.js", () => ({
  default: {
    auditEvent: {
      findMany: vi.fn(),
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
