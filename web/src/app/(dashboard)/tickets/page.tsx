"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { Ticket, TicketStatus, Priority, PaginatedResponse } from "@/types";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  User,
} from "lucide-react";
import Link from "next/link";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  TicketStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  NEW: { label: "New", bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" },
  TRIAGED: { label: "Triaged", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-400" },
  ASSIGNED: { label: "Assigned", bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-400" },
  IN_PROGRESS: { label: "In Progress", bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  PENDING_REVIEW: { label: "Pending Review", bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-400" },
  CLOSED: { label: "Closed", bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  REOPENED: { label: "Reopened", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-400" },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; bg: string; text: string }> = {
  LOW: { label: "Low", bg: "bg-slate-100", text: "text-slate-600" },
  MEDIUM: { label: "Medium", bg: "bg-blue-100", text: "text-blue-700" },
  HIGH: { label: "High", bg: "bg-orange-100", text: "text-orange-700" },
  CRITICAL: { label: "Critical", bg: "bg-red-100", text: "text-red-700" },
};

const ALL_STATUSES: TicketStatus[] = ["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW", "CLOSED", "REOPENED"];
const ALL_PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">("");
  const [showFilters, setShowFilters] = useState(false);

  const canCreate = user?.role && ["DISPATCHER", "ADMINISTRATOR", "OPERATIONS_MANAGER"].includes(user.role);

  const fetchTickets = useCallback(
    async (cur: string | null, append = false) => {
      setLoading(true);
      try {
        const q = buildQuery({
          limit: "25",
          cursor: cur ?? undefined,
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
        });
        const res = await apiGet<PaginatedResponse<Ticket>>(`/tickets${q}`);
        setTickets(append ? (prev) => [...prev, ...res.data] : res.data);
        setHasMore(res.pagination.has_more);
        if (res.data.length > 0) {
          setCursor(res.pagination.next_cursor);
        }
      } catch {
        // silently handle
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, priorityFilter],
  );

  useEffect(() => {
    fetchTickets(null);
  }, [fetchTickets]);

  const filtered = search
    ? tickets.filter(
        (t) =>
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          t.id.startsWith(search),
      )
    : tickets;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tickets</h1>
          <p className="mt-1 text-sm text-slate-500">Manage and track maintenance tickets</p>
        </div>
        {canCreate && (
          <Link
            href="/tickets/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            New Ticket
          </Link>
        )}
      </div>

      {/* Search + Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            showFilters
              ? "border-brand-300 bg-brand-50 text-brand-700"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
          )}
        >
          <Filter className="h-4 w-4" />
          Filters
          {(statusFilter || priorityFilter) && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
              {[statusFilter, priorityFilter].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TicketStatus | "")}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
          >
            <option value="">All statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as Priority | "")}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
          >
            <option value="">All priorities</option>
            {ALL_PRIORITIES.map((p) => (
              <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
            ))}
          </select>
          {(statusFilter || priorityFilter) && (
            <button
              onClick={() => {
                setStatusFilter("");
                setPriorityFilter("");
              }}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Table — Desktop */}
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Turbine</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const sc = STATUS_CONFIG[t.status];
                const pc = PRIORITY_CONFIG[t.priority];
                return (
                  <tr
                    key={t.id}
                    className="border-b border-slate-50 transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/tickets/${t.id}`} className="group">
                        <p className="text-sm font-medium text-slate-900 group-hover:text-brand-600">
                          {t.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {t.id.slice(0, 8)}
                        </p>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                          sc.bg,
                          sc.text,
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          pc.bg,
                          pc.text,
                        )}
                      >
                        {t.priority === "CRITICAL" && (
                          <AlertTriangle className="mr-1 h-3 w-3" />
                        )}
                        {pc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.assignee ? (
                        <span className="flex items-center gap-1.5 text-sm text-slate-700">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          {t.assignee.first_name} {t.assignee.last_name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {t.turbine?.name ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3 w-3" />
                        {timeAgo(t.updated_at)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && !loading && (
            <div className="py-12 text-center text-sm text-slate-400">
              No tickets found
            </div>
          )}
        </div>
      </div>

      {/* Card list — Mobile */}
      <div className="space-y-3 md:hidden">
        {filtered.map((t) => {
          const sc = STATUS_CONFIG[t.status];
          const pc = PRIORITY_CONFIG[t.priority];
          return (
            <Link
              key={t.id}
              href={`/tickets/${t.id}`}
              className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-slate-900">{t.title}</p>
                <span
                  className={cn(
                    "ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    pc.bg,
                    pc.text,
                  )}
                >
                  {pc.label}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    sc.bg,
                    sc.text,
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                  {sc.label}
                </span>
                {t.assignee && (
                  <span className="text-xs text-slate-500">
                    {t.assignee.first_name} {t.assignee.last_name}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                <span>{t.id.slice(0, 8)}</span>
                <span>{timeAgo(t.updated_at)}</span>
              </div>
            </Link>
          );
        })}
        {filtered.length === 0 && !loading && (
          <div className="py-12 text-center text-sm text-slate-400">
            No tickets found
          </div>
        )}
      </div>

      {/* Loading + Pagination */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
        </div>
      )}
      {hasMore && !loading && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => fetchTickets(cursor, true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Load more
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
