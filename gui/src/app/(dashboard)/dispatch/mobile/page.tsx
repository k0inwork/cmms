"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Assignment, TechnicianStatus, TechnicianListItem } from "@/types";
import {
  Radio,
  Check,
  X,
  ChevronRight,
  Bell,
} from "lucide-react";

const STATUS_OPTIONS: { value: TechnicianStatus; label: string; color: string; icon: string }[] = [
  { value: "AVAILABLE", label: "Available", color: "bg-green-500", icon: "✓" },
  { value: "TRAVELING", label: "Traveling", color: "bg-yellow-500", icon: "🚗" },
  { value: "ON_SITE", label: "On Site", color: "bg-indigo-500", icon: "📍" },
  { value: "ON_BREAK", label: "On Break", color: "bg-orange-500", icon: "☕" },
  { value: "SICK", label: "Sick", color: "bg-red-500", icon: "🤒" },
  { value: "LEAVE", label: "Leave", color: "bg-slate-500", icon: "🏖" },
];

const ABSENCE_REASONS = [
  { value: "SICK", label: "Sick" },
  { value: "PERSONAL_LEAVE", label: "Personal" },
  { value: "TRAINING", label: "Training" },
  { value: "VACATION", label: "Vacation" },
  { value: "OTHER", label: "Other" },
] as const;

export default function MobileDispatchPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [myStatus, setMyStatus] = useState<TechnicianStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showAbsence, setShowAbsence] = useState(false);
  const [absenceReason, setAbsenceReason] = useState("SICK");
  const [absenceNotes, setAbsenceNotes] = useState("");

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [assignData, techData] = await Promise.all([
        apiGet<{ data: Assignment[] }>(`/technicians/${user.id}/assignments`),
        apiGet<{ data: TechnicianListItem[] }>("/technicians?limit=100"),
      ]);
      setAssignments(assignData.data);
      const me = techData.data.find((t) => t.id === user.id);
      if (me) setMyStatus(me.status);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (status: TechnicianStatus) => {
    if (!user) return;
    setUpdating(true);
    try {
      await apiPatch(`/technicians/${user.id}/status`, { status });
      setMyStatus(status);
      setShowStatusPicker(false);
    } catch {
      // Error handled by apiClient
    } finally {
      setUpdating(false);
    }
  };

  const handleAccept = async (assignmentId: string) => {
    setUpdating(true);
    try {
      await apiPost(`/replacements/${assignmentId}/accept`, {});
      loadData();
    } catch {
      // Error handled
    } finally {
      setUpdating(false);
    }
  };

  const handleDecline = async (assignmentId: string) => {
    setUpdating(true);
    try {
      await apiPost(`/replacements/${assignmentId}/decline`, { reason: "Mobile decline" });
      loadData();
    } catch {
      // Error handled
    } finally {
      setUpdating(false);
    }
  };

  const handleReportAbsence = async () => {
    if (!user) return;
    setUpdating(true);
    try {
      await apiPost(`/technicians/${user.id}/absence`, {
        reason: absenceReason,
        startDate: new Date().toISOString(),
        notes: absenceNotes || undefined,
      });
      setShowAbsence(false);
      setAbsenceNotes("");
      loadData();
    } catch {
      // Error handled
    } finally {
      setUpdating(false);
    }
  };

  const pendingAssignments = assignments.filter((a) => !a.acceptedAt);

  return (
    <div className="pb-28 space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Radio className="h-5 w-5 text-brand-600" />
          Dispatch
        </h1>
        <p className="text-xs text-slate-500">
          Manage your assignments and availability
        </p>
      </div>

      {/* Status Picker (compact mobile) */}
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900">My Status</h2>
          <button
            onClick={() => setShowStatusPicker(!showStatusPicker)}
            className="text-xs font-medium text-brand-600"
          >
            {showStatusPicker ? "Cancel" : "Change"}
          </button>
        </div>

        {showStatusPicker ? (
          <div className="grid grid-cols-3 gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                disabled={updating}
                onClick={() => handleStatusChange(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-3 text-xs",
                  myStatus === opt.value
                    ? "border-brand-300 bg-brand-50 font-semibold"
                    : "border-slate-200 hover:bg-slate-50",
                )}
              >
                <div className={cn("h-3 w-3 rounded-full", opt.color)} />
                {opt.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-3 w-3 rounded-full",
                STATUS_OPTIONS.find((s) => s.value === myStatus)?.color ??
                  "bg-slate-400",
              )}
            />
            <span className="text-sm font-medium text-slate-900">
              {(myStatus ?? "UNKNOWN").replace("_", " ")}
            </span>
          </div>
        )}
      </div>

      {/* Pending Assignments (notifications) */}
      {pendingAssignments.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Bell className="h-4 w-4 text-brand-600" />
            New Assignments ({pendingAssignments.length})
          </h2>
          <div className="space-y-3">
            {pendingAssignments.map((a) => (
              <div
                key={a.id}
                className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-brand-200"
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <span
                      className={cn(
                        "mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                        a.type === "INSPECTION"
                          ? "bg-brand-100 text-brand-800"
                          : "bg-green-100 text-green-800",
                      )}
                    >
                      {a.type}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {a.reference?.title ?? "Assignment"}
                    </span>
                  </div>
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  Assigned {new Date(a.assignedAt).toLocaleString()}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(a.id)}
                    disabled={updating}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    Accept
                  </button>
                  <button
                    onClick={() => handleDecline(a.id)}
                    disabled={updating}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Assignments */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          My Assignments ({assignments.length})
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
          </div>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-slate-500">No assignments.</p>
        ) : (
          <div className="space-y-2">
            {assignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full",
                      a.acceptedAt ? "bg-green-500" : "bg-yellow-500",
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {a.reference?.title ?? a.id}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {a.type} &middot; {new Date(a.assignedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report Absence */}
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-900">Report Absence</h2>
          <button
            onClick={() => setShowAbsence(!showAbsence)}
            className="text-xs font-medium text-red-600"
          >
            {showAbsence ? "Cancel" : "Report"}
          </button>
        </div>

        {showAbsence && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {ABSENCE_REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setAbsenceReason(r.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-xs font-medium",
                    absenceReason === r.value
                      ? "border-brand-300 bg-brand-50 text-brand-800"
                      : "border-slate-200 text-slate-700",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              value={absenceNotes}
              onChange={(e) => setAbsenceNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              onClick={handleReportAbsence}
              disabled={updating}
              className="w-full rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {updating ? "Submitting..." : "Submit Absence"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
