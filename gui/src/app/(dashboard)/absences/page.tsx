"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { AbsenceRecord, PaginatedResponse, AdminUser } from "@/types";
import {
  CalendarDays,
  Loader2,
  Search,
  Filter,
  User,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  SICK: { label: "Sick", color: "bg-red-100 text-red-800" },
  PERSONAL_LEAVE: { label: "Personal Leave", color: "bg-purple-100 text-purple-800" },
  TRAINING: { label: "Training", color: "bg-blue-100 text-blue-800" },
  VACATION: { label: "Vacation", color: "bg-green-100 text-green-800" },
  OTHER: { label: "Other", color: "bg-slate-100 text-slate-800" },
};

export default function AbsencesPage() {
  const { user } = useAuth();
  const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
  const [technicians, setTechnicians] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTech, setSelectedTech] = useState<string>("");
  const [search, setSearch] = useState("");
  const canView =
    user?.role === "DISPATCHER" ||
    user?.role === "ADMINISTRATOR" ||
    user?.role === "OPERATIONS_MANAGER";

  const loadTechnicians = useCallback(async () => {
    try {
      const res = await apiGet<PaginatedResponse<AdminUser>>("/admin/users?limit=100");
      const techs = res.data
        .filter((u) => u.role === "TECHNICIAN")
        .map((u) => ({ id: u.id, name: `${u.first_name} ${u.last_name}` }));
      setTechnicians(techs);
    } catch {
      // ignore
    }
  }, []);

  const loadAbsences = useCallback(async (techId?: string, cur?: string) => {
    setLoading(true);
    try {
      if (techId) {
        const res = await apiGet<AbsenceRecord[]>(
          `/technicians/${techId}/absence-history${cur ? `?cursor=${cur}` : ""}`,
        );
        if (cur) {
          setAbsences((prev) => [...prev, ...res]);
        } else {
          setAbsences(res);
        }
      } else {
        // Load all: fetch from each technician (limited)
        const techRes = await apiGet<PaginatedResponse<AdminUser>>("/admin/users?limit=50");
        const techs = techRes.data.filter((u) => u.role === "TECHNICIAN");
        const allAbsences: AbsenceRecord[] = [];
        for (const tech of techs.slice(0, 20)) {
          try {
            const abs = await apiGet<AbsenceRecord[]>(`/technicians/${tech.id}/absence-history`);
            allAbsences.push(...abs);
          } catch {
            // skip
          }
        }
        allAbsences.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setAbsences(allAbsences);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTechnicians();
    loadAbsences();
  }, [loadTechnicians, loadAbsences]);

  useEffect(() => {
    if (selectedTech) {
      loadAbsences(selectedTech);
    } else {
      loadAbsences();
    }
  }, [selectedTech]);

  const filtered = search
    ? absences.filter(
        (a) =>
          a.reason.toLowerCase().includes(search.toLowerCase()) ||
          (a.notes && a.notes.toLowerCase().includes(search.toLowerCase())) ||
          a.id.toLowerCase().includes(search.toLowerCase()),
      )
    : absences;

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-slate-300" />
        <p className="mt-4 text-lg font-medium text-slate-500">Dispatcher or Manager access required</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Absence History</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track technician absences and leave records
          </p>
        </div>
        <button
          onClick={() => loadAbsences(selectedTech || undefined)}
          className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reason or notes..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={selectedTech}
            onChange={(e) => setSelectedTech(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All technicians</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <CalendarDays className="mb-3 h-12 w-12" />
          <p className="text-sm font-medium">No absence records found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Technician</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Reason</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 sm:table-cell">Start Date</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 md:table-cell">Expected Return</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Approved</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 lg:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((abs) => {
                const reason = REASON_LABELS[abs.reason] ?? REASON_LABELS.OTHER;
                return (
                  <tr key={abs.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" />
                        <span className="font-medium">{abs.user_id.slice(0, 8)}...</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", reason.color)}>
                        {reason.label}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-slate-600 sm:table-cell">
                      {new Date(abs.start_date).toLocaleDateString()}
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-slate-600 md:table-cell">
                      {abs.expected_return_date
                        ? new Date(abs.expected_return_date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {abs.is_approved ? (
                        <span className="text-xs font-medium text-green-700">Yes</span>
                      ) : (
                        <span className="text-xs font-medium text-red-600">Pending</span>
                      )}
                    </td>
                    <td className="hidden max-w-[200px] truncate px-4 py-3 text-xs text-slate-500 lg:table-cell">
                      {abs.notes || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
