"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Search, X, Loader2, Ticket, Wrench, ClipboardCheck, Wind, Box } from "lucide-react";
import Link from "next/link";

interface SearchHit {
  id: string;
  type: "TICKET" | "WORK_ORDER" | "INSPECTION" | "TURBINE" | "COMPONENT";
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: { id: string; firstName: string; lastName: string } | null;
  turbine: { id: string; name: string } | null;
  site: { id: string; name: string } | null;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  TICKET: Ticket,
  WORK_ORDER: Wrench,
  INSPECTION: ClipboardCheck,
  TURBINE: Wind,
  COMPONENT: Box,
};

const TYPE_ROUTE: Record<string, string> = {
  TICKET: "/tickets",
  WORK_ORDER: "/work-orders",
  INSPECTION: "/inspections",
  TURBINE: "/assets",
  COMPONENT: "/assets",
};

const TYPE_BADGE: Record<string, string> = {
  TICKET: "bg-blue-50 text-blue-700",
  WORK_ORDER: "bg-purple-50 text-purple-700",
  INSPECTION: "bg-green-50 text-green-700",
  TURBINE: "bg-indigo-50 text-indigo-700",
  COMPONENT: "bg-slate-50 text-slate-700",
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiGet<{ data: SearchHit[] }>(`/search?q=${encodeURIComponent(q)}&limit=8`);
      setResults(res.data);
      setOpen(res.data.length > 0);
      setSelectedIdx(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
      if (open) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIdx((prev) => Math.min(prev + 1, results.length - 1));
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIdx((prev) => Math.max(prev - 1, 0));
        }
        if (e.key === "Enter" && results[selectedIdx]) {
          setOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, selectedIdx]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative hidden lg:block">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder="Search... (Ctrl+K)"
          className="w-72 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {loading && (
          <Loader2 className="absolute right-8 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full z-50 mt-1 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="max-h-96 overflow-y-auto py-1">
            {results.map((hit, idx) => {
              const Icon = TYPE_ICON[hit.type] ?? Ticket;
              const route = `${TYPE_ROUTE[hit.type]}/${hit.id}`;
              return (
                <Link
                  key={`${hit.type}-${hit.id}`}
                  href={route}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50",
                    idx === selectedIdx && "bg-brand-50",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{hit.title}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", TYPE_BADGE[hit.type])}>
                        {hit.type.replace("_", " ")}
                      </span>
                      {hit.status && <span>{hit.status.replace("_", " ")}</span>}
                      {hit.assignee && <span>{hit.assignee.firstName} {hit.assignee.lastName}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
