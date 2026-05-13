"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Play, Square, RotateCcw } from "lucide-react";

interface ShowcaseChain {
  id: string;
  name: string;
  script: string;
  running: boolean;
}

const CHAIN_DESCRIPTIONS: Record<string, { desc: string; roles: string[]; steps: number }> = {
  chain1: { desc: "Dispatcher assigns → Tech inspects → QA flags → Re-inspect → Approve → Ticket → Resolve → Close", roles: ["Dispatcher", "Technician", "QA Reviewer"], steps: 17 },
  chain2: { desc: "Tech self-reports sick → Dispatcher sees SLA risk → Reassigns → Replacement completes → QA approves", roles: ["Technician", "Dispatcher", "QA Reviewer"], steps: 10 },
  chain3: { desc: "Two techs inspect same component → Sync conflict → QA merges → Ticket created", roles: ["Technician", "QA Reviewer"], steps: 12 },
  chain4: { desc: "QA rejects → Re-inspect → Approve → Ticket → Close → Reopen → Escalate → Final resolution", roles: ["QA Reviewer", "Technician", "Dispatcher"], steps: 15 },
  chain5: { desc: "Admin creates org/site/turbine → Templates → Assigns → Inspects → Defects → Tickets → Reports", roles: ["Administrator", "Technician", "QA Reviewer", "Ops Manager"], steps: 16 },
  all: { desc: "Runs all 5 showcase chains sequentially for a full platform demo", roles: ["All Roles"], steps: 70 },
};

export function ShowcaseTab() {
  const [chains, setChains] = useState<ShowcaseChain[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchChains = useCallback(async () => {
    try {
      const data = await apiGet<{ data: ShowcaseChain[] }>("/showcase");
      setChains(data.data);
    } catch {
      setError("Failed to load showcase chains");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChains();
    const interval = setInterval(fetchChains, 3000);
    return () => clearInterval(interval);
  }, [fetchChains]);

  const runChain = async (chainId: string) => {
    setSpinning(chainId);
    setError(null);
    try {
      await apiPost("/showcase/run/" + chainId, {});
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to start chain";
      setError(msg);
    } finally {
      setSpinning(null);
      setTimeout(fetchChains, 1000);
    }
  };

  const stopChain = async (chainId: string) => {
    setSpinning(chainId);
    try {
      await apiPost("/showcase/stop/" + chainId, {});
    } catch {
      setError("Failed to stop chain");
    } finally {
      setSpinning(null);
      setTimeout(fetchChains, 500);
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-sm text-slate-500">Loading showcase chains...</div>;
  }

  if (error && chains.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={fetchChains} className="mt-2 text-sm text-brand-600 hover:underline">
          <RotateCcw className="mr-1 inline h-3 w-3" />Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {chains.map((chain) => {
          const meta = CHAIN_DESCRIPTIONS[chain.id];
          const isActive = chain.running || spinning === chain.id;
          return (
            <div
              key={chain.id}
              className={cn(
                "rounded-lg border p-4 transition-shadow",
                isActive ? "border-brand-300 shadow-md ring-1 ring-brand-200" : "border-slate-200",
              )}
            >
              <div className="flex items-start justify-between">
                <h3 className="text-sm font-semibold text-slate-900">{chain.name}</h3>
                {chain.running && (
                  <span className="flex items-center gap-1 text-xs text-brand-600">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-500" />
                    Running
                  </span>
                )}
              </div>

              {meta && (
                <>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">{meta.desc}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {meta.roles.map((role) => (
                      <span key={role} className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {role}
                      </span>
                    ))}
                    <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {meta.steps} steps
                    </span>
                  </div>
                </>
              )}

              <div className="mt-4 flex gap-2">
                {!chain.running ? (
                  <button
                    onClick={() => runChain(chain.id)}
                    disabled={spinning !== null}
                    className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    <Play className="h-3 w-3" />
                    {spinning === chain.id ? "Starting..." : "Run"}
                  </button>
                ) : (
                  <button
                    onClick={() => stopChain(chain.id)}
                    className="flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    <Square className="h-3 w-3" />
                    Stop
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Scripts run via <code className="rounded bg-slate-100 px-1">npx tsx scripts/showcase/</code> on the API server. Requires API server running on port 3000 and GUI on port 3001.
      </p>
    </div>
  );
}
