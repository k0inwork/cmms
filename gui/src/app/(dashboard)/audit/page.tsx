"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet } from "@/lib/api-client";
import type { AuditEvent, AuditAction, PaginatedResponse } from "@/types";
import { Filter, ChevronRight, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_COLORS: Record<AuditAction, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  STATUS_CHANGE: "bg-yellow-100 text-yellow-800",
  ASSIGN: "bg-purple-100 text-purple-800",
  APPROVE: "bg-emerald-100 text-emerald-800",
  REJECT: "bg-red-100 text-red-800",
  SYNC: "bg-cyan-100 text-cyan-800",
  LOGIN: "bg-gray-100 text-gray-800",
  LOGOUT: "bg-gray-100 text-gray-800",
};

const ENTITY_TYPES = [
  "User", "Ticket", "WorkOrder", "InspectionRecord", "InspectionTemplate",
  "Organization", "Site", "Turbine", "Subsystem", "Component",
  "Evidence", "Skill", "Certification", "UserSkill", "UserCertification",
  "WorkflowRule", "TechnicianStatus",
];

const AUDIT_ACTIONS: AuditAction[] = [
  "CREATE", "UPDATE", "DELETE", "STATUS_CHANGE", "ASSIGN", "APPROVE", "REJECT", "SYNC", "LOGIN", "LOGOUT",
];

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  // Filters
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [userId, setUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const buildQuery = useCallback(
    (cur?: string) => {
      const params = new URLSearchParams({ limit: "25" });
      if (cur) params.set("cursor", cur);
      if (entityType) params.set("entityType", entityType);
      if (action) params.set("action", action);
      if (userId) params.set("userId", userId);
      if (dateFrom) params.set("createdAfter", new Date(dateFrom).toISOString());
      if (dateTo) params.set("createdBefore", new Date(dateTo + "T23:59:59").toISOString());
      return `/audit?${params.toString()}`;
    },
    [entityType, action, userId, dateFrom, dateTo],
  );

  const load = useCallback(async (cur?: string) => {
    setLoading(true);
    try {
      const res = await apiGet<PaginatedResponse<AuditEvent>>(buildQuery(cur));
      if (cur) {
        setEvents((prev) => [...prev, ...res.data]);
      } else {
        setEvents(res.data);
      }
      setHasMore(res.pagination.has_more);
      if (res.data.length > 0) {
        setCursor(res.pagination.next_cursor);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    load();
  }, [load]);

  const applyFilters = () => {
    setCursor(null);
    load();
  };

  const clearFilters = () => {
    setEntityType("");
    setAction("");
    setUserId("");
    setDateFrom("");
    setDateTo("");
  };

  const activeFilterCount = [entityType, action, userId, dateFrom, dateTo].filter(Boolean).length;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Audit Trail</h1>
      <p className="mt-1 text-sm text-slate-500">
        Review system audit events and entity change history.
      </p>

      {/* Filters */}
      <div className="mt-6">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-xs text-white">{activeFilterCount}</span>
          )}
        </button>

        {showFilters && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-500">Entity Type</label>
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                >
                  <option value="">All types</option>
                  {ENTITY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">Action</label>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                >
                  <option value="">All actions</option>
                  {AUDIT_ACTIONS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">User ID</label>
                <input
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="UUID"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={applyFilters} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                Apply
              </button>
              <button onClick={clearFilters} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Events List */}
      <div className="mt-6">
        {loading && events.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading...</p>
        ) : events.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">No audit events found</p>
        ) : (
          <div className="space-y-2">
            {events.map((ev) => (
              <button
                key={ev.id}
                onClick={() => setSelected(selected?.id === ev.id ? null : ev)}
                className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", ACTION_COLORS[ev.action])}>
                      {ev.action}
                    </span>
                    <span className="text-sm font-medium text-slate-900">{ev.entity_type}</span>
                    <ChevronRight className="h-3 w-3 text-slate-400" />
                    <span className="font-mono text-xs text-slate-500">{ev.entity_id.slice(0, 8)}...</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {ev.user && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {ev.user.first_name} {ev.user.last_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(ev.created_at)}
                    </span>
                  </div>
                </div>

                {selected?.id === ev.id && (
                  <EventDetail event={ev} />
                )}
              </button>
            ))}
          </div>
        )}

        {hasMore && (
          <div className="mt-4 text-center">
            <button
              onClick={() => load(cursor ?? undefined)}
              disabled={loading}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Load More"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EventDetail({ event }: { event: AuditEvent }) {
  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-slate-500">Entity ID</p>
          <p className="mt-0.5 font-mono text-xs text-slate-700">{event.entity_id}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">User ID</p>
          <p className="mt-0.5 font-mono text-xs text-slate-700">{event.user_id}</p>
        </div>
      </div>

      {event.before_state && (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500">Before State</p>
          <pre className="mt-1 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-700 max-h-40">
            {JSON.stringify(event.before_state, null, 2)}
          </pre>
        </div>
      )}

      {event.after_state && (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500">After State</p>
          <pre className="mt-1 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-700 max-h-40">
            {JSON.stringify(event.after_state, null, 2)}
          </pre>
        </div>
      )}

      {event.metadata && (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500">Metadata</p>
          <pre className="mt-1 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-700 max-h-40">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
