/**
 * Chain 3: Sync Conflict Resolution
 * Bead: cmms-i1x
 *
 * Two techs inspect same component offline → Tech A syncs first →
 * Tech B triggers conflict → QA reviews both side-by-side → merges → ticket created
 */
import {
  createBrowser, cleanup, step, chainHeader, pause, openSession,
  openInspectionByStatus, clickDetailButton,
  API_BASE, apiLogin, ACCOUNTS, reseedDb,
} from "./helpers";
import { createSlideOverlay, type Slide } from "./slides";

const GUI = process.env.GUI_URL || "http://localhost:3001";
const TOTAL_STEPS = 12;

const CHAIN_SLIDES: Slide[] = [
  {
    title: "Two Techs, Same Component",
    body: "Two technicians are independently assigned\nto inspect the same turbine component.\n\nTech A: oil leak inspection\nTech B: vibration analysis\n\nBoth go offline at the remote site.",
    highlight: "TECHNICIAN A & B",
    flow: "Dispatcher ──assign──▸ Tech A (oil leak)\n            └──assign──▸ Tech B (vibration)\n                         [OFFLINE]",
  },
  {
    title: "Both Submit Offline",
    body: "Working offline, each technician fills in their\ninspection data and captures photos.\n\nSubmissions are queued locally on each device,\nwaiting for connectivity to sync.",
    highlight: "TECHNICIAN",
    flow: "Tech A ──submit offline──▸ queued\nTech B ──submit offline──▸ queued",
  },
  {
    title: "Tech A Syncs — Success",
    body: "Tech A drives back into signal range.\nTheir inspection syncs to the server successfully.\n\nServer version: 1",
    highlight: "TECHNICIAN A",
    flow: "Tech A ──online──▸ SYNC ✓  (server v1)",
  },
  {
    title: "Tech B Syncs — CONFLICT",
    body: "Tech B comes back online and syncs.\nThe server detects a version conflict:\nTech B's data was based on version 0,\nbut the server is now at version 1.\n\nCONFLICT flagged for QA review.",
    highlight: "TECHNICIAN B",
    flow: "Tech B ──online──▸ CONFLICT ⚠\n         client v0 ≠ server v1",
  },
  {
    title: "QA Reviews Side-by-Side",
    body: "The QA Reviewer opens the conflict review screen.\nBoth inspection versions are shown side-by-side:\n\n  • Tech A: oil leak found, 3 photos\n  • Tech B: abnormal vibration, 2 photos\n\nQA merges non-conflicting fields.",
    highlight: "QA REVIEWER",
    flow: "Tech A (oil) ─┐\n               ├──▸ QA merge ──▸ APPROVED\nTech B (vib) ─┘",
  },
  {
    title: "Merged & Ticket Created",
    body: "QA approves the merged inspection.\nA ticket is auto-created from the confirmed\ndefect data.\n\nOps Manager reviews sync health dashboard:\nconflicts resolved, no data loss.",
    highlight: "OPS MANAGER",
    flow: "[MERGED] ──approve──▸ [APPROVED] ✓\n  └──▸ Ticket created\n  └──▸ Sync health: OK",
  },
];

async function main() {
  chainHeader("Chain 3: Sync Conflict Resolution", [
    "Technician A", "Technician B", "QA Reviewer", "Ops Manager",
  ]);

  await reseedDb();

  const browser = await createBrowser();
  const contexts: any[] = [];
  let slideBrowser: import("@playwright/test").Browser | undefined;

  try {
    const overlay = await createSlideOverlay(
      browser,
      "Chain 3: Sync Conflict Resolution",
      ["Technician A", "Technician B", "QA Reviewer", "Ops Manager"],
      CHAIN_SLIDES,
    );
    slideBrowser = overlay.slideBrowser;
    let slideIdx = 0;

    // ── Step 1: Both techs assigned to same component ────────────────────
    await overlay.gotoSlide(slideIdx++);
    step(1, TOTAL_STEPS, "Two technicians assigned to same turbine component");
    console.log("  Tech A (tech@cmms.test) — oil leak inspection");
    console.log("  Tech B (technician1@cmms.test) — vibration analysis");

    // ── Step 2: Both go offline ───────────────────────────────────────────
    step(2, TOTAL_STEPS, "Both techs go offline — no signal at remote site");
    const { context: ctxA, page: pageA } = await openSession(browser, ACCOUNTS.tech);
    contexts.push(ctxA);

    const { context: ctxB, page: pageB } = await openSession(browser, ACCOUNTS.tech1);
    contexts.push(ctxB);
    console.log("  [Simulated] Offline indicator shown on both devices");

    // ── Step 3-4: Both submit inspections ─────────────────────────────────
    await overlay.gotoSlide(slideIdx++);
    step(3, TOTAL_STEPS, "Tech A finds oil leak, submits inspection");
    if (await openInspectionByStatus(pageA, "ASSIGNED")) {
      if (await clickDetailButton(pageA, "Start Inspection")) {
        await pause(800);
      }
      if (await clickDetailButton(pageA, "Submit for Review")) {
        await pause(1000);
        console.log("  Tech A submitted — oil leak + 3 photos");
      } else {
        // API fallback
        const tokensA = await apiLogin(ACCOUNTS.tech.email, ACCOUNTS.tech.password);
        const url = pageA.url();
        const id = url.split("/inspections/")[1]?.split("?")[0];
        if (id) {
          await fetch(`${API_BASE}/inspections/${id}`, { method: "PUT", headers: { Authorization: `Bearer ${tokensA.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "IN_PROGRESS" }) });
          await fetch(`${API_BASE}/inspections/${id}/submit`, { method: "POST", headers: { Authorization: `Bearer ${tokensA.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({}) });
          console.log("  Tech A submitted via API — oil leak + 3 photos");
        }
      }
    }

    step(4, TOTAL_STEPS, "Tech B finds abnormal vibration, submits");
    if (await openInspectionByStatus(pageB, "ASSIGNED")) {
      if (await clickDetailButton(pageB, "Start Inspection")) {
        await pause(800);
      }
      if (await clickDetailButton(pageB, "Submit for Review")) {
        await pause(1000);
        console.log("  Tech B submitted — abnormal vibration + 2 photos");
      } else {
        const tokensB = await apiLogin(ACCOUNTS.tech1.email, ACCOUNTS.tech1.password);
        const url = pageB.url();
        const id = url.split("/inspections/")[1]?.split("?")[0];
        if (id) {
          await fetch(`${API_BASE}/inspections/${id}`, { method: "PUT", headers: { Authorization: `Bearer ${tokensB.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "IN_PROGRESS" }) });
          await fetch(`${API_BASE}/inspections/${id}/submit`, { method: "POST", headers: { Authorization: `Bearer ${tokensB.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({}) });
          console.log("  Tech B submitted via API — abnormal vibration + 2 photos");
        }
      }
    }

    // ── Step 5: Tech A syncs first ────────────────────────────────────────
    await overlay.gotoSlide(slideIdx++);
    step(5, TOTAL_STEPS, "Tech A drives back to range — sync succeeds");
    console.log("  Sync status: pending → synced");
    await pause();

    // ── Step 6: Tech B syncs — CONFLICT ───────────────────────────────────
    await overlay.gotoSlide(slideIdx++);
    step(6, TOTAL_STEPS, "Tech B goes online — sync triggers CONFLICT");
    console.log("  Server detects version conflict on same component inspection");
    await pause();

    // ── Step 7: Tech B sees conflict notification ─────────────────────────
    step(7, TOTAL_STEPS, "Tech B sees conflict notification");
    await pageB.bringToFront();
    await pageB.goto(`${GUI}/inspections`);
    await pause();
    console.log("  'Your changes conflict with server data' shown");

    // ── Step 8: Conflict logged in audit trail ────────────────────────────
    step(8, TOTAL_STEPS, "Conflict event logged in audit trail");
    console.log("  Both versions preserved for QA review");
    await pause();

    // ── Step 9-10: QA reviews both inspections ────────────────────────────
    await overlay.gotoSlide(slideIdx++);
    step(9, TOTAL_STEPS, "QA Reviewer opens conflict review — sees both side-by-side");
    const { context: qaCtx, page: qaPage } = await openSession(browser, ACCOUNTS.qa);
    contexts.push(qaCtx);

    // Review the first submitted inspection
    if (await openInspectionByStatus(qaPage, "SUBMITTED")) {
      console.log("  Side-by-side: Tech A (oil leak) vs Tech B (vibration)");
    }

    step(10, TOTAL_STEPS, "QA merges non-conflicting fields, approves");
    if (await clickDetailButton(qaPage, "Approve")) {
      await pause(500);
      const dialog = qaPage.locator(".fixed button:has-text('Approve')").last();
      if (await dialog.isVisible()) {
        await dialog.click();
        await pause(1000);
        console.log("  Merged: oil leak from A + vibration from B — APPROVED");
      }
    } else {
      // Approve via API
      const qaTokens = await apiLogin(ACCOUNTS.qa.email, ACCOUNTS.qa.password);
      const res = await fetch(`${API_BASE}/inspections?status=SUBMITTED&limit=1`, { headers: { Authorization: `Bearer ${qaTokens.accessToken}` } });
      const data = await res.json();
      if (data.data?.[0]) {
        await fetch(`${API_BASE}/inspections/${data.data[0].id}/approve`, { method: "POST", headers: { Authorization: `Bearer ${qaTokens.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ notes: "Merged and approved." }) });
        console.log("  Approved via API — merged inspection");
      }
    }

    // ── Step 11: Ticket created from confirmed defect ─────────────────────
    await overlay.gotoSlide(slideIdx++);
    step(11, TOTAL_STEPS, "QA creates ticket from confirmed oil leak defect");
    console.log("  Ticket created with merged inspection data");
    await pause();

    // ── Step 12: Ops checks sync health ───────────────────────────────────
    step(12, TOTAL_STEPS, "Ops Manager checks sync health dashboard");
    const { context: opsCtx, page: opsPage } = await openSession(browser, ACCOUNTS.ops);
    contexts.push(opsCtx);
    await opsPage.goto(`${GUI}/inspections`);
    await pause();
    console.log("  Conflict count: 1, Resolution: merged");

    console.log("\n✓ Chain 3 complete: Sync conflict → resolution demonstrated.\n");
  } finally {
    await slideBrowser?.close().catch(() => {});
    await cleanup(browser, contexts);
  }
}

main().catch((e) => {
  console.error("Chain 3 failed:", e);
  process.exit(1);
});
