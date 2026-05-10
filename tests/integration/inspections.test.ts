import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import prisma from "./helpers/db.js";
import { cleanDatabase } from "./helpers/db.js";
import { createFullHierarchy, createInspectionTemplate, createTemplateVersion } from "./helpers/fixtures.js";
import { createTestUser, authHeader } from "./helpers/auth.js";
import inspectionRoutes from "../../../src/routes/inspections.js";

function makeApp() {
  const app = new Hono();
  app.route("/inspections", inspectionRoutes);
  return app;
}

describe("Inspection routes (integration)", () => {
  let h: Awaited<ReturnType<typeof createFullHierarchy>>;
  let techToken: string;
  let techId: string;
  let reviewerToken: string;
  let templateVersionId: string;

  beforeAll(async () => {
    await cleanDatabase();
    h = await createFullHierarchy();
    const tech = await createTestUser({ organizationId: h.org.id, role: "TECHNICIAN" });
    const reviewer = await createTestUser({ organizationId: h.org.id, role: "QA_REVIEWER" });
    techToken = tech.token;
    techId = tech.user.id;
    reviewerToken = reviewer.token;

    const tpl = await createInspectionTemplate();
    const version = await createTemplateVersion(tpl.id, techId);
    templateVersionId = version.id;
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it("POST creates an inspection record", async () => {
    const app = makeApp();
    const res = await app.request("/inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(techToken) },
      body: JSON.stringify({
        templateVersionId,
        technicianId: techId,
        turbineId: h.turbine.id,
        componentId: h.component.id,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("ASSIGNED");
    expect(body.technician_id).toBe(techId);
  });

  it("GET lists inspections with pagination", async () => {
    const app = makeApp();
    const res = await app.request("/inspections");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.pagination).toBeDefined();
  });

  it("inspection status transitions: ASSIGNED → IN_PROGRESS → SUBMITTED", async () => {
    const app = makeApp();

    // Create inspection
    const createRes = await app.request("/inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(techToken) },
      body: JSON.stringify({
        templateVersionId,
        technicianId: techId,
        turbineId: h.turbine.id,
      }),
    });
    const { id } = await createRes.json();

    // ASSIGNED → IN_PROGRESS via PUT with status field
    const startRes = await app.request(`/inspections/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader(techToken) },
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    expect(startRes.status).toBe(200);
    expect((await startRes.json()).status).toBe("IN_PROGRESS");

    // Update field data via PUT
    const fieldDataRes = await app.request(`/inspections/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader(techToken) },
      body: JSON.stringify({
        fieldData: {
          blade_condition: { value: "Good", type: "TEXT" },
          vibration_level: { value: 2.3, type: "NUMERIC" },
        },
      }),
    });
    expect(fieldDataRes.status).toBe(200);

    // Submit for review
    const submitRes = await app.request(`/inspections/${id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(techToken) },
      body: JSON.stringify({ notes: "All checks complete" }),
    });
    expect(submitRes.status).toBe(200);
    const submitted = await submitRes.json();
    expect(submitted.status).toBe("SUBMITTED");

    // Verify field data saved
    const fieldData = await prisma.inspectionFieldData.findMany({
      where: { inspection_id: id },
    });
    expect(fieldData).toHaveLength(2);
  });
});
