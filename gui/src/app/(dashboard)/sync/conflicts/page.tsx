"use client";

import { useSync } from "@/lib/sync-context";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function ConflictResolutionPage() {
  const router = useRouter();
  const { conflicts, resolveConflict } = useSync();
  const [resolvingIndex, setResolvingIndex] = useState(0);

  // We are treating conflicts like a queue for mobile wizard-style resolution
  const conflict = conflicts[resolvingIndex];

  if (!conflict) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mb-4 rounded-full bg-green-100 p-4 text-green-700">
          <CheckCircle2 className="h-12 w-12" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-slate-900">All Conflicts Resolved</h2>
        <p className="mb-8 text-center text-slate-500">You can now safely sync your changes.</p>
        <button
          onClick={() => router.push("/sync")}
          className="rounded-lg bg-brand-700 px-6 py-3 font-semibold text-white hover:bg-brand-600"
        >
          Return to Sync Status
        </button>
      </div>
    );
  }

  const handleResolve = async (resolution: "server" | "client") => {
    await resolveConflict(conflict.entityType, conflict.entityId, resolution, conflict.field);
    // When resolved, the conflict array length shrinks, so resolvingIndex could stay 0 to point to the new first item.
    // For visual flow, we just let it stay 0, which pops the next conflict into view.
  };

  return (
    <div className="pb-24 lg:pb-8">
      {/* Mobile Header */}
      <div className="lg:hidden mb-6 flex items-center bg-white p-4 shadow-sm border-b border-slate-200 -mx-4 -mt-6">
        <button onClick={() => router.back()} className="mr-4 text-brand-700">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold text-slate-900">Sync Conflict</h1>
      </div>

      <div className="hidden lg:block mb-6 flex items-center">
         <button onClick={() => router.back()} className="mr-4 text-brand-700 inline-block align-middle">
          <ArrowLeft className="h-6 w-6 inline" />
        </button>
        <h1 className="text-2xl font-bold text-slate-900 inline-block align-middle">Sync Conflict</h1>
      </div>

      {/* Warning Banner */}
      <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
        <p className="text-sm font-semibold text-red-600 mb-1">
          ⚠ {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} found during sync
        </p>
        <p className="text-xs text-red-800">
          Review and resolve each conflict to complete sync
        </p>
      </div>

      {/* Conflict Detail */}
      <div className="mb-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 rounded bg-red-50 p-2">
          <p className="text-sm font-semibold text-red-600">
            Conflict 1 of {conflicts.length} — {conflict.entityType} {conflict.entityId.slice(0,8)}
          </p>
        </div>

        <p className="mb-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
          FIELD: {conflict.field || "Entire Record"}
        </p>

        {/* Server Version */}
        <div className="mb-4 rounded-lg border border-brand-700 bg-brand-50 p-4 relative">
          <p className="text-xs font-bold text-brand-700 mb-2">SERVER VERSION (latest)</p>
          <p className="text-base font-medium text-slate-900 mb-2">
            {JSON.stringify(conflict.serverValue)}
          </p>
          <p className="text-[10px] text-slate-500">Updated by another user (Server v{conflict.serverVersion})</p>
          <div className="absolute top-4 right-4 text-brand-700">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>

        {/* Local Version */}
        <div className="mb-6 rounded-lg border border-slate-300 bg-slate-50 p-4 relative">
          <p className="text-xs font-bold text-slate-500 mb-2">YOUR VERSION (offline edit)</p>
          <p className="text-base font-medium text-slate-900 mb-2">
            {JSON.stringify(conflict.clientValue)}
          </p>
          <p className="text-[10px] text-slate-500">Edited by you (Local v{conflict.clientVersion})</p>
          <div className="absolute top-4 right-4 text-slate-400">
            <Circle className="h-6 w-6" />
          </div>
        </div>

        {/* Resolve Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => handleResolve("server")}
            className="flex-1 rounded-lg bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Use Server
          </button>
          <button
            onClick={() => handleResolve("client")}
            className="flex-1 rounded-lg border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Use Mine
          </button>
        </div>
      </div>

      {/* Remaining Conflicts Preview */}
      {conflicts.length > 1 && (
        <div className="mb-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 opacity-60">
          <div className="rounded bg-yellow-50 p-2">
            <p className="text-sm font-semibold text-yellow-800">
              Conflict 2 — {conflicts[1].entityType}
            </p>
            <p className="text-xs text-slate-500 mt-1">field: {conflicts[1].field || "unknown"} · Next in queue →</p>
          </div>
        </div>
      )}

    </div>
  );
}
