"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { TicketDetail, TicketStatus, TicketAuditEvent } from "@/types";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  ChevronRight,
  Play,
  Eye,
  Send,
  Loader2,
  History,
  Paperclip,
  X,
} from "lucide-react";
import Link from "next/link";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  TicketStatus,
  { label: string; bg: string; text: string; dot: string; icon?: React.ElementType }
> = {
  NEW: { label: "New", bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" },
  TRIAGED: { label: "Triaged", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-400" },
  ASSIGNED: { label: "Assigned", bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-400" },
  IN_PROGRESS: { label: "In Progress", bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  PENDING_REVIEW: { label: "Pending Review", bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-400", icon: Eye },
  CLOSED: { label: "Closed", bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500", icon: CheckCircle2 },
  REOPENED: { label: "Reopened", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-400", icon: RotateCcw },
};

// State machine transitions and their UI config
interface Action {
  key: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
}

const VALID_TRANSITIONS: Record<string, Action[]> = {
  NEW: [{ key: "TRIAGED", label: "Triage", icon: ChevronRight, roles: ["DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER"] }],
  TRIAGED: [{ key: "ASSIGNED", label: "Assign", icon: User, roles: ["DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER"] }],
  ASSIGNED: [{ key: "IN_PROGRESS", label: "Start Work", icon: Play, roles: ["TECHNICIAN", "DISPATCHER", "ADMINISTRATOR"] }],
  IN_PROGRESS: [{ key: "PENDING_REVIEW", label: "Submit for Review", icon: Send, roles: ["TECHNICIAN", "DISPATCHER", "ADMINISTRATOR"] }],
  PENDING_REVIEW: [
    { key: "CLOSED", label: "Close", icon: CheckCircle2, roles: ["DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER", "TECHNICIAN"] },
    { key: "IN_PROGRESS", label: "Return to Work", icon: RotateCcw, roles: ["DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER"] },
  ],
  CLOSED: [{ key: "REOPENED", label: "Reopen", icon: RotateCcw, roles: ["DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER"] }],
  REOPENED: [{ key: "TRIAGED", label: "Triage", icon: ChevronRight, roles: ["DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER"] }],
};

// ─── State Machine Flow ───────────────────────────────────────────────────────

function StateFlow({ current }: { current: TicketStatus }) {
  const flow: TicketStatus[] = ["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW", "CLOSED"];
  const currentIdx = flow.indexOf(current);
  const isReopened = current === "REOPENED";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        State Machine
      </h3>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {isReopened && (
          <>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <RotateCcw className="h-3 w-3 text-red-400" />
              <span>Reopened</span>
            </div>
            <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />
          </>
        )}
        {flow.map((status, idx) => {
          const sc = STATUS_CONFIG[status];
          const completed = isReopened ? idx < flow.indexOf("TRIAGED") : idx < currentIdx;
          const active = isReopened ? status === "TRIAGED" : status === current;
          const future = isReopened ? idx > flow.indexOf("TRIAGED") : idx > currentIdx;

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

// ─── Timeline ─────────────────────────────────────────────────────────────────

function AuditTimeline({ events }: { events: TicketAuditEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <History className="h-3.5 w-3.5" />
        Activity
      </h3>
      <div className="space-y-0">
        {events.map((event, idx) => {
          const isLast = idx === events.length - 1;
          return (
            <div key={event.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="h-2 w-2 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                {!isLast && <div className="w-px flex-1 bg-slate-200" />}
              </div>
              <div className={cn("pb-4", isLast && "pb-0")}>
                <p className="text-sm text-slate-700">
                  <span className="font-medium">{event.userName ?? "System"}</span>
                  {" "}
                  <span className="text-slate-500">{event.action.replace(/_/g, " ").toLowerCase()}</span>
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {new Date(event.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Detail Page ─────────────────────────────────────────────────────────

export default function TicketDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const id = params.id as string;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);

  // Close form
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [rootCause, setRootCause] = useState("");

  // Reopen form
  const [reopenReason, setReopenReason] = useState("");

  // Assign form
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);

  const fetchTicket = useCallback(async () => {
    try {
      const data = await apiGet<TicketDetail>(`/tickets/${id}`);
      setTicket(data);
    } catch {
      setError("Ticket not found");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const handleTransition = async (newStatus: TicketStatus) => {
    setActionLoading(newStatus);
    setError("");
    try {
      const updated = await apiPatch<TicketDetail>(`/tickets/${id}/status`, { status: newStatus });
      setTicket({ ...ticket!, ...updated });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Action failed";
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleClose = async () => {
    if (!resolutionNotes.trim()) return;
    setActionLoading("CLOSE");
    setError("");
    try {
      const updated = await apiPost<TicketDetail>(`/tickets/${id}/close`, {
        resolutionNotes,
        rootCause: rootCause || undefined,
      });
      setTicket({ ...ticket!, ...updated });
      setShowCloseDialog(false);
      setResolutionNotes("");
      setRootCause("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Close failed";
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReopen = async () => {
    if (!reopenReason.trim()) return;
    setActionLoading("REOPEN");
    setError("");
    try {
      const updated = await apiPost<TicketDetail>(`/tickets/${id}/reopen`, { reason: reopenReason });
      setTicket({ ...ticket!, ...updated });
      setShowReopenDialog(false);
      setReopenReason("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Reopen failed";
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssign = async (userId: string) => {
    setActionLoading("ASSIGN");
    setError("");
    try {
      const updated = await apiPost<TicketDetail>(`/tickets/${id}/assign`, { assigneeId: userId });
      setTicket({ ...ticket!, ...updated });
      setShowAssignDialog(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Assign failed";
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const loadUsers = async () => {
    if (users.length > 0) return;
    try {
      const res = await apiGet<{ data: Array<{ id: string; name: string }>; pagination: unknown }>("/technicians?limit=50");
      setUsers(res.data);
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-slate-500">{error || "Ticket not found"}</p>
        <Link href="/tickets" className="mt-2 inline-flex items-center gap-1 text-sm text-brand-600">
          <ArrowLeft className="h-4 w-4" /> Back to tickets
        </Link>
      </div>
    );
  }

  const sc = STATUS_CONFIG[ticket.status];
  const availableActions = VALID_TRANSITIONS[ticket.status] ?? [];
  const userActions = availableActions.filter((a) => user?.role && a.roles.includes(user.role));

  return (
    <div>
      {/* Back */}
      <Link
        href="/tickets"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tickets
      </Link>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Title + Status */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{ticket.title}</h1>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", sc.bg, sc.text)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
              {sc.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">{id}</p>
        </div>
      </div>

      {/* State flow */}
      <div className="mb-6">
        <StateFlow current={ticket.status} />
      </div>

      {/* Action buttons */}
      {userActions.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {userActions.map((action) => {
            const isLoading = actionLoading === action.key;
            const needsDialog = action.key === "CLOSED" || action.key === "REOPENED" || action.key === "ASSIGNED";
            const onClick = needsDialog
              ? () => {
                  if (action.key === "CLOSED") setShowCloseDialog(true);
                  else if (action.key === "REOPENED") setShowReopenDialog(true);
                  else if (action.key === "ASSIGNED") {
                    loadUsers();
                    setShowAssignDialog(true);
                  }
                }
              : () => handleTransition(action.key as TicketStatus);

            return (
              <button
                key={action.key}
                onClick={onClick}
                disabled={isLoading}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  action.key === "CLOSED"
                    ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                    : action.key === "REOPENED"
                      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  isLoading && "opacity-60 cursor-not-allowed",
                )}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <action.icon className="h-4 w-4" />}
                {action.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Description</h3>
            <p className="whitespace-pre-wrap text-sm text-slate-600">{ticket.description}</p>
          </div>

          {/* Resolution (if closed) */}
          {ticket.resolution_notes && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-5">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-800">
                <CheckCircle2 className="h-4 w-4" />
                Resolution
              </h3>
              <p className="whitespace-pre-wrap text-sm text-green-700">{ticket.resolution_notes}</p>
              {ticket.root_cause && (
                <p className="mt-2 text-xs text-green-600">
                  <span className="font-medium">Root cause:</span> {ticket.root_cause}
                </p>
              )}
            </div>
          )}

          {/* Evidence */}
          {ticket.ticket_evidence.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Paperclip className="h-4 w-4" />
                Evidence ({ticket.ticket_evidence.length})
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {ticket.ticket_evidence.map((te) => (
                  <div
                    key={te.id}
                    className="flex aspect-square items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-400"
                  >
                    {te.evidence.media_type?.startsWith("image") ? "IMG" : te.evidence.media_type ?? "FILE"}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit timeline */}
          {ticket.audit_events.length > 0 && <AuditTimeline events={ticket.audit_events} />}
        </div>

        {/* Right: Metadata sidebar */}
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Details
            </h3>
            <dl className="space-y-4">
              {/* Assignee */}
              <div>
                <dt className="text-xs text-slate-500">Assignee</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-slate-900">
                  {ticket.assignee ? (
                    <>
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      {ticket.assignee.first_name} {ticket.assignee.last_name}
                    </>
                  ) : (
                    <span className="text-slate-400">Unassigned</span>
                  )}
                </dd>
              </div>

              {/* Creator */}
              <div>
                <dt className="text-xs text-slate-500">Created by</dt>
                <dd className="mt-0.5 text-sm text-slate-700">
                  {ticket.creator.first_name} {ticket.creator.last_name}
                </dd>
              </div>

              {/* Priority */}
              <div>
                <dt className="text-xs text-slate-500">Priority</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-900">{ticket.priority}</dd>
              </div>

              {/* Severity */}
              {ticket.severity && (
                <div>
                  <dt className="text-xs text-slate-500">Severity</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-900">{ticket.severity}</dd>
                </div>
              )}

              {/* Turbine */}
              {ticket.turbine && (
                <div>
                  <dt className="text-xs text-slate-500">Turbine</dt>
                  <dd className="mt-0.5 text-sm text-slate-700">{ticket.turbine.name}</dd>
                </div>
              )}

              {/* Component */}
              {ticket.component && (
                <div>
                  <dt className="text-xs text-slate-500">Component</dt>
                  <dd className="mt-0.5 text-sm text-slate-700">{ticket.component.name}</dd>
                </div>
              )}

              {/* Due date */}
              {ticket.due_date && (
                <div>
                  <dt className="text-xs text-slate-500">Due date</dt>
                  <dd className="mt-0.5 flex items-center gap-1 text-sm text-slate-700">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {new Date(ticket.due_date).toLocaleDateString()}
                  </dd>
                </div>
              )}

              {/* SLA */}
              {ticket.sla_target_date && (
                <div>
                  <dt className="text-xs text-slate-500">SLA Target</dt>
                  <dd className={cn(
                    "mt-0.5 flex items-center gap-1 text-sm",
                    new Date(ticket.sla_target_date) < new Date() && ticket.status !== "CLOSED"
                      ? "text-red-600 font-medium"
                      : "text-slate-700",
                  )}>
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(ticket.sla_target_date).toLocaleDateString()}
                  </dd>
                </div>
              )}

              {/* Dates */}
              <div className="border-t border-slate-100 pt-3">
                <dt className="text-xs text-slate-400">Created</dt>
                <dd className="mt-0.5 text-xs text-slate-500">
                  {new Date(ticket.created_at).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Updated</dt>
                <dd className="mt-0.5 text-xs text-slate-500">
                  {new Date(ticket.updated_at).toLocaleString()}
                </dd>
              </div>
              {ticket.closed_at && (
                <div>
                  <dt className="text-xs text-slate-400">Closed</dt>
                  <dd className="mt-0.5 text-xs text-slate-500">
                    {new Date(ticket.closed_at).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Escalation indicator */}
          {(ticket.priority === "CRITICAL" || ticket.severity === "SAFETY") && ticket.status !== "CLOSED" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-semibold text-red-800">
                  {ticket.severity === "SAFETY" ? "Safety Critical" : "Escalated"}
                </span>
              </div>
              <p className="mt-1 text-xs text-red-700">
                {ticket.severity === "SAFETY"
                  ? "This ticket involves a safety concern and requires immediate attention."
                  : "This critical-priority ticket is flagged for escalation."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Close Dialog ──────────────────────────────────────────────────── */}
      {showCloseDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Close Ticket</h2>
              <button onClick={() => setShowCloseDialog(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Resolution Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Describe how the issue was resolved"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Root Cause</label>
                <input
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="What caused the issue"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCloseDialog(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClose}
                disabled={!resolutionNotes.trim() || actionLoading === "CLOSE"}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white",
                  !resolutionNotes.trim() || actionLoading === "CLOSE" ? "opacity-60 cursor-not-allowed" : "hover:bg-green-700",
                )}
              >
                {actionLoading === "CLOSE" && <Loader2 className="h-4 w-4 animate-spin" />}
                Close Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Reopen Dialog ─────────────────────────────────────────────────── */}
      {showReopenDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Reopen Ticket</h2>
              <button onClick={() => setShowReopenDialog(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="Why is this ticket being reopened?"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowReopenDialog(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReopen}
                disabled={!reopenReason.trim() || actionLoading === "REOPEN"}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white",
                  !reopenReason.trim() || actionLoading === "REOPEN" ? "opacity-60 cursor-not-allowed" : "hover:bg-red-700",
                )}
              >
                {actionLoading === "REOPEN" && <Loader2 className="h-4 w-4 animate-spin" />}
                Reopen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Assign Dialog ─────────────────────────────────────────────────── */}
      {showAssignDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Assign Technician</h2>
              <button onClick={() => setShowAssignDialog(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <input
              type="text"
              value={assigneeSearch}
              onChange={(e) => setAssigneeSearch(e.target.value)}
              placeholder="Search technicians..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
              {users
                .filter(
                  (u) =>
                    !assigneeSearch ||
                    u.name.toLowerCase().includes(assigneeSearch.toLowerCase()),
                )
                .map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleAssign(u.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <User className="h-4 w-4 text-slate-400" />
                    {u.name}
                  </button>
                ))}
              {users.length === 0 && (
                <p className="py-4 text-center text-sm text-slate-400">No technicians available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
