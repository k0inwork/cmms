"use client";

import { useState } from "react";
import { apiGet, getApiBase } from "@/lib/api-client";
import type {
  ComplianceReport,
  InspectionsReport,
  WorkOrdersReport,
  TechnicianProductivityReport,
} from "@/types";
import {
  BarChart3,
  ClipboardCheck,
  Wrench,
  Users,
  Download,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ReportType = "compliance" | "inspections" | "work-orders" | "technician-productivity";

const REPORT_CARDS: { key: ReportType; label: string; icon: React.ElementType; description: string }[] = [
  { key: "compliance", label: "Compliance Report", icon: ClipboardCheck, description: "Inspection compliance metrics and overdue items" },
  { key: "inspections", label: "Inspections Report", icon: BarChart3, description: "Inspection status breakdown with timing" },
  { key: "work-orders", label: "Work Orders Report", icon: Wrench, description: "Work order status and priority breakdown" },
  { key: "technician-productivity", label: "Technician Productivity", icon: Users, description: "Per-technician completion stats" },
];

export default function ReportsPage() {
  const [selected, setSelected] = useState<ReportType | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reportData, setReportData] = useState<any>(null);
  const [error, setError] = useState("");

  const [loadingType, setLoadingType] = useState<ReportType | null>(null);

  const runReport = async (type: ReportType, format: "json" | "csv" = "json") => {
    setLoadingType(type);
    setError("");
    setReportData(null);
    try {
      const params = new URLSearchParams({ format });
      if (dateFrom) params.set("dateFrom", new Date(dateFrom).toISOString());
      if (dateTo) params.set("dateTo", new Date(dateTo + "T23:59:59").toISOString());

      if (format === "csv") {
        // Trigger download
        const token = localStorage.getItem("cmms_access_token");
        const url = `${getApiBase()}/reports/${type}?${params.toString()}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("Download failed");
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${type}-report.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        setLoadingType(null);
        return;
      }

      const data = await apiGet<any>(`/reports/${type}?${params.toString()}`);
      setSelected(type);
      setReportData(data);
    } catch (e: any) {
      setError(e?.message || "Failed to generate report");
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
      <p className="mt-1 text-sm text-slate-500">
        Generate and export compliance, productivity, and status reports.
      </p>

      {/* Date Range */}
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Report Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {REPORT_CARDS.map((card) => (
          <div key={card.key} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-brand-50 p-2">
                  <card.icon className="h-5 w-5 text-brand-600" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900">{card.label}</h3>
                  <p className="text-xs text-slate-500">{card.description}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => runReport(card.key)}
                disabled={loadingType !== null}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {loadingType === card.key ? "Loading..." : "Generate"}
              </button>
              <button
                onClick={() => runReport(card.key, "csv")}
                disabled={loadingType !== null}
                className="flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Report Output */}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {reportData && selected === "compliance" && <ComplianceView data={reportData as ComplianceReport} />}
      {reportData && selected === "inspections" && <InspectionsView data={reportData as InspectionsReport} />}
      {reportData && selected === "work-orders" && <WorkOrdersView data={reportData as WorkOrdersReport} />}
      {reportData && selected === "technician-productivity" && <ProductivityView data={reportData as TechnicianProductivityReport} />}
    </div>
  );
}

function ComplianceView({ data }: { data: ComplianceReport }) {
  const { summary, by_status } = data;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-medium text-slate-900">Compliance Report</h2>
      <p className="text-xs text-slate-500">Generated {new Date(data.generated_at).toLocaleString()}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        <MetricCard label="Total" value={summary.total_inspections} icon={ClipboardCheck} />
        <MetricCard label="Completed" value={summary.completed} icon={CheckCircle2} color="text-green-600" />
        <MetricCard label="Overdue" value={summary.overdue} icon={AlertTriangle} color="text-red-600" />
        <MetricCard label="Approval Rate" value={pct(summary.approval_rate)} icon={TrendingUp} />
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-medium text-slate-700">By Status</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(by_status).map(([status, count]) => (
            <span key={status} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {status}: {count}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function InspectionsView({ data }: { data: InspectionsReport }) {
  const { summary, by_status } = data;

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-medium text-slate-900">Inspections Report</h2>
      <p className="text-xs text-slate-500">Generated {new Date(data.generated_at).toLocaleString()}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total" value={summary.total} icon={ClipboardCheck} />
        <MetricCard label="Avg Completion" value={summary.avg_completion_hours !== null ? `${summary.avg_completion_hours.toFixed(1)}h` : "N/A"} icon={Clock} />
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-medium text-slate-700">By Status</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(by_status).map(([status, count]) => (
            <span key={status} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {status}: {count}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkOrdersView({ data }: { data: WorkOrdersReport }) {
  const { summary, by_status, by_priority } = data;

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-medium text-slate-900">Work Orders Report</h2>
      <p className="text-xs text-slate-500">Generated {new Date(data.generated_at).toLocaleString()}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total" value={summary.total} icon={Wrench} />
        <MetricCard label="Closed" value={summary.closed} icon={CheckCircle2} color="text-green-600" />
        <MetricCard label="Avg Completion" value={summary.avg_completion_hours !== null ? `${summary.avg_completion_hours.toFixed(1)}h` : "N/A"} icon={Clock} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-slate-700">By Status</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(by_status).map(([status, count]) => (
              <span key={status} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {status}: {count}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium text-slate-700">By Priority</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(by_priority).map(([priority, count]) => (
              <span key={priority} className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
                priority === "CRITICAL" ? "bg-red-100 text-red-800" :
                priority === "HIGH" ? "bg-orange-100 text-orange-800" :
                priority === "MEDIUM" ? "bg-yellow-100 text-yellow-800" :
                "bg-green-100 text-green-800"
              )}>
                {priority}: {count}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductivityView({ data }: { data: TechnicianProductivityReport }) {
  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-medium text-slate-900">Technician Productivity</h2>
      <p className="text-xs text-slate-500">Generated {new Date(data.generated_at).toLocaleString()}</p>

      {data.data.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No data available for the selected period.</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Technician</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Email</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Work Orders</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Inspections</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {data.data.map((row) => (
                <tr key={row.technician_id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">{row.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{row.email}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-slate-900">{row.work_orders_completed}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-slate-900">{row.inspections_completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", color || "text-slate-400")} />
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className={cn("mt-1 text-xl font-semibold", color || "text-slate-900")}>{value}</p>
    </div>
  );
}

function Clock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
