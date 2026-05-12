/**
 * Run all 5 showcase chains sequentially
 */
import { chainHeader } from "./helpers";

const chains = [
  { name: "chain1-inspection-to-resolution", label: "Chain 1" },
  { name: "chain2-absence-replacement", label: "Chain 2" },
  { name: "chain3-sync-conflict", label: "Chain 3" },
  { name: "chain4-ticket-reopen", label: "Chain 4" },
  { name: "chain5-commissioning", label: "Chain 5" },
];

async function runChain(name: string) {
  const mod = await import(`./${name}.ts`);
  if (typeof mod.default === "function") {
    await mod.default();
  }
}

async function main() {
  chainHeader("Showcase: All 5 Chains", [
    "Administrator", "Dispatcher", "Technician", "QA Reviewer", "Ops Manager",
  ]);

  console.log("  Chains will run sequentially with pauses between each.\n");

  for (const chain of chains) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`  Starting ${chain.label}...`);
    console.log(`${"=".repeat(60)}\n`);
    try {
      await runChain(chain.name);
    } catch (e) {
      console.error(`  ${chain.label} failed:`, e);
      console.log("  Continuing to next chain...\n");
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("  All showcase chains complete!");
  console.log(`${"=".repeat(60)}\n`);
}

main().catch((e) => {
  console.error("Showcase runner failed:", e);
  process.exit(1);
});
