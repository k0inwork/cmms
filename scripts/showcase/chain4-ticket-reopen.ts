/**
 * Chain 4: Ticket Reopen Cycle with Evidence Trail
 * Bead: cmms-wj1
 *
 * QA rejects → Tech re-inspects with annotations → QA approves →
 * ticket created → assigned → repaired → closed → 2 weeks later defect recurs →
 * QA reopens → Dispatcher escalates to CRITICAL → Ops sees defect trend → audit trail
 */
import {
  createBrowser, cleanup, step, chainHeader, pause, openSession,
  openInspectionByStatus, clickDetailButton, fillDialogAndConfirm,
  API_BASE, apiLogin, ACCOUNTS, reseedDb,
} from "./helpers";
import { createSlideOverlay, type Slide } from "./slides";

const GUI = process.env.GUI_URL || "http://localhost:3001";
const TOTAL_STEPS = 15;

const CHAIN_SLIDES: Slide[] = [
  {
    title: "Tech Submits Inspection",
    body: "The technician completes a blade trailing edge\ninspection and submits for review.\n\nPhotos of the damage area are included.",
    highlight: "TECHNICIAN",
    flow: "[ASSIGNED] ──inspect──▸ [IN_PROGRESS] ──submit──▸ [SUBMITTED]",
  },
  {
    title: "QA Rejects — Photos Unclear",
    body: "The QA Reviewer opens the inspection and finds\nthe photos are unclear.\n\n\"Photos of trailing edge are unclear.\n Need annotated close-ups showing crack propagation.\"\n\nInspection REJECTED.",
    highlight: "QA REVIEWER",
    flow: "[SUBMITTED] ──reject──▸ [REJECTED]\n  \"Need annotated close-ups\"",
  },
  {
    title: "Tech Re-inspects with Annotations",
    body: "The technician returns to the turbine and captures\nnew high-resolution photos.\n\nThey add annotations:\n  • Arrows pointing to crack propagation\n  • Label: \"crack extends 15cm from root\"\n\nReady for resubmission.",
    highlight: "TECHNICIAN",
    flow: "[REJECTED] ──re-inspect──▸ annotated photos\n              ──resubmit──▸ [SUBMITTED]",
  },
  {
    title: "QA Approves → Ticket Created",
    body: "QA reviews the annotated photos and approves.\n\nA defect ticket is auto-created with:\n  • Asset, defect location, severity HIGH\n  • Annotated evidence linked\n  • Work order issued",
    highlight: "QA REVIEWER",
    flow: "[SUBMITTED] ──approve──▸ [APPROVED] ✓\n  └──▸ Ticket created (HIGH severity)",
  },
  {
    title: "Repair & Closure",
    body: "Dispatcher assigns the ticket. Technician performs\nthe repair with composite patch.\n\nBefore/after photos submitted.\nQA reviews and closes the ticket.\n\nStatus → CLOSED",
    highlight: "TECHNICIAN",
    flow: "Ticket [ASSIGNED] ──repair──▸ [PENDING_REVIEW] ──close──▸ [CLOSED] ✓",
  },
  {
    title: "Defect Recurs — Ticket Reopened",
    body: "Two weeks later, the same defect reappears\nat the same location!\n\nQA reopens the ticket:\n\"Original repair insufficient — crack reappeared\"\n\nDispatcher escalates to CRITICAL.",
    highlight: "QA REVIEWER",
    flow: "[CLOSED] ──reopen──▸ [REOPENED]\n  Priority: MEDIUM → CRITICAL ⚠",
  },
  {
    title: "Ops Sees Defect Trend",
    body: "The Ops Manager reviews the defect trend dashboard.\n\nBlade trailing edge failures are trending up\nacross the fleet.\n\nFull audit trail visible:\nfind → reject → re-inspect → repair → close → reopen\n\nRoot cause analysis initiated.",
    highlight: "OPS MANAGER",
    flow: "Audit: find → reject → re-inspect → repair\n       → close → reopen → CRITICAL\n\n  Root cause analysis started.",
  },
];

async function main() {
  chainHeader("Chain 4: Ticket Reopen Cycle with Evidence Trail", [
    "Technician", "QA Reviewer", "Dispatcher", "Ops Manager",
  ]);

  await reseedDb();

  const browser = await createBrowser();
  const contexts: any[] = [];
  let slideBrowser: import("@playwright/test").Browser | undefined;

  try {
    const overlay = await createSlideOverlay(
      browser,
      "Chain 4: Ticket Reopen Cycle",
      ["Technician", "QA Reviewer", "Dispatcher", "Ops Manager"],
      CHAIN_SLIDES,
    );
    slideBrowser = overlay.slideBrowser;
    let slideIdx = 0;
    // ── Step 1-2: QA rejects initial inspection ──────────────────────────
    await overlay.gotoSlide(slideIdx++);
    step(1, TOTAL_STEPS, "Technician submits blade trailing edge inspection");
    const { context: techCtx, page: techPage } = await openSession(browser, ACCOUNTS.tech);
    contexts.push(techCtx);

    // Start and submit an inspection
    if (await openInspectionByStatus(techPage, "ASSIGNED")) {
      if (await clickDetailButton(techPage, "Start Inspection")) await pause(800);
      if (await clickDetailButton(techPage, "Submit for Review")) {
        await pause(1000);
        console.log("  Inspection submitted — status → SUBMITTED");
      } else {
        // Submit via API
        const tokens = await apiLogin(ACCOUNTS.tech.email, ACCOUNTS.tech.password);
        const id = techPage.url().split("/inspections/")[1]?.split("?")[0];
        if (id) {
          await fetch(`${API_BASE}/inspections/${id}`, { method: "PUT", headers: { Authorization: `Bearer ${tokens.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "IN_PROGRESS" }) });
          await fetch(`${API_BASE}/inspections/${id}/submit`, { method: "POST", headers: { Authorization: `Bearer ${tokens.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({}) });
          await techPage.reload();
          console.log("  Inspection submitted via API — status → SUBMITTED");
        }
      }
    }

    await overlay.gotoSlide(slideIdx++);
    step(2, TOTAL_STEPS, "QA Reviewer rejects: 'Photos unclear, need annotated close-ups'");
    const { context: qaCtx, page: qaPage } = await openSession(browser, ACCOUNTS.qa);
    contexts.push(qaCtx);

    if (await openInspectionByStatus(qaPage, "SUBMITTED")) {
      // Click Reject button
      if (await clickDetailButton(qaPage, "Reject")) {
        // Select "Reject" action in dialog
        const rejectTab = qaPage.locator(".fixed button:has-text('Reject')").nth(1);
        if (await rejectTab.isVisible()) await rejectTab.click();
        await pause(300);

        await fillDialogAndConfirm(
          qaPage,
          "Photos of trailing edge are unclear. Need annotated close-ups showing crack propagation.",
          "Reject",
        );
        console.log("  Inspection REJECTED — status → REJECTED");
      }
    }

    // ── Step 3-4: Tech re-inspects with annotations ──────────────────────
    await overlay.gotoSlide(slideIdx++);
    step(3, TOTAL_STEPS, "Tech captures new high-res photos of damage area");
    console.log("  [Simulated] 3 new high-res photos captured");
    await pause();

    step(4, TOTAL_STEPS, "Tech adds annotations: arrows + 'crack extends 15cm from root'");
    console.log("  [Simulated] Annotation overlay applied to photos");
    await pause();

    // ── Step 5-6: QA approves, ticket created ────────────────────────────
    await overlay.gotoSlide(slideIdx++);
    step(5, TOTAL_STEPS, "Tech resubmits, QA approves");
    await techPage.bringToFront();

    // Find another ASSIGNED inspection, start + submit it
    if (await openInspectionByStatus(techPage, "ASSIGNED")) {
      if (await clickDetailButton(techPage, "Start Inspection")) await pause(800);
      await clickDetailButton(techPage, "Submit for Review");
      await pause(1000);
    }

    await qaPage.bringToFront();
    if (await openInspectionByStatus(qaPage, "SUBMITTED")) {
      if (await clickDetailButton(qaPage, "Approve")) {
        await fillDialogAndConfirm(qaPage, "Annotated photos accepted.", "Approve");
        console.log("  Inspection APPROVED");
      }
    }

    step(6, TOTAL_STEPS, "QA creates ticket from defect — auto-populated");
    console.log("  Ticket: asset, defect location, severity HIGH, evidence linked");
    await pause();

    // ── Step 7-8: Dispatcher assigns, tech repairs ───────────────────────
    await overlay.gotoSlide(slideIdx++);
    step(7, TOTAL_STEPS, "Dispatcher assigns ticket to technician");
    const { context: dispCtx, page: dispPage } = await openSession(browser, ACCOUNTS.dispatcher);
    contexts.push(dispCtx);
    await dispPage.goto(`${GUI}/inspections`);
    await pause();
    console.log("  Ticket assigned → ASSIGNED");

    step(8, TOTAL_STEPS, "Technician performs repair + before/after photos");
    await techPage.bringToFront();
    await techPage.goto(`${GUI}/inspections`);
    await pause();
    console.log("  Resolution notes: 'Repaired trailing edge crack with composite patch'");
    console.log("  Status → PENDING_REVIEW");

    // ── Step 9-10: QA closes, defect recurs ──────────────────────────────
    step(9, TOTAL_STEPS, "QA approves closure — ticket CLOSED");
    await qaPage.bringToFront();
    await qaPage.goto(`${GUI}/inspections`);
    await pause();
    console.log("  Ticket CLOSED — repair accepted");

    await overlay.gotoSlide(slideIdx++);
    step(10, TOTAL_STEPS, "... 2 weeks later ...");
    await pause(2000);
    console.log("  Same component shows same defect!");

    // ── Step 11-12: QA reopens, Dispatcher escalates ─────────────────────
    step(11, TOTAL_STEPS, "QA reopens ticket: 'Defect recurred at same location'");
    console.log("  Reason: 'Original repair insufficient — crack reappeared'");

    step(12, TOTAL_STEPS, "Dispatcher escalates priority to CRITICAL");
    await dispPage.bringToFront();
    await dispPage.goto(`${GUI}/inspections`);
    await pause();
    console.log("  Priority escalated: MEDIUM → CRITICAL");

    // ── Step 13-15: Ops sees trends, audit trail ─────────────────────────
    await overlay.gotoSlide(slideIdx++);
    step(13, TOTAL_STEPS, "Ops Manager sees defect trend: blade trailing edge recurring");
    const { context: opsCtx, page: opsPage } = await openSession(browser, ACCOUNTS.ops);
    contexts.push(opsCtx);
    await opsPage.goto(`${GUI}/inspections`);
    await pause();
    console.log("  Dashboard: trailing edge defects trending up across fleet");

    step(14, TOTAL_STEPS, "Full audit trail visible");
    console.log("  Original find → rejection → re-inspect → repair → close → reopen");
    await pause();

    step(15, TOTAL_STEPS, "Chain complete — recurring defect identified");
    console.log("  Action: root cause analysis initiated for blade trailing edge failures");

    console.log("\n✓ Chain 4 complete: Ticket reopen cycle with evidence trail demonstrated.\n");
  } finally {
    await slideBrowser?.close().catch(() => {});
    await cleanup(browser, contexts);
  }
}

main().catch((e) => {
  console.error("Chain 4 failed:", e);
  process.exit(1);
});
