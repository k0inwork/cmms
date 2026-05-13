"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSync } from "@/lib/sync-context";
import { apiGet } from "@/lib/api-client";
import { QrCode, XCircle, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { InspectionStatus, PaginatedResponse } from "@/types";

interface InspectionItem {
  id: string;
  status: InspectionStatus;
  started_at: string | null;
  completed_at: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  technician: { id: string; first_name: string; last_name: string } | null;
  turbine: { id: string; name: string } | null;
  component: { id: string; name: string } | null;
  template_version: { version: number; template: { id: string; name: string } } | null;
  _count: { defects: number };
}

const STATUS_COLOR: Record<string, string> = {
  ASSIGNED: "bg-yellow-400",
  IN_PROGRESS: "bg-indigo-500",
  SUBMITTED: "bg-blue-500",
  APPROVED: "bg-green-500",
  REJECTED: "bg-red-500",
  CHANGES_REQUESTED: "bg-orange-500",
};

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  ASSIGNED: { label: "Assigned", bg: "border-yellow-400 bg-yellow-100", text: "text-yellow-800" },
  IN_PROGRESS: { label: "In Progress", bg: "border-indigo-300 bg-indigo-100", text: "text-indigo-800" },
  SUBMITTED: { label: "Submitted", bg: "border-blue-300 bg-blue-100", text: "text-blue-800" },
  APPROVED: { label: "Approved", bg: "border-green-300 bg-green-100", text: "text-green-800" },
  REJECTED: { label: "Rejected", bg: "border-red-300 bg-red-100", text: "text-red-800" },
  CHANGES_REQUESTED: { label: "Changes", bg: "border-orange-300 bg-orange-100", text: "text-orange-800" },
};

export function MobileHome() {
  const { user } = useAuth();
  const { status, pendingCount, failedCount, conflicts } = useSync();

  const [inspections, setInspections] = useState<InspectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const isOffline = status === "offline";
  const hasIssues = failedCount > 0 || conflicts.length > 0;

  const fetchMyInspections = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiGet<PaginatedResponse<InspectionItem>>(
        `/inspections?assigneeId=${user.id}&limit=10`,
      );
      setInspections(res.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyInspections();
  }, [fetchMyInspections]);

  const activeInspections = inspections.filter(
    (i) => i.status === "ASSIGNED" || i.status === "IN_PROGRESS" || i.status === "CHANGES_REQUESTED",
  );

  const recentCompleted = inspections.filter(
    (i) => i.status === "SUBMITTED" || i.status === "APPROVED",
  );

  return (
    <div className="pb-24 lg:hidden">
      {/* Sync Status Banner */}
      <Link href="/sync">
        <div
          className={cn(
            "mb-6 flex items-center justify-between rounded-lg px-4 py-3 shadow-sm",
            isOffline
              ? "bg-slate-200"
              : hasIssues
                ? "bg-red-100"
                : pendingCount > 0
                  ? "bg-yellow-100"
                  : "bg-green-100",
          )}
        >
          <div className="flex items-center gap-3">
            {isOffline ? (
              <AlertCircle className="h-5 w-5 text-slate-500" />
            ) : hasIssues ? (
              <XCircle className="h-5 w-5 text-red-600" />
            ) : (
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  pendingCount > 0 ? "bg-yellow-500" : "bg-green-500",
                )}
              />
            )}
            <span
              className={cn(
                "text-sm font-medium",
                isOffline
                  ? "text-slate-700"
                  : hasIssues
                    ? "text-red-800"
                    : pendingCount > 0
                      ? "text-yellow-800"
                      : "text-green-800",
              )}
            >
              {isOffline
                ? "Offline"
                : hasIssues
                  ? `${conflicts.length} conflicts, ${failedCount} failed`
                  : pendingCount > 0
                    ? `${pendingCount} pending upload`
                    : "All data synced"}
            </span>
          </div>
          <span
            className={cn(
              "text-xs",
              isOffline
                ? "text-slate-500"
                : hasIssues
                  ? "text-red-700"
                  : pendingCount > 0
                    ? "text-yellow-700"
                    : "text-green-700",
            )}
          >
            ●
          </span>
        </div>
      </Link>

      {/* Today's Inspections */}
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">
          My Inspections ({activeInspections.length})
        </h2>
        <Link href="/inspections" className="text-sm font-semibold text-brand-700">
          See all
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : activeInspections.length === 0 ? (
        <p className="mb-8 text-sm text-slate-500">No active inspections.</p>
      ) : (
        <div className="mb-8 space-y-4">
          {activeInspections.map((insp) => {
            const badge = STATUS_BADGE[insp.status] ?? STATUS_BADGE.ASSIGNED;
            const barColor = STATUS_COLOR[insp.status] ?? "bg-brand-500";
            const isOverdue =
              insp.due_date && new Date(insp.due_date) < new Date();
            return (
              <Link key={insp.id} href={`/inspections/${insp.id}`}>
                <div className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className={cn("absolute bottom-0 left-0 top-0 w-1", barColor)} />
                  <div className="mb-1 flex items-start justify-between pl-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {insp.template_version?.template.name ?? "Inspection"}
                      {insp.turbine ? ` — ${insp.turbine.name}` : ""}
                    </h3>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase",
                        badge.bg,
                        badge.text,
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p className="pl-2 text-xs text-slate-500">
                    {insp.turbine?.name ?? "No turbine"}
                    {insp.component ? ` · ${insp.component.name}` : ""}
                  </p>
                  {insp.due_date && (
                    <p
                      className={cn(
                        "mt-1 pl-2 text-xs font-semibold",
                        isOverdue ? "text-red-600" : "text-brand-600",
                      )}
                    >
                      DUE: {new Date(insp.due_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {isOverdue ? " · OVERDUE" : ""}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Quick Actions */}
      <h2 className="mb-4 text-lg font-bold text-slate-900">Quick Actions</h2>
      <div className="mb-8 grid grid-cols-2 gap-4">
        <Link
          href="/assets/scan"
          className="flex flex-col items-center justify-center rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
        >
          <div className="mb-3 rounded-xl bg-brand-50 p-3 text-brand-600">
            <QrCode className="h-6 w-6" />
          </div>
          <span className="text-xs font-semibold text-slate-900">Scan QR Code</span>
        </Link>
        <Link
          href="/dispatch/mobile"
          className="flex flex-col items-center justify-center rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
        >
          <div className="mb-3 rounded-xl bg-red-50 p-3 text-red-600">
            <XCircle className="h-6 w-6" />
          </div>
          <span className="text-xs font-semibold text-slate-900">Report Absence</span>
        </Link>
      </div>

      {/* Recent Activity */}
      <h2 className="mb-4 text-lg font-bold text-slate-900">Recent Activity</h2>
      {recentCompleted.length === 0 ? (
        <p className="text-sm text-slate-500">No recent activity.</p>
      ) : (
        <div className="space-y-3">
          {recentCompleted.slice(0, 5).map((insp) => (
            <Link key={insp.id} href={`/inspections/${insp.id}`}>
              <div className="flex items-center gap-4 rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {insp.template_version?.template.name ?? "Inspection"}
                    {insp.turbine ? ` · ${insp.turbine.name}` : ""}
                  </p>
                  <p className="text-xs text-slate-500">
                    {STATUS_BADGE[insp.status]?.label ?? insp.status} ·{" "}
                    {new Date(insp.completed_at ?? insp.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
