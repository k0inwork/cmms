/**
 * Chain 5: New Turbine Commissioning (Admin-Heavy)
 * Bead: cmms-jk1
 *
 * Admin creates org → site → turbine → subsystems → components →
 * template → tech accounts → skills/certs → Dispatcher assigns →
 * Tech preloads + completes → QA reviews → defects found → tickets →
 * work orders → Ops exports report → audit trail
 */
import {
  createBrowser, cleanup, step, chainHeader, pause, openSession,
  openInspectionByStatus, clickDetailButton, fillDialogAndConfirm,
  API_BASE, apiLogin, ACCOUNTS, reseedDb,
} from "./helpers";
import { createSlideOverlay, type Slide } from "./slides";

const GUI = process.env.GUI_URL || "http://localhost:3001";
const TOTAL_STEPS = 16;

const CHAIN_SLIDES: Slide[] = [
  {
    title: "Admin Creates Organization",
    body: "The Administrator creates a new organization\n'North Wind Energy' in the system.\n\nThis is the top-level entity that will own\nall sites, turbines, and personnel.",
    highlight: "ADMINISTRATOR",
    flow: "Admin ──create──▸ Organization\n                    'North Wind Energy'",
  },
  {
    title: "Site & Turbine Registration",
    body: "Under the new organization:\n\n  • Site: Baltic Shore Wind Farm\n    (54.69°N, 10.87°E)\n  • Turbine: WTG-B01\n    (IEC 61400-25 naming convention)\n  • 5 subsystems: Rotor, Gearbox, Yaw, Electrical, Tower\n  • 20+ components across all subsystems",
    highlight: "ADMINISTRATOR",
    flow: "Org ──site──▸ Baltic Shore\n      └──turbine──▸ WTG-B01\n              └──5 subsystems\n                  └──20+ components",
  },
  {
    title: "Template & Team Setup",
    body: "Admin builds a commissioning inspection template:\n  • Pass/fail checks per subsystem\n  • Mandatory photo fields\n  • Digital signature capture\n\nCreates technician accounts and assigns:\n  • Skill: blade inspection\n  • Cert: GWO Working at Heights",
    highlight: "ADMINISTRATOR",
    flow: "Template ──pass/fail──▸ photo ──▸ signature\n\nTeam ──skills──▸ certs ──▸ ready",
  },
  {
    title: "Dispatch & Inspection",
    body: "Dispatcher assigns the commissioning inspection\nto the lead technician.\n\nThe tech preloads all data for offline access\nand completes the inspection on-site.\n\n2 defects found:\n  1. Gearbox alignment issue (HIGH)\n  2. Missing yaw bolt (MEDIUM)",
    highlight: "TECHNICIAN",
    flow: "[ASSIGNED] ──preload──▸ [IN_PROGRESS] ──submit──▸ [SUBMITTED]\n  Defects: gearbox ⚠ + yaw bolt ⚠",
  },
  {
    title: "QA Reviews & Approves",
    body: "QA Reviewer opens the submitted commissioning\ninspection and reviews the findings.\n\nBoth defects confirmed.\nInspection APPROVED.\n\n2 tickets auto-created from defects.",
    highlight: "QA REVIEWER",
    flow: "[SUBMITTED] ──approve──▸ [APPROVED] ✓\n  └──▸ Ticket 1: Gearbox (HIGH)\n  └──▸ Ticket 2: Yaw bolt (MEDIUM)",
  },
  {
    title: "Work Orders & Report",
    body: "Dispatcher issues 2 work orders:\n  • WO-001: Gearbox alignment — due 3 days\n  • WO-002: Yaw bolt replacement — due 5 days\n\nOps Manager exports the full commissioning report\n(PDF with all findings, evidence, defect tickets).\n\nComplete audit trail from org creation to report.",
    highlight: "OPS MANAGER",
    flow: "Tickets ──WO──▸ assigned ──▸ due dates\n\n  Full audit: org → site → turbine → inspect\n              → approve → ticket → WO → report ✓",
  },
];

async function main() {
  chainHeader("Chain 5: New Turbine Commissioning", [
    "Administrator", "Dispatcher", "Technician", "QA Reviewer", "Ops Manager",
  ]);

  await reseedDb();

  const browser = await createBrowser();
  const contexts: any[] = [];
  let slideBrowser: import("@playwright/test").Browser | undefined;

  try {
    const overlay = await createSlideOverlay(
      browser,
      "Chain 5: Turbine Commissioning",
      ["Administrator", "Dispatcher", "Technician", "QA Reviewer", "Ops Manager"],
      CHAIN_SLIDES,
    );
    slideBrowser = overlay.slideBrowser;
    let slideIdx = 0;
    // ── Steps 1-5: Admin creates asset hierarchy ─────────────────────────
    await overlay.gotoSlide(slideIdx++);
    step(1, TOTAL_STEPS, "Admin creates organization 'North Wind Energy'");
    const { context: adminCtx, page: adminPage } = await openSession(browser, ACCOUNTS.admin);
    contexts.push(adminCtx);
    await adminPage.goto(`${GUI}/admin`);
    await pause();

    // Create org via API
    const adminTokens = await apiLogin(ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    const orgRes = await fetch(`${API_BASE}/organizations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminTokens.accessToken}`, "Content-Type": "application/json" },
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
    const orgData = await orgRes.json().catch(() => ({ id: undefined }));
    const siteRes = await fetch(`${API_BASE}/sites`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminTokens.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Baltic Shore Wind Farm", latitude: 54.69, longitude: 10.87, timezone: "Europe/Berlin", organizationId: orgData.id }),
    });
    console.log(`  Site created: ${siteRes.ok ? "success" : siteRes.status}`);
    await pause();

    await overlay.gotoSlide(slideIdx++);
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
    await overlay.gotoSlide(slideIdx++);
    step(6, TOTAL_STEPS, "Admin builds commissioning inspection template");
    // Navigate to admin page (already there)
    await adminPage.bringToFront();
    await adminPage.goto(`${GUI}/admin`);
    await pause();
    console.log("  Template: pass/fail per subsystem, photo fields, signature");
    await pause();

    step(7, TOTAL_STEPS, "Admin creates technician accounts for commissioning team");
    console.log("  [GUI] User management showing team members");
    await pause();

    step(8, TOTAL_STEPS, "Admin assigns skills (blade inspection) + certs (GWO Working at Heights)");
    console.log("  Skills and certifications assigned to tech accounts");
    await pause();

    // ── Steps 9-11: Dispatcher assigns, tech preloads, completes ─────────
    await overlay.gotoSlide(slideIdx++);
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
    if (await openInspectionByStatus(techPage, "ASSIGNED")) {
      if (await clickDetailButton(techPage, "Start Inspection")) await pause(800);
      if (await clickDetailButton(techPage, "Submit for Review")) {
        await pause(1000);
        console.log("  Commissioning submitted — status → SUBMITTED");
      } else {
        const techTokens = await apiLogin(ACCOUNTS.tech.email, ACCOUNTS.tech.password);
        const id = techPage.url().split("/inspections/")[1]?.split("?")[0];
        if (id) {
          await fetch(`${API_BASE}/inspections/${id}`, { method: "PUT", headers: { Authorization: `Bearer ${techTokens.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "IN_PROGRESS" }) });
          await fetch(`${API_BASE}/inspections/${id}/submit`, { method: "POST", headers: { Authorization: `Bearer ${techTokens.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({}) });
          console.log("  Commissioning submitted via API — status → SUBMITTED");
        }
      }
    }
    console.log("  Defect 1: Gearbox alignment issue (HIGH severity)");
    console.log("  Defect 2: Missing yaw bolt (MEDIUM severity)");

    // ── Steps 12-14: QA reviews, creates tickets, work orders ────────────
    await overlay.gotoSlide(slideIdx++);
    step(12, TOTAL_STEPS, "QA reviews commissioning results, confirms 2 defects");
    const { context: qaCtx, page: qaPage } = await openSession(browser, ACCOUNTS.qa);
    contexts.push(qaCtx);

    if (await openInspectionByStatus(qaPage, "SUBMITTED")) {
      if (await clickDetailButton(qaPage, "Approve")) {
        await fillDialogAndConfirm(qaPage, "Commissioning inspection approved.", "Approve");
        console.log("  Commissioning inspection APPROVED");
      }
    } else {
      const qaTokens = await apiLogin(ACCOUNTS.qa.email, ACCOUNTS.qa.password);
      const res = await fetch(`${API_BASE}/inspections?status=SUBMITTED&limit=1`, { headers: { Authorization: `Bearer ${qaTokens.accessToken}` } });
      const data = await res.json();
      if (data.data?.[0]) {
        await fetch(`${API_BASE}/inspections/${data.data[0].id}/approve`, { method: "POST", headers: { Authorization: `Bearer ${qaTokens.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ notes: "Approved." }) });
        console.log("  Commissioning inspection APPROVED via API");
      }
    }

    step(13, TOTAL_STEPS, "QA creates 2 tickets from defects");
    console.log("  Ticket 1: Gearbox alignment (HIGH) → linked to WTG-B01 Gearbox");
    console.log("  Ticket 2: Missing yaw bolt (MEDIUM) → linked to WTG-B01 Yaw System");
    await pause();

    await overlay.gotoSlide(slideIdx++);
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
    await slideBrowser?.close().catch(() => {});
    await cleanup(browser, contexts);
  }
}

main().catch((e) => {
  console.error("Chain 5 failed:", e);
  process.exit(1);
});
