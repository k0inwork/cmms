import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Hono } from "hono";
import prisma from "./helpers/db.js";
import { cleanDatabase } from "./helpers/db.js";
import { createFullHierarchy } from "./helpers/fixtures.js";
import { createTestUser, authHeader } from "./helpers/auth.js";
import workOrderRoutes from "../../../src/routes/work-orders.js";
import ticketRoutes from "../../../src/routes/tickets.js";

function makeWOApp() {
  const app = new Hono();
  app.route("/work-orders", workOrderRoutes);
  return app;
}

function makeTicketApp() {
  const app = new Hono();
  app.route("/tickets", ticketRoutes);
  return app;
}

describe("Work order routes (integration)", () => {
  let h: Awaited<ReturnType<typeof createFullHierarchy>>;
  let dispatcherToken: string;
  let technicianToken: string;
  let technicianId: string;
  let ticketId: string;

  beforeAll(async () => {
    await cleanDatabase();
    h = await createFullHierarchy();
    const dispatcher = await createTestUser({ organizationId: h.org.id, role: "DISPATCHER" });
    const tech = await createTestUser({ organizationId: h.org.id, role: "TECHNICIAN" });
    dispatcherToken = dispatcher.token;
    technicianToken = tech.token;
    technicianId = tech.user.id;
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "audit_events" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "work_order_evidence" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "work_orders" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "ticket_evidence" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "tickets" CASCADE`);

    // Create a ticket first (work orders need a ticket)
    const ticketApp = makeTicketApp();
    const ticketRes = await ticketApp.request("/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({
        title: "WO Parent Ticket",
        description: "Parent ticket for work order",
        turbineId: h.turbine.id,
      }),
    });
    ticketId = (await ticketRes.json()).id;
  });

  let woId: string;

  it("POST creates a work order from a ticket", async () => {
    const app = makeWOApp();
    const res = await app.request("/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({
        ticketId,
        title: "Repair gearbox",
        description: "Gearbox needs inspection and repair",
        priority: "HIGH",
        assigneeId: technicianId,
        turbineId: h.turbine.id,
      }),
    });
    expect(res.status).toBe(201);
    const wo = await res.json();
    expect(wo.title).toBe("Repair gearbox");
    expect(wo.status).toBe("NEW"); // always starts NEW, assign via /assign endpoint
    expect(wo.ticket_id).toBe(ticketId);
    woId = wo.id;
  });

  it("rejects work order with non-existent ticket", async () => {
    const app = makeWOApp();
    const res = await app.request("/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({
        ticketId: crypto.randomUUID(),
        title: "Ghost WO",
        description: "Should fail",
      }),
    });
    expect(res.status).toBe(404);
  });

  it("transitions through full state machine", async () => {
    const app = makeWOApp();

    // Create WO
    const createRes = await app.request("/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({
        ticketId,
        title: "State Machine WO",
        description: "Testing state transitions",
      }),
    });
    const { id } = await createRes.json();

    // NEW → TRIAGED
    let res = await app.request(`/work-orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({ status: "TRIAGED" }),
    });
    expect(res.status).toBe(200);

    // TRIAGED → ASSIGNED (via assign)
    res = await app.request(`/work-orders/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({ assigneeId: technicianId }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("ASSIGNED");

    // ASSIGNED → IN_PROGRESS
    res = await app.request(`/work-orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader(technicianToken) },
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).started_at).toBeDefined();

    // IN_PROGRESS → PENDING_REVIEW
    res = await app.request(`/work-orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader(technicianToken) },
      body: JSON.stringify({ status: "PENDING_REVIEW" }),
    });
    expect(res.status).toBe(200);

    // PENDING_REVIEW → CLOSED
    res = await app.request(`/work-orders/${id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({ resolutionNotes: "Repaired successfully" }),
    });
    expect(res.status).toBe(200);
    const closed = await res.json();
    expect(closed.status).toBe("CLOSED");
    expect(closed.completed_at).toBeDefined();
    expect(closed.resolution_notes).toBe("Repaired successfully");
  });

  it("reopens a closed work order", async () => {
    const app = makeWOApp();

    const createRes = await app.request("/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({
        ticketId,
        title: "Reopen WO",
        description: "Will be reopened",
        assigneeId: technicianId,
      }),
    });
    const { id } = await createRes.json();

    // Fast-forward to CLOSED (NEW → TRIAGED → ASSIGNED → IN_PROGRESS → PENDING_REVIEW → CLOSE)
    await app.request(`/work-orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({ status: "TRIAGED" }),
    });
    await app.request(`/work-orders/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({ assigneeId: technicianId }),
    });
    await app.request(`/work-orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader(technicianToken) },
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    await app.request(`/work-orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader(technicianToken) },
      body: JSON.stringify({ status: "PENDING_REVIEW" }),
    });
    await app.request(`/work-orders/${id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({ resolutionNotes: "Done" }),
    });

    const res = await app.request(`/work-orders/${id}/reopen`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({ reason: "Issue recurred" }),
    });
    expect(res.status).toBe(200);
    const reopened = await res.json();
    expect(reopened.status).toBe("REOPENED");
    expect(reopened.completed_at).toBeNull();
  });

  it("GET lists work orders with filters", async () => {
    const app = makeWOApp();
    await app.request("/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({ ticketId, title: "List WO", description: "For listing" }),
    });

    const res = await app.request(`/work-orders?ticketId=${ticketId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("PUT updates work order fields", async () => {
    const app = makeWOApp();
    const createRes = await app.request("/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({ ticketId, title: "Before", description: "Before desc" }),
    });
    const { id } = await createRes.json();

    const putRes = await app.request(`/work-orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({ title: "After", priority: "CRITICAL" }),
    });
    expect(putRes.status).toBe(200);
    const updated = await putRes.json();
    expect(updated.title).toBe("After");
    expect(updated.priority).toBe("CRITICAL");
  });

  it("DELETE soft-deletes a work order", async () => {
    const app = makeWOApp();
    const createRes = await app.request("/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({ ticketId, title: "Delete WO", description: "To delete" }),
    });
    const { id } = await createRes.json();

    const admin = await createTestUser({ organizationId: h.org.id, role: "ADMINISTRATOR" });
    const delRes = await app.request(`/work-orders/${id}`, {
      method: "DELETE",
      headers: authHeader(admin.token),
    });
    expect(delRes.status).toBe(200);

    // Should not appear in list
    const listRes = await app.request(`/work-orders?ticketId=${ticketId}`);
    const body = await listRes.json();
    expect(body.data.find((wo: any) => wo.id === id)).toBeUndefined();
  });
});
