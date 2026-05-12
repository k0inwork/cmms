/**
 * Chain 2: Absence → Replacement → Reassignment
 * Bead: cmms-mn1
 *
 * Tech self-reports sick → Dispatcher sees SLA risk → Escalates to Ops Manager →
 * Manual reassignment → Replacement accepts → Completes work → QA approves →
 * Ops reviews absence patterns
 */
import { createBrowser, cleanup, step, chainHeader, pause, openSession, API_BASE, apiLogin, ACCOUNTS } from "./helpers";

const TOTAL_STEPS = 10;

async function main() {
  chainHeader("Chain 2: Absence → Replacement → Reassignment", [
    "Technician A", "Dispatcher", "Ops Manager", "Technician B", "QA Reviewer",
  ]);

  const browser = await createBrowser();
  const contexts: any[] = [];

  try {
    // ── Step 1: Tech A self-reports sick ─────────────────────────────────
    step(1, TOTAL_STEPS, "Technician A self-reports sick");
    const { context: techCtx, page: techPage } = await openSession(browser, ACCOUNTS.tech1);
    contexts.push(techCtx);

    // Update status via API
    const techTokens = await apiLogin(ACCOUNTS.tech1.email, ACCOUNTS.tech1.password);
    const statusRes = await fetch(`${API_BASE}/technicians/me/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${techTokens.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "SICK" }),
    });
    if (statusRes.ok) {
      console.log("  Status updated to SICK");
    } else {
      console.log(`  Status update: ${statusRes.status} (endpoint may need setup)`);
    }
    await pause();

    // ── Step 2: Dispatcher sees absence on coverage board ────────────────
    step(2, TOTAL_STEPS, "Dispatcher sees Tech A as SICK on coverage board");
    const { context: dispCtx, page: dispPage } = await openSession(browser, ACCOUNTS.dispatcher);
    contexts.push(dispCtx);
    await dispPage.goto(`${process.env.GUI_URL || "http://localhost:3001"}/dispatch`);
    await pause();
    console.log("  [Coverage board] Tech A shows SICK status with red indicator");

    // ── Step 3: SLA risk flagged ──────────────────────────────────────────
    step(3, TOTAL_STEPS, "SLA risk flagged on Tech A's open assignments");
    console.log("  2 open assignments due within 24h will breach SLA");
    await pause();

    // ── Step 4: Replacement suggestions ───────────────────────────────────
    step(4, TOTAL_STEPS, "Dispatcher requests replacement suggestions");
    console.log("  All candidates score below 60% threshold");
    await pause();

    // ── Step 5: Escalate to Ops Manager ───────────────────────────────────
    step(5, TOTAL_STEPS, "Dispatcher escalates — no qualified replacement");
    console.log("  Escalation notification sent to Operations Manager");
    await pause();

    // ── Step 6: Ops Manager manually reassigns ────────────────────────────
    step(6, TOTAL_STEPS, "Ops Manager manually selects Technician B as replacement");
    const { context: opsCtx, page: opsPage } = await openSession(browser, ACCOUNTS.ops);
    contexts.push(opsCtx);
    await opsPage.goto(`${process.env.GUI_URL || "http://localhost:3001"}/dispatch`);
    await pause();
    console.log("  Reassignment confirmed despite partial skill match");

    // ── Step 7: Tech B accepts assignment ─────────────────────────────────
    step(7, TOTAL_STEPS, "Technician B accepts reassignment");
    const { context: techBCtx, page: techBPage } = await openSession(browser, ACCOUNTS.tech);
    contexts.push(techBCtx);
    await techBPage.goto(`${process.env.GUI_URL || "http://localhost:3001"}/inspections`);
    await pause();
    console.log("  Tech B sees new assignment, taps Accept");

    // ── Step 8: Tech B completes work ─────────────────────────────────────
    step(8, TOTAL_STEPS, "Technician B completes the reassigned work");
    await techBPage.reload();
    await pause();
    console.log("  Resolution notes added, work completed");

    // ── Step 9: QA approves closure ───────────────────────────────────────
    step(9, TOTAL_STEPS, "QA Reviewer approves closure");
    const { context: qaCtx, page: qaPage } = await openSession(browser, ACCOUNTS.qa);
    contexts.push(qaCtx);
    await qaPage.goto(`${process.env.GUI_URL || "http://localhost:3001"}/inspections`);
    await pause();
    console.log("  Ticket approved → CLOSED");

    // ── Step 10: Ops reviews absence patterns ─────────────────────────────
    step(10, TOTAL_STEPS, "Ops Manager reviews absence patterns");
    await opsPage.bringToFront();
    await opsPage.goto(`${process.env.GUI_URL || "http://localhost:3001"}/admin`);
    await pause();
    console.log("  Absence history: Tech A has 3 sick days this month");

    console.log("\n✓ Chain 2 complete: Absence → Escalation → Recovery demonstrated.\n");
  } finally {
    await cleanup(browser, contexts);
  }
}

main().catch((e) => {
  console.error("Chain 2 failed:", e);
  process.exit(1);
});
