"use client";

import { useSync } from "@/lib/sync-context";
import { ArrowLeft, CheckCircle2, AlertTriangle, AlertCircle, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function SyncStatusPage() {
  const router = useRouter();
  const { status, pendingCount, syncedCount, failedCount, conflicts, lastSyncTime, syncNow } = useSync();

  const isOffline = status === "offline";

  return (
    <div className="pb-24 lg:pb-8">
      {/* Mobile Header */}
      <div className="lg:hidden mb-6 flex items-center bg-white p-4 shadow-sm border-b border-slate-200 -mx-4 -mt-6">
        <button onClick={() => router.back()} className="mr-4 text-brand-700">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold text-slate-900">Sync Status</h1>
      </div>

      <div className="hidden lg:block mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Sync Status</h1>
      </div>

      {/* Connection Status */}
      <div className="mb-6 flex items-center rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full mr-4", 
          isOffline ? "bg-slate-100 text-slate-500" : "bg-green-100 text-green-700"
        )}>
          {isOffline ? <AlertCircle className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {isOffline ? "Offline" : "Connected"}
          </h2>
          <p className="text-sm text-slate-500">
            Last sync: {lastSyncTime ? Math.round((Date.now() - lastSyncTime.getTime()) / 60000) + " minutes ago" : "Never"}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl bg-green-100/50 p-4 text-center">
          <p className="text-3xl font-bold text-green-800">{syncedCount}</p>
          <p className="text-xs font-semibold text-green-800 mt-1">SYNCED</p>
        </div>
        <div className="rounded-xl bg-yellow-100/50 p-4 text-center">
          <p className="text-3xl font-bold text-yellow-800">{pendingCount}</p>
          <p className="text-xs font-semibold text-yellow-800 mt-1">PENDING</p>
        </div>
        <div className="rounded-xl bg-red-100/50 p-4 text-center">
          <p className="text-3xl font-bold text-red-800">{failedCount}</p>
          <p className="text-xs font-semibold text-red-800 mt-1">FAILED</p>
        </div>
        <div className={cn("rounded-xl p-4 text-center relative", conflicts.length > 0 ? "bg-purple-100/50 cursor-pointer" : "bg-purple-100/50")} onClick={() => conflicts.length > 0 && router.push("/sync/conflicts")}>
          <p className="text-3xl font-bold text-purple-800">{conflicts.length}</p>
          <p className="text-xs font-semibold text-purple-800 mt-1">CONFLICTS</p>
          {conflicts.length > 0 && (
            <div className="absolute top-2 right-2 h-3 w-3 rounded-full bg-purple-500 animate-pulse" />
          )}
        </div>
      </div>

      {conflicts.length > 0 && (
         <div className="mb-8">
            <Link href="/sync/conflicts" className="block w-full text-center rounded-lg bg-purple-600 px-4 py-3 font-semibold text-white shadow-sm hover:bg-purple-500">
               Resolve {conflicts.length} Conflicts
            </Link>
         </div>
      )}

      {/* Pending Records */}
      <h3 className="mb-4 text-lg font-bold text-slate-900">Pending Upload</h3>
      <div className="space-y-3 mb-8">
        {pendingCount > 0 ? (
          <>
            <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-yellow-400" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Blade Insp. — WTG-HR-01</p>
                  <p className="text-xs text-slate-500">3 photos, 1 form · 12.4 MB</p>
                </div>
              </div>
              <span className="rounded bg-yellow-100 px-2 py-1 text-[10px] font-bold text-yellow-800">PENDING</span>
            </div>
            {/* Add more mock items if pendingCount > 1 */}
            {pendingCount > 1 && (
              <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                 <div className="flex items-center gap-3">
                 <div className="h-2 w-2 rounded-full bg-yellow-400" />
                 <div>
                    <p className="text-sm font-medium text-slate-900">Gearbox Insp. — WTG-HR-22</p>
                    <p className="text-xs text-slate-500">1 form · 0.8 MB</p>
                 </div>
                 </div>
                 <span className="rounded bg-yellow-100 px-2 py-1 text-[10px] font-bold text-yellow-800">PENDING</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-500 italic">No pending uploads.</p>
        )}
      </div>

      {/* Failed Records */}
      {failedCount > 0 && (
        <>
          <h3 className="mb-4 text-lg font-bold text-slate-900">Failed</h3>
          <div className="space-y-3 mb-8">
            <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Video — WTG-RB-05</p>
                  <p className="text-xs text-red-600">Upload failed: Network timeout</p>
                </div>
              </div>
              <button onClick={() => syncNow()} className="rounded bg-red-100 px-2 py-1 text-[10px] font-bold text-red-800 flex items-center gap-1">
                <RefreshCcw className="h-3 w-3" /> RETRY
              </button>
            </div>
          </div>
        </>
      )}

      {/* Sync All Button */}
      <div className="mt-8">
        <button
          onClick={() => syncNow()}
          disabled={status === "syncing" || isOffline}
          className="w-full rounded-lg bg-brand-700 px-4 py-3 font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
        >
          {status === "syncing" ? "Syncing..." : "Sync All Now"}
        </button>
      </div>
    </div>
  );
}
