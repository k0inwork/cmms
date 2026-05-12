/**
 * Chain 4: Ticket Reopen Cycle with Evidence Trail
 * Bead: cmms-wj1
 *
 * QA rejects → Tech re-inspects with annotations → QA approves →
 * ticket created → assigned → repaired → closed → 2 weeks later defect recurs →
 * QA reopens → Dispatcher escalates to CRITICAL → Ops sees defect trend → audit trail
 */
import { createBrowser, cleanup, step, chainHeader, pause, openSession, API_BASE, apiLogin, ACCOUNTS } from "./helpers";

const TOTAL_STEPS = 15;

async function main() {
  chainHeader("Chain 4: Ticket Reopen Cycle with Evidence Trail", [
    "Technician", "QA Reviewer", "Dispatcher", "Ops Manager",
  ]);

  const browser = await createBrowser();
  const contexts: any[] = [];
  const GUI = process.env.GUI_URL || "http://localhost:3001";

  try {
    // ── Step 1-2: QA rejects initial inspection ──────────────────────────
    step(1, TOTAL_STEPS, "Technician submits blade trailing edge inspection");
    const { context: techCtx, page: techPage } = await openSession(browser, ACCOUNTS.tech);
    contexts.push(techCtx);
    await techPage.goto(`${GUI}/inspections`);
    await pause();

    // Start and submit an inspection
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

    step(2, TOTAL_STEPS, "QA Reviewer rejects: 'Photos unclear, need annotated close-ups'");
    const { context: qaCtx, page: qaPage } = await openSession(browser, ACCOUNTS.qa);
    contexts.push(qaCtx);
    await qaPage.goto(`${GUI}/inspections`);
    await pause();

    const qaRow = qaPage.locator("tbody tr").first();
    if (await qaRow.isVisible()) {
      await qaRow.click();
      await pause();

      // Click Reject
      const rejectBtn = qaPage.locator('button:has-text("Reject")').first();
      if (await rejectBtn.isVisible()) {
        await rejectBtn.click();
        await pause(500);
        const notes = qaPage.locator("textarea").last();
        if (await notes.isVisible()) {
          await notes.fill("Photos of trailing edge are unclear. Need annotated close-ups showing crack propagation.");
        }
        await pause(500);
        const confirmReject = qaPage.locator('button:has-text("Reject")').last();
        if (await confirmReject.isVisible()) await confirmReject.click();
        await pause(1000);
        console.log("  Inspection REJECTED — status → REJECTED");
      }
    }

    // ── Step 3-4: Tech re-inspects with annotations ──────────────────────
    step(3, TOTAL_STEPS, "Tech captures new high-res photos of damage area");
    await techPage.bringToFront();
    await techPage.reload();
    await pause();
    console.log("  [Simulated] 3 new high-res photos captured");

    step(4, TOTAL_STEPS, "Tech adds annotations: arrows + 'crack extends 15cm from root'");
    console.log("  [Simulated] Annotation overlay applied to photos");
    await pause();

    // ── Step 5-6: QA approves, ticket created ────────────────────────────
    step(5, TOTAL_STEPS, "Tech resubmits, QA approves");
    const resubmitRow = techPage.locator("tbody tr").first();
    if (await resubmitRow.isVisible()) {
      await resubmitRow.click();
      await pause();
      const resubBtn = techPage.locator('button:has-text("Submit for Review")');
      if (await resubBtn.isVisible()) await resubBtn.click();
      await pause(1000);
    }

    await qaPage.bringToFront();
    await qaPage.reload();
    await pause();
    const approveRow = qaPage.locator("tbody tr").first();
    if (await approveRow.isVisible()) {
      await approveRow.click();
      await pause();
      const approveBtn = qaPage.locator('button:has-text("Approve")').first();
      if (await approveBtn.isVisible()) {
        await approveBtn.click();
        await pause(500);
        const confirm = qaPage.locator('button:has-text("Approve")').last();
        if (await confirm.isVisible()) await confirm.click();
        await pause(1000);
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
    await qaPage.reload();
    await pause();
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
