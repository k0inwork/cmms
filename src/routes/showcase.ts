import { Hono } from "hono";
import { spawn, type ChildProcess } from "child_process";
import { authMiddleware, requireRoles, AuthEnv } from "../middleware/auth.js";

const app = new Hono<AuthEnv>();

app.use("*", authMiddleware());
app.use("*", requireRoles("ADMINISTRATOR"));

// Track running processes
const running = new Map<string, ChildProcess>();

const CHAINS = [
  { id: "chain1", name: "Inspection to Resolution", script: "chain1-inspection-to-resolution.ts" },
  { id: "chain2", name: "Absence & Replacement", script: "chain2-absence-replacement.ts" },
  { id: "chain3", name: "Sync Conflict Resolution", script: "chain3-sync-conflict.ts" },
  { id: "chain4", name: "Ticket Reopen Cycle", script: "chain4-ticket-reopen.ts" },
  { id: "chain5", name: "Turbine Commissioning", script: "chain5-commissioning.ts" },
  { id: "all", name: "Run All Chains", script: "run-all.ts" },
];

// List available chains + status
app.get("/", (c) => {
  const chains = CHAINS.map((ch) => ({
    ...ch,
    running: running.has(ch.id),
  }));
  return c.json({ data: chains });
});

// Run a specific chain
app.post("/run/:chainId", async (c) => {
  const { chainId } = c.req.param();
  const chain = CHAINS.find((ch) => ch.id === chainId);
  if (!chain) return c.json({ error: "Chain not found" }, 404);

  if (running.has(chainId)) {
    return c.json({ error: "Chain already running" }, 409);
  }

  const env = {
    ...process.env,
    SHOWCASE_SPEED: "fast",
    PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "showcase script auto-consent for dev db reset",
  };

  const proc = spawn("npx", ["tsx", `scripts/showcase/${chain.script}`], {
    cwd: process.cwd(),
    env,
    stdio: "pipe",
    detached: false,
  });

  running.set(chainId, proc);

  proc.stdout?.on("data", (d: Buffer) => console.log(`[showcase:${chainId}]`, d.toString().trimEnd()));
  proc.stderr?.on("data", (d: Buffer) => console.error(`[showcase:${chainId}]`, d.toString().trimEnd()));

  proc.on("close", (code) => {
    console.log(`[showcase:${chainId}] exited with code ${code}`);
    running.delete(chainId);
  });

  proc.on("error", (err) => {
    console.error(`[showcase:${chainId}] spawn error:`, err.message);
    running.delete(chainId);
  });

  return c.json({ message: `Started ${chain.name}`, chainId });
});

// Stop a running chain
app.post("/stop/:chainId", (c) => {
  const { chainId } = c.req.param();
  const proc = running.get(chainId);
  if (!proc) return c.json({ error: "Chain not running" }, 404);

  proc.kill("SIGTERM");
  running.delete(chainId);
  return c.json({ message: "Stopped" });
});

export default app;
