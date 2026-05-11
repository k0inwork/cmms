"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type {
  TechnicianListItem,
  Assignment,
  AbsenceRecord,
  TechnicianStatus,
} from "@/types";
import {
  ArrowLeft,
  Clock,
  Calendar,
} from "lucide-react";

const STATUS_OPTIONS: { value: TechnicianStatus; label: string; color: string }[] = [
  { value: "AVAILABLE", label: "Available", color: "bg-green-500" },
  { value: "ASSIGNED", label: "Assigned", color: "bg-blue-500" },
  { value: "TRAVELING", label: "Traveling", color: "bg-yellow-500" },
  { value: "ON_SITE", label: "On Site", color: "bg-indigo-500" },
  { value: "ON_BREAK", label: "On Break", color: "bg-orange-500" },
  { value: "SICK", label: "Sick", color: "bg-red-500" },
  { value: "TRAINING", label: "Training", color: "bg-purple-500" },
  { value: "LEAVE", label: "Leave", color: "bg-slate-500" },
  { value: "UNAVAILABLE", label: "Unavailable", color: "bg-gray-500" },
];

const ABSENCE_REASONS = [
  { value: "SICK", label: "Sick Leave" },
  { value: "PERSONAL_LEAVE", label: "Personal Leave" },
  { value: "TRAINING", label: "Training" },
  { value: "VACATION", label: "Vacation" },
  { value: "OTHER", label: "Other" },
] as const;

export default function TechnicianDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [technician, setTechnician] = useState<TechnicianListItem | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [absenceHistory, setAbsenceHistory] = useState<AbsenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [absenceForm, setAbsenceForm] = useState({
    reason: "SICK" as string,
    startDate: new Date().toISOString().slice(0, 16),
    expectedReturnDate: "",
    notes: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [techs, assign, abs] = await Promise.all([
        apiGet<{ data: TechnicianListItem[] }>(`/technicians?limit=100`),
        apiGet<{ data: Assignment[] }>(`/technicians/${id}/assignments`),
        apiGet<{ data: AbsenceRecord[] }>(`/technicians/${id}/absence-history`),
      ]);
      const tech = techs.data.find((t) => t.id === id);
      setTechnician(tech ?? null);
      setAssignments(assign.data);
      setAbsenceHistory(abs.data);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (status: TechnicianStatus) => {
    setUpdating(true);
    try {
      await apiPatch(`/technicians/${id}/status`, { status });
      setShowStatusPicker(false);
      loadData();
    } catch {
      // Error handled by apiClient
    } finally {
      setUpdating(false);
    }
  };

  const handleReportAbsence = async () => {
    setUpdating(true);
    try {
      await apiPost(`/technicians/${id}/absence`, {
        reason: absenceForm.reason,
        startDate: new Date(absenceForm.startDate).toISOString(),
        expectedReturnDate: absenceForm.expectedReturnDate
          ? new Date(absenceForm.expectedReturnDate).toISOString()
          : null,
        notes: absenceForm.notes || undefined,
      });
      setShowAbsenceForm(false);
      setAbsenceForm({
        reason: "SICK",
        startDate: new Date().toISOString().slice(0, 16),
        expectedReturnDate: "",
        notes: "",
      });
      loadData();
    } catch {
      // Error handled by apiClient
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      </div>
    );
  }

  if (!technician) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Technician not found.</p>
        <button
          onClick={() => router.push("/dispatch")}
          className="mt-2 text-sm text-brand-600 hover:underline"
        >
          Back to Dispatch Board
        </button>
      </div>
    );
  }

  const initials = technician.name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/dispatch")}
          className="rounded-md p-1 text-slate-400 hover:text-slate-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
          {initials}
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{technician.name}</h1>
          <p className="text-sm text-slate-500">{technician.email}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Panel */}
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase text-slate-500">Status</h2>
            <button
              onClick={() => setShowStatusPicker(!showStatusPicker)}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Change
            </button>
          </div>

          <div className="mb-3 flex items-center gap-2">
            <div
              className={cn(
                "h-3 w-3 rounded-full",
                STATUS_OPTIONS.find((s) => s.value === technician.status)?.color ??
                  "bg-slate-400",
              )}
            />
            <span className="text-lg font-semibold text-slate-900">
              {technician.status.replace("_", " ")}
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Last changed: {new Date(technician.lastStatusChange).toLocaleString()}
          </p>

          {/* Status Picker Dropdown */}
          {showStatusPicker && (
            <div className="mt-3 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  disabled={updating}
                  onClick={() => handleStatusChange(opt.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-white",
                    technician.status === opt.value && "bg-white font-semibold",
                  )}
                >
                  <div className={cn("h-2.5 w-2.5 rounded-full", opt.color)} />
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Report Absence */}
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase text-slate-500">
              Report Absence
            </h2>
            <button
              onClick={() => setShowAbsenceForm(!showAbsenceForm)}
              className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              Report
            </button>
          </div>

          {showAbsenceForm && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Reason
                </label>
                <select
                  value={absenceForm.reason}
                  onChange={(e) =>
                    setAbsenceForm((f) => ({ ...f, reason: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                >
                  {ABSENCE_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Start Date
                </label>
                <input
                  type="datetime-local"
                  value={absenceForm.startDate}
                  onChange={(e) =>
                    setAbsenceForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Expected Return (optional)
                </label>
                <input
                  type="datetime-local"
                  value={absenceForm.expectedReturnDate}
                  onChange={(e) =>
                    setAbsenceForm((f) => ({
                      ...f,
                      expectedReturnDate: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Notes (optional)
                </label>
                <textarea
                  value={absenceForm.notes}
                  onChange={(e) =>
                    setAbsenceForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={2}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <button
                onClick={handleReportAbsence}
                disabled={updating}
                className="w-full rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {updating ? "Submitting..." : "Submit Absence"}
              </button>
            </div>
          )}

          {!showAbsenceForm && (
            <p className="text-xs text-slate-500">
              {technician.activeAssignments} active assignment
              {technician.activeAssignments !== 1 ? "s" : ""} will be affected
            </p>
          )}
        </div>
      </div>

      {/* Active Assignments */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">
          Active Assignments ({assignments.length})
        </h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-slate-500">No active assignments.</p>
        ) : (
          <div className="space-y-2">
            {assignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                      a.type === "INSPECTION"
                        ? "bg-brand-100 text-brand-800"
                        : "bg-green-100 text-green-800",
                    )}
                  >
                    {a.type}
                  </span>
                  <span className="text-sm text-slate-700">
                    {a.reference?.title ?? a.reference?.id ?? a.id}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="h-3 w-3" />
                  {new Date(a.assignedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Absence History */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">
          Absence History
        </h2>
        {absenceHistory.length === 0 ? (
          <p className="text-sm text-slate-500">No absence records.</p>
        ) : (
          <div className="space-y-2">
            {absenceHistory.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {record.reason.replace("_", " ")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(record.start_date).toLocaleDateString()}
                      {record.expected_return_date &&
                        ` → ${new Date(record.expected_return_date).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    record.is_approved
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800",
                  )}
                >
                  {record.is_approved ? "Approved" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
