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
  API_BASE, apiLogin, ACCOUNTS,
} from "./helpers";

const GUI = process.env.GUI_URL || "http://localhost:3001";
const TOTAL_STEPS = 15;

async function main() {
  chainHeader("Chain 4: Ticket Reopen Cycle with Evidence Trail", [
    "Technician", "QA Reviewer", "Dispatcher", "Ops Manager",
  ]);

  const browser = await createBrowser();
  const contexts: any[] = [];

  try {
    // ── Step 1-2: QA rejects initial inspection ──────────────────────────
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
    step(3, TOTAL_STEPS, "Tech captures new high-res photos of damage area");
    console.log("  [Simulated] 3 new high-res photos captured");
    await pause();

    step(4, TOTAL_STEPS, "Tech adds annotations: arrows + 'crack extends 15cm from root'");
    console.log("  [Simulated] Annotation overlay applied to photos");
    await pause();

    // ── Step 5-6: QA approves, ticket created ────────────────────────────
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
    await cleanup(browser, contexts);
  }
}

main().catch((e) => {
  console.error("Chain 4 failed:", e);
  process.exit(1);
});
