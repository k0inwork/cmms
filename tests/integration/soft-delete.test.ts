import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "./helpers/db.js";
import { cleanDatabase } from "./helpers/db.js";
import { createFullHierarchy } from "./helpers/fixtures.js";
import { createTestUser } from "./helpers/auth.js";

describe("Soft deletes", () => {
  let h: Awaited<ReturnType<typeof createFullHierarchy>>;

  beforeAll(async () => {
    await cleanDatabase();
    h = await createFullHierarchy();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it("soft-deleted org is excluded from findFirst with deleted_at: null", async () => {
    await prisma.organization.update({
      where: { id: h.org.id },
      data: { deleted_at: new Date() },
    });

    const found = await prisma.organization.findFirst({
      where: { id: h.org.id, deleted_at: null },
    });
    expect(found).toBeNull();

    // Still accessible without filter
    const raw = await prisma.organization.findUnique({ where: { id: h.org.id } });
    expect(raw).toBeDefined();
    expect(raw?.deleted_at).toBeDefined();
  });

  it("soft-deleted turbine still exists in DB", async () => {
    await prisma.turbine.update({
      where: { id: h.turbine.id },
      data: { deleted_at: new Date() },
    });

    const filtered = await prisma.turbine.findFirst({
      where: { id: h.turbine.id, deleted_at: null },
    });
    expect(filtered).toBeNull();

    const raw = await prisma.turbine.findUnique({ where: { id: h.turbine.id } });
    expect(raw).toBeDefined();
  });

  it("soft-deleted ticket is excluded from normal queries", async () => {
    const { user } = await createTestUser({ organizationId: h.org.id, role: "DISPATCHER" });
    const ticket = await prisma.ticket.create({
      data: { title: "Soft Del", description: "Test", created_by: user.id },
    });

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { deleted_at: new Date() },
    });

    const found = await prisma.ticket.findFirst({
      where: { id: ticket.id, deleted_at: null },
    });
    expect(found).toBeNull();

    const raw = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(raw?.deleted_at).toBeDefined();
  });
});
