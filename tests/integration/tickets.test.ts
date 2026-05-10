import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Hono } from "hono";
import prisma from "./helpers/db.js";
import { cleanDatabase } from "./helpers/db.js";
import { createFullHierarchy } from "./helpers/fixtures.js";
import { createTestUser, authHeader } from "./helpers/auth.js";
import ticketRoutes from "../../../src/routes/tickets.js";

function makeApp() {
  const app = new Hono();
  app.route("/tickets", ticketRoutes);
  return app;
}

describe("Ticket routes (integration)", () => {
  let h: Awaited<ReturnType<typeof createFullHierarchy>>;
  let dispatcherToken: string;
  let technicianToken: string;
  let dispatcherId: string;

  beforeAll(async () => {
    await cleanDatabase();
    h = await createFullHierarchy();
    const dispatcher = await createTestUser({ organizationId: h.org.id, role: "DISPATCHER" });
    const tech = await createTestUser({ organizationId: h.org.id, role: "TECHNICIAN" });
    dispatcherToken = dispatcher.token;
    dispatcherId = dispatcher.user.id;
    technicianToken = tech.token;
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  let ticketId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "audit_events" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "ticket_evidence" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "tickets" CASCADE`);

    const app = makeApp();
    const res = await app.request("/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({
        title: "Test Ticket",
        description: "Something is broken",
        priority: "HIGH",
        turbineId: h.turbine.id,
      }),
    });
    ticketId = (await res.json()).id;
  });

  it("creates a ticket with NEW status", async () => {
    const dbTicket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    expect(dbTicket?.status).toBe("NEW");
    expect(dbTicket?.priority).toBe("HIGH");
    expect(dbTicket?.created_by).toBe(dispatcherId);
  });

  it("lists tickets with filters", async () => {
    const app = makeApp();
    const res = await app.request("/tickets?status=NEW");
    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].status).toBe("NEW");
  });

  it("transitions through full state machine: NEW → CLOSED", async () => {
    const app = makeApp();
    const tech = await createTestUser({ organizationId: h.org.id, role: "TECHNICIAN" });

    // NEW → TRIAGED
    let res = await app.request(`/tickets/${ticketId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({ status: "TRIAGED" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("TRIAGED");

    // TRIAGED → ASSIGNED (via assign endpoint)
    res = await app.request(`/tickets/${ticketId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({ assigneeId: tech.user.id }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("ASSIGNED");

    // ASSIGNED → IN_PROGRESS
    res = await app.request(`/tickets/${ticketId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader(technicianToken) },
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    expect(res.status).toBe(200);

    // IN_PROGRESS → PENDING_REVIEW
    res = await app.request(`/tickets/${ticketId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader(technicianToken) },
      body: JSON.stringify({ status: "PENDING_REVIEW" }),
    });
    expect(res.status).toBe(200);

    // PENDING_REVIEW → CLOSED
    res = await app.request(`/tickets/${ticketId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({ resolutionNotes: "Fixed the thing", rootCause: "Wear and tear" }),
    });
    expect(res.status).toBe(200);
    const closed = await res.json();
    expect(closed.status).toBe("CLOSED");
    expect(closed.resolution_notes).toBe("Fixed the thing");
    expect(closed.closed_at).toBeDefined();
  });

  it("rejects invalid state transition", async () => {
    const app = makeApp();
    // NEW → IN_PROGRESS is invalid
    const res = await app.request(`/tickets/${ticketId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    expect(res.status).toBe(422);
  });

  it("reopens a closed ticket", async () => {
    const app = makeApp();
    const tech = await createTestUser({ organizationId: h.org.id, role: "TECHNICIAN" });

    // Move to CLOSED
    await app.request(`/tickets/${ticketId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({ status: "TRIAGED" }),
    });
    await app.request(`/tickets/${ticketId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({ assigneeId: tech.user.id }),
    });
    await app.request(`/tickets/${ticketId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader(technicianToken) },
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    await app.request(`/tickets/${ticketId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader(technicianToken) },
      body: JSON.stringify({ status: "PENDING_REVIEW" }),
    });
    await app.request(`/tickets/${ticketId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({ resolutionNotes: "Done" }),
    });

    // Reopen
    const res = await app.request(`/tickets/${ticketId}/reopen`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({ reason: "Issue recurred" }),
    });
    expect(res.status).toBe(200);
    const reopened = await res.json();
    expect(reopened.status).toBe("REOPENED");
    expect(reopened.resolution_notes).toBeNull();
    expect(reopened.closed_at).toBeNull();
  });

  it("creates audit events on transitions", async () => {
    const app = makeApp();
    await app.request(`/tickets/${ticketId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader(dispatcherToken) },
      body: JSON.stringify({ status: "TRIAGED" }),
    });

    const events = await prisma.auditEvent.findMany({
      where: { entity_type: "TICKET", entity_id: ticketId },
    });
    // CREATE + STATUS_CHANGE
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.some((e) => e.action === "CREATE")).toBe(true);
    expect(events.some((e) => e.action === "STATUS_CHANGE")).toBe(true);
  });

  it("GET /tickets/:id returns full detail with audit trail", async () => {
    const app = makeApp();
    const res = await app.request(`/tickets/${ticketId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(ticketId);
    expect(body.audit_events).toBeDefined();
    expect(body.audit_events.length).toBeGreaterThanOrEqual(1);
  });
});
