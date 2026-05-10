"use client";

import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">
        Welcome back, {user?.firstName}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {user?.role} &middot; {user?.organizationId}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open Tickets" value="—" />
        <StatCard label="Pending Inspections" value="—" />
        <StatCard label="Active Work Orders" value="—" />
        <StatCard label="Overdue Items" value="—" />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
