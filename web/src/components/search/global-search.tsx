"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiGet } from "@/lib/api-client";
import type { SearchHit, SearchEntityType, SearchResponse } from "@/types";
import {
  Search,
  Ticket,
  Wrench,
  ClipboardCheck,
  Wind,
  Cpu,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const TYPE_LABELS: Record<SearchEntityType, string> = {
  TICKET: "Tickets",
  WORK_ORDER: "Work Orders",
  INSPECTION: "Inspections",
  TURBINE: "Turbines",
  COMPONENT: "Components",
};

const TYPE_ICONS: Record<SearchEntityType, React.ElementType> = {
  TICKET: Ticket,
  WORK_ORDER: Wrench,
  INSPECTION: ClipboardCheck,
  TURBINE: Wind,
  COMPONENT: Cpu,
};

const TYPE_COLORS: Record<SearchEntityType, string> = {
  TICKET: "text-blue-600 bg-blue-50",
  WORK_ORDER: "text-orange-600 bg-orange-50",
  INSPECTION: "text-purple-600 bg-purple-50",
  TURBINE: "text-emerald-600 bg-emerald-50",
  COMPONENT: "text-slate-600 bg-slate-100",
};

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-700",
  TRIAGED: "bg-blue-50 text-blue-700",
  ASSIGNED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-yellow-50 text-yellow-800",
  PENDING_REVIEW: "bg-orange-50 text-orange-800",
  CLOSED: "bg-green-50 text-green-800",
  REOPENED: "bg-red-50 text-red-800",
  SUBMITTED: "bg-yellow-50 text-yellow-800",
  APPROVED: "bg-green-50 text-green-800",
  REJECTED: "bg-red-50 text-red-800",
  CHANGES_REQUESTED: "bg-orange-50 text-orange-800",
  ACTIVE: "bg-green-50 text-green-800",
};

function statusColor(status: string | null): string {
  if (!status) return "bg-slate-100 text-slate-700";
  return STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700";
}

function getHref(hit: SearchHit): string {
  switch (hit.type) {
    case "TICKET":
      return `/tickets?id=${hit.id}`;
    case "WORK_ORDER":
      return `/work-orders?id=${hit.id}`;
    case "INSPECTION":
      return `/inspections?id=${hit.id}`;
    case "TURBINE":
      return `/tickets?turbine=${hit.id}`;
    case "COMPONENT":
      return `/tickets?component=${hit.id}`;
  }
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeType, setActiveType] = useState<SearchEntityType | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveType(null);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const typeParam = activeType ? `&type=${activeType}` : "";
        const res = await apiGet<SearchResponse>(
          `/search?q=${encodeURIComponent(query)}&limit=20${typeParam}`,
        );
        setResults(res.data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeType]);

  const grouped = results.reduce<Record<SearchEntityType, SearchHit[]>>(
    (acc, hit) => {
      if (!acc[hit.type]) acc[hit.type] = [];
      acc[hit.type].push(hit);
      return acc;
    },
    {} as Record<SearchEntityType, SearchHit[]>,
  );

  const flatVisible = activeType
    ? grouped[activeType] ?? []
    : Object.values(grouped).flat();

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatVisible.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && flatVisible[selectedIndex]) {
        e.preventDefault();
        const hit = flatVisible[selectedIndex];
        router.push(getHref(hit));
        onClose();
      }
    },
    [flatVisible, selectedIndex, onClose, router],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search turbines, tickets, inspections..."
            className="flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
          />
          {loading && (
            <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
          )}
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1 hover:bg-slate-100"
          >
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Type filter tabs */}
        {query.trim() && (
          <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-4 py-2">
            <button
              onClick={() => {
                setActiveType(null);
                setSelectedIndex(0);
              }}
              className={`shrink-0 rounded-md px-3 py-1 text-xs font-medium ${
                !activeType
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              All ({results.length})
            </button>
            {(Object.keys(TYPE_LABELS) as SearchEntityType[]).map((type) => {
              const count = grouped[type]?.length ?? 0;
              if (count === 0) return null;
              return (
                <button
                  key={type}
                  onClick={() => {
                    setActiveType(type);
                    setSelectedIndex(0);
                  }}
                  className={`shrink-0 rounded-md px-3 py-1 text-xs font-medium ${
                    activeType === type
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {TYPE_LABELS[type]} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Results */}
        {query.trim() && (
          <div className="max-h-[50vh] overflow-y-auto px-2 py-2">
            {results.length === 0 && !loading && (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                No results found for &ldquo;{query}&rdquo;
              </div>
            )}

            {(activeType
              ? [activeType]
              : (Object.keys(grouped) as SearchEntityType[])
            ).map((type) => {
              const hits = grouped[type];
              if (!hits || hits.length === 0) return null;
              const Icon = TYPE_ICONS[type];

              return (
                <div key={type}>
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {TYPE_LABELS[type]}
                  </div>
                  {hits.map((hit) => {
                    const globalIndex = flatVisible.indexOf(hit);
                    const isActive = globalIndex === selectedIndex;
                    return (
                      <Link
                        key={hit.id}
                        href={getHref(hit)}
                        onClick={onClose}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                          isActive ? "bg-brand-50" : "hover:bg-slate-50"
                        }`}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${TYPE_COLORS[type]}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-slate-900">
                              {hit.title}
                            </span>
                            {hit.status && (
                              <span
                                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusColor(hit.status)}`}
                              >
                                {hit.status.replace(/_/g, " ")}
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-slate-500">
                            {hit.assignee &&
                              `${hit.assignee.firstName} ${hit.assignee.lastName}`}
                            {hit.site && ` · ${hit.site.name}`}
                            {hit.turbine && ` · ${hit.turbine.name}`}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-slate-400">
                          {new Date(hit.createdAt).toLocaleDateString()}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer hint */}
        {query.trim() && results.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-2">
            <p className="text-[11px] text-slate-400">
              <kbd className="rounded border border-slate-200 px-1">&#8593;&#8595;</kbd>{" "}
              navigate{" "}
              <kbd className="rounded border border-slate-200 px-1">Enter</kbd>{" "}
              open{" "}
              <kbd className="rounded border border-slate-200 px-1">Esc</kbd>{" "}
              close
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
