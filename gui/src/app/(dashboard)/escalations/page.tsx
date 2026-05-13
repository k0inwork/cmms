"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { SlaRiskResponse, SlaRiskItem } from "@/types";
import {
  AlertTriangle,
  RefreshCw,
  Loader2,
  ShieldAlert,
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

function formatRemaining(ms: number): string {
  if (ms < 0) {
    const hours = Math.floor(Math.abs(ms) / 3_600_000);
    return `${hours}h overdue`;
  }
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `${hours}h ${minutes}m`;
}

const RISK_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  CRITICAL: { bg: "bg-red-50", border: "border-red-300", icon: "text-red-600" },
  HIGH: { bg: "bg-orange-50", border: "border-orange-300", icon: "text-orange-600" },
  MEDIUM: { bg: "bg-yellow-50", border: "border-yellow-300", icon: "text-yellow-600" },
};

export default function EscalationsPage() {
  const { user } = useAuth();
  const [slaRisk, setSlaRisk] = useState<SlaRiskResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const canView =
    user?.role === "DISPATCHER" ||
    user?.role === "ADMINISTRATOR" ||
    user?.role === "OPERATIONS_MANAGER";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const risk = await apiGet<SlaRiskResponse>("/dispatch/sla-risk");
      setSlaRisk(risk);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) loadData();
  }, [canView, loadData]);

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <ShieldAlert className="h-12 w-12 text-slate-300" />
        <p className="mt-4 text-lg font-medium text-slate-500">Dispatcher or Manager access required</p>
      </div>
    );
  }

  const criticalItems = slaRisk?.atRisk.filter((r) => r.riskLevel === "CRITICAL") ?? [];
  const highItems = slaRisk?.atRisk.filter((r) => r.riskLevel === "HIGH") ?? [];
  const mediumItems = slaRisk?.atRisk.filter((r) => r.riskLevel === "MEDIUM") ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            Escalations
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            SLA breaches and items requiring immediate attention
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : !slaRisk || slaRisk.atRisk.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <CheckCircle className="h-12 w-12 mb-3 text-green-400" />
          <p className="text-sm font-medium text-green-700">No escalations — all clear</p>
          <p className="text-xs text-slate-400 mt-1">All SLA targets are on track</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="text-sm font-medium text-red-800">Critical</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-red-900">{criticalItems.length}</p>
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">High Risk</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-orange-900">{highItems.length}</p>
            </div>
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">Medium</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-yellow-900">{mediumItems.length}</p>
            </div>
          </div>

          {/* Critical section */}
          {criticalItems.length > 0 && (
            <EscalationSection title="Critical — Immediate Action Required" items={criticalItems} defaultExpanded />
          )}
          {highItems.length > 0 && (
            <EscalationSection title="High Risk" items={highItems} />
          )}
          {mediumItems.length > 0 && (
            <EscalationSection title="Medium Risk" items={mediumItems} />
          )}
        </>
      )}
    </div>
  );
}

function CheckCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function EscalationSection({
  title,
  items,
  defaultExpanded = false,
}: {
  title: string;
  items: SlaRiskItem[];
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm hover:bg-slate-50"
      >
        <h2 className="text-sm font-semibold text-slate-900">{title} ({items.length})</h2>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {items.map((item) => {
            const style = RISK_STYLES[item.riskLevel] ?? RISK_STYLES.MEDIUM;
            return (
              <div
                key={`${item.type}-${item.id}`}
                className={cn("flex items-center justify-between rounded-lg border p-4", style.bg, style.border)}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                      {item.type.replace("_", " ")}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">{item.title}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-600">
                    <span>{item.assigneeName ?? "Unassigned"}</span>
                    {item.slaTarget && (
                      <span>SLA: {new Date(item.slaTarget).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("text-sm font-bold", style.icon)}>
                    {formatRemaining(item.slaRemainingMs)}
                  </span>
                  <Link
                    href={item.type === "TICKET" ? `/tickets/${item.id}` : item.type === "WORK_ORDER" ? `/work-orders/${item.id}` : `/inspections/${item.id}`}
                    className="flex items-center gap-1 rounded-md bg-white/70 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                  >
                    <ExternalLink className="h-3 w-3" /> Open
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
