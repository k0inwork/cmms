"use client";

import { TreeNode, TYPE_ICON, TYPE_LABEL } from "./asset-tree";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface MobileAssetDetailProps {
  node: TreeNode;
}

export function MobileAssetDetail({ node }: MobileAssetDetailProps) {
  const Icon = TYPE_ICON[node.type];

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
            <Icon className="h-5 w-5 text-brand-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-slate-900">{node.name}</h1>
            <p className="text-sm text-slate-500">{TYPE_LABEL[node.type]}</p>
          </div>
          {node.status && (
            <span className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              node.status === "ACTIVE" && "bg-green-100 text-green-700",
              node.status === "MAINTENANCE" && "bg-yellow-100 text-yellow-700",
              node.status === "DECOMMISSIONED" && "bg-red-100 text-red-700",
              node.status === "PLANNED" && "bg-slate-100 text-slate-600",
            )}>
              {node.status}
            </span>
          )}
        </div>
      </div>

      {/* Properties */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-900">Properties</h2>
        </div>
        <dl className="divide-y divide-slate-100 px-4">
          <MobileDetailRow label="ID" value={node.id} />
          <MobileDetailRow label="Type" value={TYPE_LABEL[node.type]} />
          <MobileDetailRow label="Name" value={node.name} />
          {node.status && <MobileDetailRow label="Status" value={node.status} />}
        </dl>
      </div>

      {/* Children */}
      {node.children.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-slate-900">
              Components ({node.children.length})
            </h2>
          </div>
          <ul>
            {node.children.map((child) => {
              const ChildIcon = TYPE_ICON[child.type];
              return (
                <li key={child.id}>
                  <Link
                    href={`/assets/${child.id}`}
                    className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0"
                  >
                    <div className="h-1 w-1 rounded-full bg-green-500" />
                    <ChildIcon className="h-4 w-4 text-slate-400" />
                    <span className="flex-1 text-sm text-slate-900">{child.name}</span>
                    {child.status && child.status !== "ACTIVE" && (
                      <span className="text-xs text-slate-500">{child.status}</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/tickets"
          className="flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"
        >
          Create Ticket
        </Link>
        <Link
          href="/inspections"
          className="flex items-center justify-center rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white"
        >
          Start Inspection
        </Link>
      </div>
    </div>
  );
}

function MobileDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{value}</dd>
    </div>
  );
}
