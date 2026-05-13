"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { InspectionStatus, PaginatedResponse } from "@/types";
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Eye,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

interface ReviewItem {
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

type FilterStatus = "SUBMITTED" | "CHANGES_REQUESTED" | "REJECTED";

const FILTER_OPTIONS: { key: FilterStatus; label: string; color: string }[] = [
  { key: "SUBMITTED", label: "Awaiting Review", color: "bg-blue-100 text-blue-800 border-blue-300" },
  { key: "CHANGES_REQUESTED", label: "Changes Requested", color: "bg-orange-100 text-orange-800 border-orange-300" },
  { key: "REJECTED", label: "Rejected", color: "bg-red-100 text-red-800 border-red-300" },
];

export default function QaReviewPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("SUBMITTED");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const canReview =
    user?.role === "QA_REVIEWER" ||
    user?.role === "ADMINISTRATOR";

  const fetchItems = useCallback(async (cur?: string) => {
    try {
      const params = new URLSearchParams({ limit: "25", status: filter });
      if (cur) params.set("cursor", cur);
      const res = await apiGet<PaginatedResponse<ReviewItem>>(`/inspections?${params}`);
      if (cur) {
        setItems((prev) => [...prev, ...res.data]);
      } else {
        setItems(res.data);
      }
      setHasMore(res.pagination.has_more);
      setCursor(res.pagination.next_cursor);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    setCursor(null);
    fetchItems();
  }, [filter, fetchItems]);

  const handleQuickAction = async (id: string, action: "approve" | "reject") => {
    setActionLoading(id);
    try {
      if (action === "approve") {
        await apiPost(`/inspections/${id}/approve`, {});
      } else {
        await apiPost(`/inspections/${id}/reject`, { action: "REJECT", notes: "Rejected via QA queue" });
      }
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  if (!canReview) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="h-12 w-12 text-slate-300" />
        <p className="mt-4 text-lg font-medium text-slate-500">QA Reviewer access required</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">QA Review Queue</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review and approve submitted inspections
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchItems(); }}
          className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              filter === opt.key
                ? opt.color
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <ClipboardCheck className="mb-3 h-12 w-12" />
          <p className="text-sm font-medium">No inspections in this queue</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isOverdue = item.due_date && new Date(item.due_date) < new Date();
            const isActing = actionLoading === item.id;
            return (
              <div
                key={item.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-slate-400" />
                      <h3 className="text-sm font-semibold text-slate-900">
                        {item.template_version?.template.name ?? "Inspection"}
                      </h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        v{item.template_version?.version ?? "?"}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-500">
                      <span>{item.turbine?.name ?? "No turbine"}</span>
                      {item.component && <span>{item.component.name}</span>}
                      <span>
                        {item.technician
                          ? `${item.technician.first_name} ${item.technician.last_name}`
                          : "Unassigned"}
                      </span>
                      {item._count.defects > 0 && (
                        <span className="font-medium text-red-600">
                          {item._count.defects} defect{item._count.defects !== 1 ? "s" : ""}
                        </span>
                      )}
                      {isOverdue && <span className="font-semibold text-red-600">OVERDUE</span>}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Submitted {item.completed_at ? new Date(item.completed_at).toLocaleString() : new Date(item.updated_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/inspections/${item.id}`}
                      className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Eye className="h-3.5 w-3.5" /> Review
                    </Link>
                    {filter === "SUBMITTED" && (
                      <>
                        <button
                          onClick={() => handleQuickAction(item.id, "approve")}
                          disabled={isActing}
                          className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          Approve
                        </button>
                        <button
                          onClick={() => handleQuickAction(item.id, "reject")}
                          disabled={isActing}
                          className="flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {hasMore && (
            <div className="pt-2 text-center">
              <button
                onClick={() => fetchItems(cursor ?? undefined)}
                className="text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Load more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
