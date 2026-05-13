"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { apiGet, apiPut, apiPost } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { InspectionStatus } from "@/types";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Play,
  Send,
  Loader2,
  Paperclip,
  X,
  AlertTriangle,
  ChevronRight,
  ClipboardCheck,
} from "lucide-react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
function resolveUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  InspectionStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  ASSIGNED: { label: "Assigned", bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-400" },
  IN_PROGRESS: { label: "In Progress", bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-400" },
  SUBMITTED: { label: "Submitted", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-400" },
  APPROVED: { label: "Approved", bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  REJECTED: { label: "Rejected", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-400" },
  CHANGES_REQUESTED: { label: "Changes Requested", bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-400" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldData {
  id: string;
  field_key: string;
  field_type: string;
  value_string: string | null;
  value_numeric: number | null;
  value_boolean: boolean | null;
  value_json: unknown;
}

interface Defect {
  id: string;
  severity: string;
  description: string;
}

interface EvidenceItem {
  id: string;
  media_type: string;
  thumbnail_url: string | null;
}

interface InspectionDetail {
  id: string;
  status: InspectionStatus;
  started_at: string | null;
  completed_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  technician: { id: string; first_name: string; last_name: string } | null;
  reviewer: { id: string; first_name: string; last_name: string } | null;
  turbine: { id: string; name: string } | null;
  component: { id: string; name: string } | null;
  template_version: { version: number; template: { id: string; name: string } } | null;
  field_data: FieldData[];
  defects: Defect[];
  evidence: EvidenceItem[];
}

// ─── State flow ───────────────────────────────────────────────────────────────

function StateFlow({ current }: { current: InspectionStatus }) {
  const flow: InspectionStatus[] = ["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "APPROVED"];
  const currentIdx = flow.indexOf(current);
  const isChanges = current === "CHANGES_REQUESTED";
  const isRejected = current === "REJECTED";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        State Machine
      </h3>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {isRejected && (
          <>
            <div className="flex items-center gap-1 text-xs text-red-500">
              <XCircle className="h-3 w-3" />
              <span>Rejected</span>
            </div>
            <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />
          </>
        )}
        {isChanges && (
          <>
            <div className="flex items-center gap-1 text-xs text-orange-500">
              <RotateCcw className="h-3 w-3" />
              <span>Changes Requested</span>
            </div>
            <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />
          </>
        )}
        {flow.map((status, idx) => {
          const sc = STATUS_CONFIG[status];
          const completed = isChanges || isRejected
            ? idx < flow.indexOf("SUBMITTED")
            : idx < currentIdx;
          const active = isChanges
            ? status === "IN_PROGRESS"
            : isRejected
              ? false
              : status === current;
          const future = isChanges
            ? idx > flow.indexOf("IN_PROGRESS")
            : isRejected
              ? true
              : idx > currentIdx;

          return (
            <div key={status} className="flex items-center gap-1">
              {idx > 0 && (
                <ChevronRight
                  className={cn("h-3 w-3 shrink-0", completed || active ? "text-slate-400" : "text-slate-200")}
                />
              )}
              <div
                className={cn(
                  "flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-medium",
                  completed && "bg-slate-100 text-slate-400",
                  active && cn(sc.bg, sc.text, "ring-1 ring-current/20"),
                  future && "bg-slate-50 text-slate-300",
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", completed ? "bg-green-400" : active ? sc.dot : "bg-slate-200")} />
                {sc.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Field data display ──────────────────────────────────────────────────────

function FieldDataRow({ field }: { field: FieldData }) {
  const value = () => {
    if (field.value_string !== null) return field.value_string;
    if (field.value_numeric !== null) return String(field.value_numeric);
    if (field.value_boolean !== null) return field.value_boolean ? "Pass" : "Fail";
    if (field.value_json !== null) return JSON.stringify(field.value_json);
    return "—";
  };

  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
      <span className="text-sm text-slate-600">{field.field_key}</span>
      <span className={cn(
        "text-sm font-medium",
        field.field_type === "PASS_FAIL"
          ? field.value_boolean ? "text-green-700" : "text-red-700"
          : "text-slate-900",
      )}>
        {value()}
      </span>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function InspectionDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const id = params.id as string;

  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectAction, setRejectAction] = useState<"REJECT" | "REQUEST_CHANGES">("REQUEST_CHANGES");

  const fetchInspection = useCallback(async () => {
    try {
      const data = await apiGet<InspectionDetail>(`/inspections/${id}`);
      setInspection(data);
    } catch {
      setError("Inspection not found");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInspection();
  }, [fetchInspection]);

  const handleStart = async () => {
    setActionLoading("start");
    setError("");
    try {
      const updated = await apiPut<InspectionDetail>(`/inspections/${id}`, { status: "IN_PROGRESS" });
      setInspection(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start inspection");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmit = async () => {
    setActionLoading("submit");
    setError("");
    try {
      const updated = await apiPost<InspectionDetail>(`/inspections/${id}/submit`, {});
      setInspection(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async () => {
    setActionLoading("approve");
    setError("");
    try {
      const updated = await apiPost<InspectionDetail>(`/inspections/${id}/approve`, {
        notes: reviewNotes || undefined,
      });
      setInspection(updated);
      setShowApproveDialog(false);
      setReviewNotes("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    setActionLoading("reject");
    setError("");
    try {
      const updated = await apiPost<InspectionDetail>(`/inspections/${id}/reject`, {
        action: rejectAction,
        notes: reviewNotes || undefined,
      });
      setInspection(updated);
      setShowRejectDialog(false);
      setReviewNotes("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-slate-500">{error || "Inspection not found"}</p>
        <Link href="/inspections" className="mt-2 inline-flex items-center gap-1 text-sm text-brand-600">
          <ArrowLeft className="h-4 w-4" /> Back to inspections
        </Link>
      </div>
    );
  }

  const sc = STATUS_CONFIG[inspection.status];
  const isEditable = ["ASSIGNED", "IN_PROGRESS", "CHANGES_REQUESTED"].includes(inspection.status);
  const isQA = user?.role === "QA_REVIEWER" || user?.role === "ADMINISTRATOR";
  const isTech = user?.role === "TECHNICIAN";
  const canStart = inspection.status === "ASSIGNED" && (isTech || user?.role === "ADMINISTRATOR" || user?.role === "DISPATCHER");
  const canSubmit = (inspection.status === "IN_PROGRESS" || inspection.status === "CHANGES_REQUESTED") && (isTech || user?.role === "ADMINISTRATOR" || user?.role === "DISPATCHER");
  const canReview = inspection.status === "SUBMITTED" && isQA;

  return (
    <div>
      {/* Back */}
      <Link href="/inspections" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to inspections
      </Link>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Title + Status */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-6 w-6 text-brand-600" />
            <h1 className="text-2xl font-semibold text-slate-900">
              {inspection.template_version?.template.name ?? "Inspection"}
            </h1>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", sc.bg, sc.text)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
              {sc.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">{id} · v{inspection.template_version?.version ?? "?"}</p>
        </div>
      </div>

      {/* State flow */}
      <div className="mb-6">
        <StateFlow current={inspection.status} />
      </div>

      {/* Action buttons */}
      <div className="mb-6 flex flex-wrap gap-2">
        {canStart && (
          <button
            onClick={handleStart}
            disabled={actionLoading === "start"}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
          >
            {actionLoading === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Start Inspection
          </button>
        )}
        {canSubmit && (
          <button
            onClick={handleSubmit}
            disabled={actionLoading === "submit"}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60"
          >
            {actionLoading === "submit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit for Review
          </button>
        )}
        {canReview && (
          <>
            <button
              onClick={() => { setShowApproveDialog(true); setReviewNotes(""); }}
              className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve
            </button>
            <button
              onClick={() => { setShowRejectDialog(true); setReviewNotes(""); setRejectAction("REQUEST_CHANGES"); }}
              className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100"
            >
              <RotateCcw className="h-4 w-4" />
              Request Changes
            </button>
            <button
              onClick={() => { setShowRejectDialog(true); setReviewNotes(""); setRejectAction("REJECT"); }}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </button>
          </>
        )}
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Field Data */}
          {(inspection.field_data?.length ?? 0) > 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Inspection Data</h3>
              <div className="divide-y divide-slate-100">
                {inspection.field_data?.map((fd) => (
                  <FieldDataRow key={fd.id} field={fd} />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Inspection Data</h3>
              <p className="text-sm text-slate-400">
                {isEditable ? "No data recorded yet. Start the inspection to begin filling in fields." : "No field data recorded."}
              </p>
            </div>
          )}

          {/* Review notes */}
          {inspection.review_notes && (
            <div className={cn(
              "rounded-lg border p-5",
              inspection.status === "APPROVED" ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50",
            )}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                {inspection.status === "APPROVED" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-orange-600" />}
                Review Notes
              </h3>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{inspection.review_notes}</p>
            </div>
          )}

          {/* Defects */}
          {(inspection.defects?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                Defects ({inspection.defects!.length})
              </h3>
              <div className="space-y-2">
                {inspection.defects.map((d) => (
                  <div key={d.id} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3">
                    <span className={cn(
                      "mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                      d.severity === "CRITICAL" ? "bg-red-100 text-red-700" :
                      d.severity === "HIGH" ? "bg-orange-100 text-orange-700" :
                      d.severity === "MEDIUM" ? "bg-yellow-100 text-yellow-700" :
                      "bg-slate-100 text-slate-600",
                    )}>
                      {d.severity}
                    </span>
                    <p className="text-sm text-slate-700">{d.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence */}
          {(inspection.evidence?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Paperclip className="h-4 w-4" />
                Evidence ({inspection.evidence!.length})
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {inspection.evidence.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex aspect-square items-center justify-center rounded-lg border border-slate-200 bg-slate-50"
                  >
                    {ev.thumbnail_url ? (
                      <img src={resolveUrl(ev.thumbnail_url)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs text-slate-400">{ev.media_type}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Metadata sidebar */}
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Details</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-xs text-slate-500">Technician</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-slate-900">
                  {inspection.technician ? (
                    <><User className="h-3.5 w-3.5 text-slate-400" />{inspection.technician.first_name} {inspection.technician.last_name}</>
                  ) : (
                    <span className="text-slate-400">Unassigned</span>
                  )}
                </dd>
              </div>

              {inspection.reviewer && (
                <div>
                  <dt className="text-xs text-slate-500">Reviewed by</dt>
                  <dd className="mt-0.5 text-sm text-slate-700">
                    {inspection.reviewer.first_name} {inspection.reviewer.last_name}
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-xs text-slate-500">Turbine</dt>
                <dd className="mt-0.5 text-sm text-slate-700">{inspection.turbine?.name ?? "—"}</dd>
              </div>

              {inspection.component && (
                <div>
                  <dt className="text-xs text-slate-500">Component</dt>
                  <dd className="mt-0.5 text-sm text-slate-700">{inspection.component.name}</dd>
                </div>
              )}

              {inspection.due_date && (
                <div>
                  <dt className="text-xs text-slate-500">Due Date</dt>
                  <dd className={cn(
                    "mt-0.5 flex items-center gap-1 text-sm",
                    new Date(inspection.due_date) < new Date() && inspection.status !== "APPROVED"
                      ? "font-medium text-red-600"
                      : "text-slate-700",
                  )}>
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {new Date(inspection.due_date).toLocaleDateString()}
                    {new Date(inspection.due_date) < new Date() && inspection.status !== "APPROVED" && " · OVERDUE"}
                  </dd>
                </div>
              )}

              <div className="border-t border-slate-100 pt-3">
                <dt className="text-xs text-slate-400">Created</dt>
                <dd className="mt-0.5 text-xs text-slate-500">{new Date(inspection.created_at).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Updated</dt>
                <dd className="mt-0.5 text-xs text-slate-500">{new Date(inspection.updated_at).toLocaleString()}</dd>
              </div>
              {inspection.started_at && (
                <div>
                  <dt className="text-xs text-slate-400">Started</dt>
                  <dd className="mt-0.5 text-xs text-slate-500">{new Date(inspection.started_at).toLocaleString()}</dd>
                </div>
              )}
              {inspection.completed_at && (
                <div>
                  <dt className="text-xs text-slate-400">Completed</dt>
                  <dd className="mt-0.5 text-xs text-slate-500">{new Date(inspection.completed_at).toLocaleString()}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* ─── Approve Dialog ────────────────────────────────────────────────── */}
      {showApproveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Approve Inspection</h2>
              <button onClick={() => setShowApproveDialog(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes (optional)</label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="Optional approval notes"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowApproveDialog(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button
                onClick={handleApprove}
                disabled={actionLoading === "approve"}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                {actionLoading === "approve" && <Loader2 className="h-4 w-4 animate-spin" />}
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Reject Dialog ─────────────────────────────────────────────────── */}
      {showRejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {rejectAction === "REJECT" ? "Reject Inspection" : "Request Changes"}
              </h2>
              <button onClick={() => setShowRejectDialog(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="mb-3 flex gap-2">
              <button
                onClick={() => setRejectAction("REQUEST_CHANGES")}
                className={cn("rounded-lg border px-3 py-1.5 text-sm font-medium", rejectAction === "REQUEST_CHANGES" ? "border-orange-300 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600")}
              >
                Request Changes
              </button>
              <button
                onClick={() => setRejectAction("REJECT")}
                className={cn("rounded-lg border px-3 py-1.5 text-sm font-medium", rejectAction === "REJECT" ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 text-slate-600")}
              >
                Reject
              </button>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder={rejectAction === "REJECT" ? "Reason for rejection" : "Describe what needs to change"}
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowRejectDialog(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button
                onClick={handleReject}
                disabled={actionLoading === "reject"}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60",
                  rejectAction === "REJECT" ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700",
                )}
              >
                {actionLoading === "reject" && <Loader2 className="h-4 w-4 animate-spin" />}
                {rejectAction === "REJECT" ? "Reject" : "Request Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
