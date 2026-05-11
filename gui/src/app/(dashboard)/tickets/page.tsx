"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Ticket, TicketStatus, Priority, PaginatedResponse } from "@/types";
import { Plus, Search, Filter, Loader2 } from "lucide-react";

const STATUS_BADGE: Record<TicketStatus, { label: string; bg: string; text: string }> = {
  NEW: { label: "New", bg: "bg-slate-100", text: "text-slate-700" },
  TRIAGED: { label: "Triaged", bg: "bg-blue-50", text: "text-blue-700" },
  ASSIGNED: { label: "Assigned", bg: "bg-indigo-50", text: "text-indigo-700" },
  IN_PROGRESS: { label: "In Progress", bg: "bg-yellow-50", text: "text-yellow-700" },
  PENDING_REVIEW: { label: "Pending Review", bg: "bg-orange-50", text: "text-orange-700" },
  CLOSED: { label: "Closed", bg: "bg-green-50", text: "text-green-700" },
  REOPENED: { label: "Reopened", bg: "bg-red-50", text: "text-red-700" },
};

const PRIORITY_BADGE: Record<Priority, { label: string; text: string }> = {
  LOW: { label: "Low", text: "text-slate-500" },
  MEDIUM: { label: "Medium", text: "text-blue-600" },
  HIGH: { label: "High", text: "text-orange-600" },
  CRITICAL: { label: "Critical", text: "text-red-600" },
};

type TicketItem = Ticket & {
  assignee: { id: string; first_name: string; last_name: string } | null;
  creator: { id: string; first_name: string; last_name: string };
  turbine: { id: string; name: string } | null;
  _count: { ticket_evidence: number };
};

const STATUSES: TicketStatus[] = ["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW", "CLOSED", "REOPENED"];

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");
  const [search, setSearch] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchTickets = async (cur?: string) => {
    try {
      const params = new URLSearchParams({ limit: "25" });
      if (statusFilter) params.set("status", statusFilter);
      if (cur) params.set("cursor", cur);
      const res = await apiGet<PaginatedResponse<TicketItem>>(`/tickets?${params}`);
      if (cur) {
        setTickets((prev) => [...prev, ...res.data]);
      } else {
        setTickets(res.data);
      }
      setHasMore(res.pagination.has_more);
      setCursor(res.pagination.next_cursor);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setCursor(null);
    fetchTickets();
  }, [statusFilter]);

  const filtered = search
    ? tickets.filter(
        (t) =>
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          t.id.toLowerCase().includes(search.toLowerCase()),
      )
    : tickets;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tickets</h1>
          <p className="mt-1 text-sm text-slate-500">{filtered.length} tickets</p>
        </div>
        <Link
          href="/tickets/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          New Ticket
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TicketStatus | "")}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_BADGE[s].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 font-medium text-slate-600">Title</th>
                <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="hidden px-4 py-3 font-medium text-slate-600 md:table-cell">Priority</th>
                <th className="hidden px-4 py-3 font-medium text-slate-600 lg:table-cell">Assignee</th>
                <th className="hidden px-4 py-3 font-medium text-slate-600 lg:table-cell">Turbine</th>
                <th className="hidden px-4 py-3 font-medium text-slate-600 sm:table-cell">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((ticket) => {
                const sc = STATUS_BADGE[ticket.status];
                const pc = PRIORITY_BADGE[ticket.priority];
                return (
                  <tr key={ticket.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/tickets/${ticket.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                        {ticket.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-400">{ticket.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", sc.bg, sc.text)}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span className={cn("text-xs font-medium", pc.text)}>{pc.label}</span>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell text-sm text-slate-600">
                      {ticket.assignee ? `${ticket.assignee.first_name} ${ticket.assignee.last_name}` : "—"}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell text-sm text-slate-600">
                      {ticket.turbine?.name ?? "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-slate-400 sm:table-cell">
                      {new Date(ticket.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                    No tickets found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <div className="border-t border-slate-100 px-4 py-3 text-center">
            <button
              onClick={() => { setLoadingMore(true); fetchTickets(cursor ?? undefined); }}
              disabled={loadingMore}
              className="text-sm font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
