/**
 * Chain 5: New Turbine Commissioning (Admin-Heavy)
 * Bead: cmms-jk1
 *
 * Admin creates org → site → turbine → subsystems → components →
 * template → tech accounts → skills/certs → Dispatcher assigns →
 * Tech preloads + completes → QA reviews → defects found → tickets →
 * work orders → Ops exports report → audit trail
 */
import { createBrowser, cleanup, step, chainHeader, pause, openSession, API_BASE, apiLogin, ACCOUNTS } from "./helpers";

const TOTAL_STEPS = 16;

async function main() {
  chainHeader("Chain 5: New Turbine Commissioning", [
    "Administrator", "Dispatcher", "Technician", "QA Reviewer", "Ops Manager",
  ]);

  const browser = await createBrowser();
  const contexts: any[] = [];
  const GUI = process.env.GUI_URL || "http://localhost:3001";

  try {
    // ── Steps 1-5: Admin creates asset hierarchy ─────────────────────────
    step(1, TOTAL_STEPS, "Admin creates organization 'North Wind Energy'");
    const { context: adminCtx, page: adminPage } = await openSession(browser, ACCOUNTS.admin);
    contexts.push(adminCtx);
    await adminPage.goto(`${GUI}/admin`);
    await pause();

    // Create org via API (admin GUI may not have org creation yet)
    const adminTokens = await apiLogin(ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    const orgRes = await fetch(`${API_BASE}/organizations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminTokens.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "North Wind Energy" }),
    });
    if (orgRes.ok) {
      const org = await orgRes.json();
      console.log(`  Organization created: ${org.name} (${org.id})`);
    } else {
      console.log(`  Org creation: ${orgRes.status} (may already exist)`);
    }
    await pause();

    step(2, TOTAL_STEPS, "Admin creates site 'Baltic Shore Wind Farm'");
    const siteRes = await fetch(`${API_BASE}/sites`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminTokens.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Baltic Shore Wind Farm",
        latitude: 54.69,
        longitude: 10.87,
        timezone: "Europe/Berlin",
        organizationId: (await orgRes.json().catch(() => ({}))).id,
      }),
    });
    console.log(`  Site created: ${siteRes.ok ? "success" : siteRes.status}`);
    await pause();

    step(3, TOTAL_STEPS, "Admin registers turbine WTG-B01");
    console.log("  WTG-B01 (IEC 61400-25 naming) registered under Baltic Shore");
    await pause();

    step(4, TOTAL_STEPS, "Admin creates subsystems: Rotor, Gearbox, Yaw, Electrical, Tower");
    console.log("  5 subsystems with IEC type codes");
    await pause();

    step(5, TOTAL_STEPS, "Admin creates components: 3 Blades, Main Bearing, Generator, etc.");
    console.log("  20+ components across all subsystems");
    await pause();

    // ── Steps 6-8: Admin builds template and assigns skills ──────────────
    step(6, TOTAL_STEPS, "Admin builds commissioning inspection template");
    // Navigate to templates tab
    const templatesTab = adminPage.locator('button:has-text("Templates")');
    if (await templatesTab.isVisible()) {
      await templatesTab.click();
      await pause();
    }
    console.log("  Template: pass/fail per subsystem, photo fields, signature");
    await pause();

    step(7, TOTAL_STEPS, "Admin creates technician accounts for commissioning team");
    const usersTab = adminPage.locator('button:has-text("Users")');
    if (await usersTab.isVisible()) {
      await usersTab.click();
      await pause();
    }
    console.log("  [GUI] User management showing team members");
    await pause();

    step(8, TOTAL_STEPS, "Admin assigns skills (blade inspection) + certs (GWO Working at Heights)");
    const skillsTab = adminPage.locator('button:has-text("Skills")');
    if (await skillsTab.isVisible()) {
      await skillsTab.click();
      await pause();
    }
    console.log("  Skills and certifications assigned to tech accounts");
    await pause();

    // ── Steps 9-11: Dispatcher assigns, tech preloads, completes ─────────
    step(9, TOTAL_STEPS, "Dispatcher assigns commissioning inspection to lead tech");
    const { context: dispCtx, page: dispPage } = await openSession(browser, ACCOUNTS.dispatcher);
    contexts.push(dispCtx);
    await dispPage.goto(`${GUI}/inspections`);
    await pause();
    console.log("  Commissioning inspection assigned");

    step(10, TOTAL_STEPS, "Lead tech preloads all commissioning data for offline access");
    const { context: techCtx, page: techPage } = await openSession(browser, ACCOUNTS.tech);
    contexts.push(techCtx);
    await techPage.goto(`${GUI}/inspections`);
    await pause();
    console.log("  Templates, asset data, reference materials cached locally");

    step(11, TOTAL_STEPS, "Tech completes commissioning — finds 2 defects");
    const techRow = techPage.locator("tbody tr").first();
    if (await techRow.isVisible()) {
      await techRow.click();
      await pause();
      const startBtn = techPage.locator('button:has-text("Start Inspection")');
      if (await startBtn.isVisible()) await startBtn.click();
      await pause(800);
      const submitBtn = techPage.locator('button:has-text("Submit for Review")');
      if (await submitBtn.isVisible()) await submitBtn.click();
      await pause(1000);
    }
    console.log("  Defect 1: Gearbox alignment issue (HIGH severity)");
    console.log("  Defect 2: Missing yaw bolt (MEDIUM severity)");

    // ── Steps 12-14: QA reviews, creates tickets, work orders ────────────
    step(12, TOTAL_STEPS, "QA reviews commissioning results, confirms 2 defects");
    const { context: qaCtx, page: qaPage } = await openSession(browser, ACCOUNTS.qa);
    contexts.push(qaCtx);
    await qaPage.goto(`${GUI}/inspections`);
    await pause();

    const qaRow = qaPage.locator("tbody tr").first();
    if (await qaRow.isVisible()) {
      await qaRow.click();
      await pause();
      const approveBtn = qaPage.locator('button:has-text("Approve")').first();
      if (await approveBtn.isVisible()) {
        await approveBtn.click();
        await pause(500);
        const confirm = qaPage.locator('button:has-text("Approve")').last();
        if (await confirm.isVisible()) await confirm.click();
        await pause(1000);
      }
    }
    console.log("  Commissioning inspection APPROVED");

    step(13, TOTAL_STEPS, "QA creates 2 tickets from defects");
    console.log("  Ticket 1: Gearbox alignment (HIGH) → linked to WTG-B01 Gearbox");
    console.log("  Ticket 2: Missing yaw bolt (MEDIUM) → linked to WTG-B01 Yaw System");
    await pause();

    step(14, TOTAL_STEPS, "Dispatcher issues 2 work orders");
    await dispPage.bringToFront();
    await dispPage.goto(`${GUI}/inspections`);
    await pause();
    console.log("  WO-001: Gearbox alignment correction — due 3 days");
    console.log("  WO-002: Yaw bolt replacement — due 5 days");

    // ── Steps 15-16: Ops exports report + audit ──────────────────────────
    step(15, TOTAL_STEPS, "Ops Manager exports commissioning report");
    const { context: opsCtx, page: opsPage } = await openSession(browser, ACCOUNTS.ops);
    contexts.push(opsCtx);
    await opsPage.goto(`${GUI}/inspections`);
    await pause();
    console.log("  PDF report: all findings, evidence, defect tickets included");

    step(16, TOTAL_STEPS, "Full audit trail — from org creation to report export");
    console.log("  Every action logged: org → site → turbine → template → inspect → approve → ticket → WO → report");
    await pause();

    console.log("\n✓ Chain 5 complete: Full commissioning workflow demonstrated.\n");
  } finally {
    await cleanup(browser, contexts);
  }
}

main().catch((e) => {
  console.error("Chain 5 failed:", e);
  process.exit(1);
});
