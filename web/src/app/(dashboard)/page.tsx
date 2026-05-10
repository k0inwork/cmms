"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiGet } from "@/lib/api-client";
import type {
  ComplianceReport,
  InspectionsReport,
  WorkOrdersReport,
  TechnicianProductivityReport,
} from "@/types";
import {
  Ticket,
  ClipboardCheck,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Users,
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-slate-400",
  TRIAGED: "bg-blue-400",
  ASSIGNED: "bg-blue-500",
  IN_PROGRESS: "bg-yellow-500",
  PENDING_REVIEW: "bg-orange-400",
  CLOSED: "bg-green-500",
  REOPENED: "bg-red-400",
  SUBMITTED: "bg-yellow-500",
  APPROVED: "bg-green-500",
  REJECTED: "bg-red-500",
  CHANGES_REQUESTED: "bg-orange-400",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-300",
  MEDIUM: "bg-blue-400",
  HIGH: "bg-orange-400",
  CRITICAL: "bg-red-500",
};

function formatHours(hours: number | null): string {
  if (hours === null) return "\u2014";
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  subtitle,
  trend,
  trendPositive,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  trendPositive?: boolean;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-3xl font-bold text-slate-900">{value}</p>
        {trend && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-semibold",
              trendPositive ? "text-green-600" : "text-red-600",
            )}
          >
            {trendPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {trend}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

function BarBreakdown({
  title,
  data,
  colorMap,
}: {
  title: string;
  data: Record<string, number>;
  colorMap: Record<string, string>;
}) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  if (total === 0) return null;
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 space-y-3">
        {entries.map(([status, count]) => {
          const pct = (count / total) * 100;
          return (
            <div key={status}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600">
                  {status.replace(/_/g, " ")}
                </span>
                <span className="text-slate-500">
                  {count} ({pct.toFixed(0)}%)
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    "h-full rounded-full",
                    colorMap[status] ?? "bg-slate-300",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProductivityTable({
  data,
}: {
  data: TechnicianProductivityReport["data"];
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">
          Technician Productivity
        </h3>
        <p className="mt-4 text-sm text-slate-400">No data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Technician Productivity
        </h3>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          View details
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
              <th className="px-5 py-2.5">Technician</th>
              <th className="px-5 py-2.5 text-right">Work Orders</th>
              <th className="px-5 py-2.5 text-right">Inspections</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 5).map((tech) => (
              <tr
                key={tech.technician_id}
                className="border-b border-slate-50 last:border-0"
              >
                <td className="px-5 py-2.5 text-sm text-slate-900">
                  {tech.name}
                </td>
                <td className="px-5 py-2.5 text-right text-sm text-slate-600">
                  {tech.work_orders_completed}
                </td>
                <td className="px-5 py-2.5 text-right text-sm text-slate-600">
                  {tech.inspections_completed}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Dashboard Page ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const [compliance, setCompliance] = useState<ComplianceReport | null>(null);
  const [inspections, setInspections] = useState<InspectionsReport | null>(
    null,
  );
  const [workOrders, setWorkOrders] = useState<WorkOrdersReport | null>(null);
  const [productivity, setProductivity] =
    useState<TechnicianProductivityReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReports() {
      const [c, i, w, p] = await Promise.all([
        apiGet<ComplianceReport>("/reports/compliance").catch(() => null),
        apiGet<InspectionsReport>("/reports/inspections").catch(() => null),
        apiGet<WorkOrdersReport>("/reports/work-orders").catch(() => null),
        apiGet<TechnicianProductivityReport>(
          "/reports/technician-productivity",
        ).catch(() => null),
      ]);
      setCompliance(c);
      setInspections(i);
      setWorkOrders(w);
      setProductivity(p);
      setLoading(false);
    }
    fetchReports();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
      </div>
    );
  }

  const openTickets = workOrders
    ? workOrders.summary.total - workOrders.summary.closed
    : null;
  const pendingInspections = inspections
    ? inspections.summary.total -
      (inspections.by_status["SUBMITTED"] ?? 0) -
      (inspections.by_status["APPROVED"] ?? 0)
    : null;
  const overdue = compliance?.summary.overdue ?? null;
  const slaCompliance = compliance?.summary.approval_rate ?? null;
  const avgResolution = workOrders?.summary.avg_completion_hours ?? null;
  const totalTechnicians = productivity?.data.length ?? null;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Welcome back, {user?.firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Operations Dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-400" />
          <span className="text-xs text-slate-400">
            Updated {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Open Tickets"
          value={openTickets ?? "\u2014"}
          icon={Ticket}
          subtitle={
            workOrders ? `of ${workOrders.summary.total} total` : undefined
          }
        />
        <KpiCard
          label="Pending Inspections"
          value={pendingInspections ?? "\u2014"}
          icon={ClipboardCheck}
          subtitle={
            inspections ? `${inspections.summary.total} total` : undefined
          }
        />
        <KpiCard
          label="Overdue"
          value={overdue ?? "\u2014"}
          icon={AlertTriangle}
          subtitle={
            overdue !== null && overdue > 0 ? "needs attention" : undefined
          }
        />
        <KpiCard
          label="SLA Compliance"
          value={
            slaCompliance !== null
              ? `${(slaCompliance * 100).toFixed(0)}%`
              : "\u2014"
          }
          icon={ShieldCheck}
          trend={
            slaCompliance !== null && slaCompliance >= 0.9 ? "Good" : undefined
          }
          trendPositive={slaCompliance !== null && slaCompliance >= 0.9}
        />
        <KpiCard
          label="Avg Resolution"
          value={
            avgResolution !== null ? formatHours(avgResolution) : "\u2014"
          }
          icon={Clock}
        />
        <KpiCard
          label="Technicians"
          value={totalTechnicians ?? "\u2014"}
          icon={Users}
          subtitle={productivity ? "active" : undefined}
        />
      </div>

      {/* Status Breakdown Row */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {workOrders && (
          <BarBreakdown
            title="Work Orders by Status"
            data={workOrders.by_status}
            colorMap={STATUS_COLORS}
          />
        )}
        {workOrders &&
          Object.keys(workOrders.by_priority).length > 0 && (
            <BarBreakdown
              title="Work Orders by Priority"
              data={workOrders.by_priority}
              colorMap={PRIORITY_COLORS}
            />
          )}
      </div>

      {/* Inspections + Productivity Row */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {inspections && (
          <BarBreakdown
            title="Inspections by Status"
            data={inspections.by_status}
            colorMap={STATUS_COLORS}
          />
        )}
        {productivity && <ProductivityTable data={productivity.data} />}
      </div>

      {/* Overdue Alert */}
      {compliance && compliance.summary.overdue > 0 && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h3 className="text-sm font-semibold text-red-800">
              {compliance.summary.overdue} Overdue Inspection
              {compliance.summary.overdue > 1 ? "s" : ""}
            </h3>
          </div>
          <p className="mt-1 text-sm text-red-700">
            {compliance.summary.overdue} inspection
            {compliance.summary.overdue > 1 ? "s are" : " is"} past due date
            and not yet completed.
          </p>
          <Link
            href="/inspections"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-800"
          >
            View inspections
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
