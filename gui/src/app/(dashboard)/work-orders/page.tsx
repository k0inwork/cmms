"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { TicketStatus, Priority, PaginatedResponse } from "@/types";
import { Search, Filter, Loader2, Wrench } from "lucide-react";

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

const STATUSES: TicketStatus[] = ["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW", "CLOSED", "REOPENED"];

interface WorkOrderItem {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TicketStatus;
  assignee_id: string | null;
  created_by: string;
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  ticket: { id: string; title: string; status: string } | null;
  assignee: { id: string; first_name: string; last_name: string } | null;
  creator: { id: string; first_name: string; last_name: string };
  turbine: { id: string; name: string } | null;
  component: { id: string; name: string } | null;
  _count: { work_order_evidence: number };
}

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");
  const [search, setSearch] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchWorkOrders = async (cur?: string) => {
    try {
      const params = new URLSearchParams({ limit: "25" });
      if (statusFilter) params.set("status", statusFilter);
      if (cur) params.set("cursor", cur);
      const res = await apiGet<PaginatedResponse<WorkOrderItem>>(`/work-orders?${params}`);
      if (cur) {
        setWorkOrders((prev) => [...prev, ...res.data]);
      } else {
        setWorkOrders(res.data);
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
    fetchWorkOrders();
  }, [statusFilter]);

  const filtered = search
    ? workOrders.filter(
        (wo) =>
          wo.title.toLowerCase().includes(search.toLowerCase()) ||
          wo.id.toLowerCase().includes(search.toLowerCase()) ||
          wo.ticket?.title.toLowerCase().includes(search.toLowerCase()),
      )
    : workOrders;

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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Work Orders</h1>
        <p className="mt-1 text-sm text-slate-500">{filtered.length} work orders</p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search work orders..."
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
                <th className="hidden px-4 py-3 font-medium text-slate-600 sm:table-cell">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((wo) => {
                const sc = STATUS_BADGE[wo.status];
                const pc = PRIORITY_BADGE[wo.priority];
                const isOverdue = wo.due_date && new Date(wo.due_date) < new Date() && wo.status !== "CLOSED";
                return (
                  <tr key={wo.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-slate-400" />
                        <span className="font-medium text-slate-900">{wo.title}</span>
                      </div>
                      {wo.ticket && (
                        <p className="mt-0.5 text-xs text-slate-400">
                          Ticket: {wo.ticket.title}
                        </p>
                      )}
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
                      {wo.assignee ? `${wo.assignee.first_name} ${wo.assignee.last_name}` : "—"}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell text-sm text-slate-600">
                      {wo.turbine?.name ?? "—"}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      {wo.due_date ? (
                        <span className={cn("text-xs", isOverdue ? "font-medium text-red-600" : "text-slate-400")}>
                          {new Date(wo.due_date).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                    No work orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <div className="border-t border-slate-100 px-4 py-3 text-center">
            <button
              onClick={() => { setLoadingMore(true); fetchWorkOrders(cursor ?? undefined); }}
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
