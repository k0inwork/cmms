"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { InspectionStatus, PaginatedResponse } from "@/types";
import { Search, Filter, Loader2, ClipboardCheck } from "lucide-react";

const STATUS_BADGE: Record<InspectionStatus, { label: string; bg: string; text: string }> = {
  ASSIGNED: { label: "Assigned", bg: "bg-indigo-50", text: "text-indigo-700" },
  IN_PROGRESS: { label: "In Progress", bg: "bg-yellow-50", text: "text-yellow-700" },
  SUBMITTED: { label: "Submitted", bg: "bg-blue-50", text: "text-blue-700" },
  APPROVED: { label: "Approved", bg: "bg-green-50", text: "text-green-700" },
  REJECTED: { label: "Rejected", bg: "bg-red-50", text: "text-red-700" },
  CHANGES_REQUESTED: { label: "Changes Requested", bg: "bg-orange-50", text: "text-orange-700" },
};

const STATUSES: InspectionStatus[] = ["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED", "CHANGES_REQUESTED"];

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

export default function InspectionsPage() {
  const [inspections, setInspections] = useState<InspectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<InspectionStatus | "">("");
  const [search, setSearch] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchInspections = async (cur?: string) => {
    try {
      const params = new URLSearchParams({ limit: "25" });
      if (statusFilter) params.set("status", statusFilter);
      if (cur) params.set("cursor", cur);
      const res = await apiGet<PaginatedResponse<InspectionItem>>(`/inspections?${params}`);
      if (cur) {
        setInspections((prev) => [...prev, ...res.data]);
      } else {
        setInspections(res.data);
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
    fetchInspections();
  }, [statusFilter]);

  const filtered = search
    ? inspections.filter(
        (i) =>
          i.template_version?.template.name.toLowerCase().includes(search.toLowerCase()) ||
          i.turbine?.name.toLowerCase().includes(search.toLowerCase()) ||
          i.id.toLowerCase().includes(search.toLowerCase()),
      )
    : inspections;

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
        <h1 className="text-2xl font-semibold text-slate-900">Inspections</h1>
        <p className="mt-1 text-sm text-slate-500">{filtered.length} inspection records</p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by template, turbine..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InspectionStatus | "")}
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
                <th className="px-4 py-3 font-medium text-slate-600">Template</th>
                <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="hidden px-4 py-3 font-medium text-slate-600 md:table-cell">Technician</th>
                <th className="hidden px-4 py-3 font-medium text-slate-600 lg:table-cell">Turbine</th>
                <th className="hidden px-4 py-3 font-medium text-slate-600 lg:table-cell">Defects</th>
                <th className="hidden px-4 py-3 font-medium text-slate-600 sm:table-cell">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((insp) => {
                const sc = STATUS_BADGE[insp.status];
                const isOverdue = insp.due_date && new Date(insp.due_date) < new Date() && insp.status !== "APPROVED";
                return (
                  <tr key={insp.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4 text-slate-400" />
                        <span className="font-medium text-slate-900">
                          {insp.template_version?.template.name ?? "Unknown Template"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">v{insp.template_version?.version ?? "?"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", sc.bg, sc.text)}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell text-sm text-slate-600">
                      {insp.technician ? `${insp.technician.first_name} ${insp.technician.last_name}` : "—"}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell text-sm text-slate-600">
                      {insp.turbine?.name ?? "—"}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell text-sm text-slate-600">
                      {insp._count.defects > 0 ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          {insp._count.defects}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">0</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      {insp.due_date ? (
                        <span className={cn("text-xs", isOverdue ? "font-medium text-red-600" : "text-slate-400")}>
                          {new Date(insp.due_date).toLocaleDateString()}
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
                    No inspections found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <div className="border-t border-slate-100 px-4 py-3 text-center">
            <button
              onClick={() => { setLoadingMore(true); fetchInspections(cursor ?? undefined); }}
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
