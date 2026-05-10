"use client";

import { useAuth } from "@/lib/auth-context";
import { useSync } from "@/lib/sync-context";
import { QrCode, XCircle, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function MobileHome() {
  const { user } = useAuth();
  const { status, pendingCount, failedCount, conflicts, syncNow } = useSync();

  const isOffline = status === "offline";
  const hasIssues = failedCount > 0 || conflicts.length > 0;

  return (
    <div className="pb-24 lg:hidden">
      {/* Sync Status Banner */}
      <Link href="/sync">
        <div className={cn(
          "mb-6 flex items-center justify-between rounded-lg px-4 py-3 shadow-sm",
          isOffline ? "bg-slate-200" : hasIssues ? "bg-red-100" : pendingCount > 0 ? "bg-yellow-100" : "bg-green-100"
        )}>
          <div className="flex items-center gap-3">
            {isOffline ? (
              <AlertCircle className="h-5 w-5 text-slate-500" />
            ) : hasIssues ? (
              <XCircle className="h-5 w-5 text-red-600" />
            ) : (
              <div className={cn("h-2.5 w-2.5 rounded-full", pendingCount > 0 ? "bg-yellow-500" : "bg-green-500")} />
            )}
            <span className={cn(
              "text-sm font-medium",
              isOffline ? "text-slate-700" : hasIssues ? "text-red-800" : pendingCount > 0 ? "text-yellow-800" : "text-green-800"
            )}>
              {isOffline ? "Offline" : hasIssues ? `${conflicts.length} conflicts, ${failedCount} failed` : pendingCount > 0 ? `${pendingCount} pending upload` : "All data synced"}
            </span>
          </div>
          <span className={cn(
            "text-xs",
            isOffline ? "text-slate-500" : hasIssues ? "text-red-700" : pendingCount > 0 ? "text-yellow-700" : "text-green-700"
          )}>
            ●
          </span>
        </div>
      </Link>

      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Today's Inspections</h2>
        <Link href="/inspections" className="text-sm font-semibold text-brand-700">
          See all
        </Link>
      </div>

      <div className="space-y-4 mb-8">
        {/* Mock Inspection 1 */}
        <div className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-red-500" />
          <div className="flex justify-between items-start mb-1">
            <h3 className="font-semibold text-slate-900 text-sm pl-2">Blade Inspection — WTG-HR-01</h3>
            <span className="rounded-full border border-yellow-400 bg-yellow-100 px-2.5 py-0.5 text-[10px] font-bold text-yellow-800">
              ASSIGNED
            </span>
          </div>
          <p className="text-xs text-slate-500 pl-2 mb-2">Hornsea Reef · Trailing Edge</p>
          <p className="text-xs font-semibold text-red-600 pl-2">DUE: 14:00 · HIGH PRIORITY</p>
        </div>

        {/* Mock Inspection 2 */}
        <div className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-brand-500" />
          <div className="flex justify-between items-start mb-1">
            <h3 className="font-semibold text-slate-900 text-sm pl-2">Gearbox Inspection — WTG-HR-22</h3>
            <span className="rounded-full border border-brand-300 bg-brand-100 px-2.5 py-0.5 text-[10px] font-bold text-brand-800">
              PRE-LOADED
            </span>
          </div>
          <p className="text-xs text-slate-500 pl-2 mb-2">Hornsea Reef · Main Bearing</p>
          <p className="text-xs font-semibold text-brand-600 pl-2">DUE: 16:00 · MEDIUM</p>
        </div>
      </div>

      <h2 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button className="flex flex-col items-center justify-center rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 rounded-xl bg-brand-50 p-3 text-brand-600">
            <QrCode className="h-6 w-6" />
          </div>
          <span className="text-xs font-semibold text-slate-900">Scan QR Code</span>
        </button>
        <button className="flex flex-col items-center justify-center rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 rounded-xl bg-red-50 p-3 text-red-600">
            <XCircle className="h-6 w-6" />
          </div>
          <span className="text-xs font-semibold text-slate-900">Report Absence</span>
        </button>
      </div>

      <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Activity</h2>
      <div className="space-y-3">
        <div className="flex items-center gap-4 rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">Blade Insp. WTG-RB-05</p>
            <p className="text-xs text-slate-500">Submitted · 2 hours ago</p>
          </div>
        </div>
      </div>
    </div>
  );
}
