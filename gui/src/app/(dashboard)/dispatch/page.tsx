"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type {
  TechnicianListItem,
  SlaRiskResponse,
  SlaRiskItem,
  ReplacementSuggestionsResponse,
} from "@/types";
import {
  Radio,
  AlertTriangle,
  Users,
  Clock,
  X,
  UserCheck,
  ShieldAlert,
  GripVertical,
} from "lucide-react";

// ─── Status badge ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-800 border-green-300",
  ASSIGNED: "bg-blue-100 text-blue-800 border-blue-300",
  TRAVELING: "bg-yellow-100 text-yellow-800 border-yellow-300",
  ON_SITE: "bg-indigo-100 text-indigo-800 border-indigo-300",
  ON_BREAK: "bg-orange-100 text-orange-800 border-orange-300",
  SICK: "bg-red-100 text-red-800 border-red-300",
  TRAINING: "bg-purple-100 text-purple-800 border-purple-300",
  LEAVE: "bg-slate-100 text-slate-800 border-slate-300",
  UNAVAILABLE: "bg-gray-100 text-gray-800 border-gray-300",
};

const RISK_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-50 border-red-300 text-red-900",
  HIGH: "bg-orange-50 border-orange-300 text-orange-900",
  MEDIUM: "bg-yellow-50 border-yellow-300 text-yellow-900",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        STATUS_COLORS[status] ?? "bg-slate-100 text-slate-800 border-slate-300",
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

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

// ─── Main page ───────────────────────────────────────────────────────────────

export default function DispatchPage() {
  const { user } = useAuth();
  const [technicians, setTechnicians] = useState<TechnicianListItem[]>([]);
  const [slaRisk, setSlaRisk] = useState<SlaRiskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignModal, setAssignModal] = useState<{
    item: SlaRiskItem;
    technicians: TechnicianListItem[];
  } | null>(null);
  const [replacements, setReplacements] = useState<{
    technicianId: string;
    data: ReplacementSuggestionsResponse;
  } | null>(null);
  const [assigning, setAssigning] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [techs, risk] = await Promise.all([
        apiGet<{ data: TechnicianListItem[] }>("/technicians?limit=50"),
        apiGet<SlaRiskResponse>("/dispatch/sla-risk"),
      ]);
      setTechnicians(techs.data);
      setSlaRisk(risk);
    } catch {
      // Silently fail — data will show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAssign = async (technicianId: string) => {
    if (!assignModal) return;
    setAssigning(true);
    try {
      await apiPost("/dispatch/assign", {
        assignmentType: assignModal.item.type,
        assignmentId: assignModal.item.id,
        technicianId,
      });
      setAssignModal(null);
      loadData();
    } catch {
      // Error handled by apiClient redirect
    } finally {
      setAssigning(false);
    }
  };

  const handleViewReplacements = async (technicianId: string) => {
    try {
      const data = await apiGet<ReplacementSuggestionsResponse>(
        `/technicians/${technicianId}/replacement-suggestions`,
      );
      setReplacements({ technicianId, data });
    } catch {
      // Silently fail
    }
  };

  const isDispatcher =
    user?.role === "DISPATCHER" ||
    user?.role === "ADMINISTRATOR" ||
    user?.role === "OPERATIONS_MANAGER";

  if (!isDispatcher) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dispatch Board</h1>
        <p className="mt-2 text-sm text-slate-500">
          You do not have access to the dispatch board.
        </p>
      </div>
    );
  }

  const availableTechs = technicians.filter(
    (t) => !["SICK", "LEAVE", "UNAVAILABLE"].includes(t.status),
  );
  const absentTechs = technicians.filter((t) =>
    ["SICK", "LEAVE", "UNAVAILABLE"].includes(t.status),
  );

  const criticalCount = slaRisk?.atRisk.filter((r) => r.riskLevel === "CRITICAL").length ?? 0;
  const highCount = slaRisk?.atRisk.filter((r) => r.riskLevel === "HIGH").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Radio className="h-6 w-6 text-brand-600" />
            Dispatch Board
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage technician assignments and availability
          </p>
        </div>
        <button
          onClick={loadData}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
          <span className="ml-3 text-sm">Loading dispatch data...</span>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              icon={<Users className="h-5 w-5 text-green-600" />}
              label="Available"
              value={availableTechs.length}
              bg="bg-green-50"
            />
            <SummaryCard
              icon={<Clock className="h-5 w-5 text-yellow-600" />}
              label="On Break / Traveling"
              value={
                technicians.filter((t) => ["ON_BREAK", "TRAVELING"].includes(t.status)).length
              }
              bg="bg-yellow-50"
            />
            <SummaryCard
              icon={<ShieldAlert className="h-5 w-5 text-red-600" />}
              label="SLA Critical"
              value={criticalCount}
              bg="bg-red-50"
            />
            <SummaryCard
              icon={<AlertTriangle className="h-5 w-5 text-orange-600" />}
              label="SLA At Risk"
              value={highCount}
              bg="bg-orange-50"
            />
          </div>

          {/* SLA Risk Panel */}
          {slaRisk && slaRisk.atRisk.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-slate-900">SLA Risk Items</h2>
              <div className="space-y-2">
                {slaRisk.atRisk.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3",
                      RISK_STYLES[item.riskLevel],
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 cursor-grab text-current opacity-40" />
                      <div>
                        <p className="text-sm font-semibold">
                          <span className="mr-2 rounded bg-white/60 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                            {item.type.replace("_", " ")}
                          </span>
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-xs opacity-75">
                          {item.assigneeName ?? "Unassigned"} &middot; SLA target:{" "}
                          {item.slaTarget
                            ? new Date(item.slaTarget).toLocaleString()
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold">{formatRemaining(item.slaRemainingMs)}</span>
                      {!item.assigneeId && (
                        <button
                          onClick={() => setAssignModal({ item, technicians: availableTechs })}
                          className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700"
                        >
                          Assign
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coverage map / technician grid */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Technician Coverage</h2>

            {availableTechs.length === 0 && absentTechs.length === 0 ? (
              <p className="text-sm text-slate-500">No technicians found.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {availableTechs.map((tech) => (
                  <div
                    key={tech.id}
                    className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                          {tech.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{tech.name}</p>
                          <p className="text-[10px] text-slate-500">{tech.email}</p>
                        </div>
                      </div>
                      <StatusBadge status={tech.status} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span>{tech.activeAssignments} active</span>
                      {tech.skills.length > 0 && (
                        <>
                          <span>&middot;</span>
                          <span>{tech.skills.map((s) => s.name).join(", ")}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Absent technicians */}
          {absentTechs.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-slate-900">
                Absent / Unavailable
              </h2>
              <div className="space-y-2">
                {absentTechs.map((tech) => (
                  <div
                    key={tech.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500">
                        {tech.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{tech.name}</p>
                        <p className="text-xs text-slate-500">
                          {tech.activeAssignments} affected assignments
                        </p>
                      </div>
                      <StatusBadge status={tech.status} />
                    </div>
                    {tech.activeAssignments > 0 && (
                      <button
                        onClick={() => handleViewReplacements(tech.id)}
                        className="flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        Find Replacements
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Assign modal */}
      {assignModal && (
        <AssignModal
          item={assignModal.item}
          technicians={assignModal.technicians}
          assigning={assigning}
          onAssign={handleAssign}
          onClose={() => setAssignModal(null)}
        />
      )}

      {/* Replacements panel */}
      {replacements && (
        <ReplacementsPanel
          data={replacements.data}
          onClose={() => setReplacements(null)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
}) {
  return (
    <div className={cn("rounded-lg border border-slate-200 p-4", bg)}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function AssignModal({
  item,
  technicians,
  assigning,
  onAssign,
  onClose,
}: {
  item: SlaRiskItem;
  technicians: TechnicianListItem[];
  assigning: boolean;
  onAssign: (techId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Assign Technician</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-1 text-sm font-medium text-slate-900">{item.title}</p>
        <p className="mb-4 text-xs text-slate-500">
          {item.type} &middot; SLA in {formatRemaining(item.slaRemainingMs)}
        </p>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {technicians.length === 0 ? (
            <p className="text-sm text-slate-500">No available technicians.</p>
          ) : (
            technicians.map((tech) => (
              <button
                key={tech.id}
                disabled={assigning}
                onClick={() => onAssign(tech.id)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50 disabled:opacity-50"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{tech.name}</p>
                  <p className="text-xs text-slate-500">
                    {tech.activeAssignments} active &middot;{" "}
                    {tech.skills.slice(0, 3).map((s) => s.name).join(", ")}
                  </p>
                </div>
                <StatusBadge status={tech.status} />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ReplacementsPanel({
  data,
  onClose,
}: {
  data: ReplacementSuggestionsResponse;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Replacement Suggestions</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {data.affectedAssignments.length > 0 && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
              Affected Assignments ({data.affectedAssignments.length})
            </p>
            {data.affectedAssignments.map((a) => (
              <div key={a.id} className="text-sm text-slate-700">
                <span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold">
                  {a.type}
                </span>
                {a.title ?? a.id}
              </div>
            ))}
          </div>
        )}

        {data.candidates.length === 0 ? (
          <p className="text-sm text-slate-500">No replacement candidates found.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Candidates (sorted by score)
            </p>
            {data.candidates.map((c) => (
              <div
                key={c.technicianId}
                className={cn(
                  "rounded-lg border p-3",
                  c.isAboveThreshold
                    ? "border-green-200 bg-green-50"
                    : "border-slate-200 bg-white",
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-500">
                      {c.currentAssignments} active &middot; Score: {c.totalScore.toFixed(0)}%
                      {c.isAboveThreshold && (
                        <span className="ml-1 text-green-700">above threshold</span>
                      )}
                    </p>
                  </div>
                  <StatusBadge status={c.currentStatus} />
                </div>
                <div className="mt-2 grid grid-cols-5 gap-1">
                  {Object.entries(c.scoreBreakdown).map(([key, val]) => (
                    <div key={key} className="text-center">
                      <div className="h-1.5 rounded-full bg-slate-200">
                        <div
                          className="h-1.5 rounded-full bg-brand-500"
                          style={{ width: `${Math.min(100, val)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-500">{key.slice(0, 4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {data.escalationRequired && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            No candidates above threshold — escalation required.
          </div>
        )}
      </div>
    </div>
  );
}
