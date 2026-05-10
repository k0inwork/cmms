"use client";

import { TreeNode, getBreadcrumb, CHILD_TYPE, TYPE_ICON, TYPE_LABEL } from "./asset-tree";
import { Plus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AssetDetailProps {
  node: TreeNode;
  allNodes: TreeNode[];
  onAddChild: (parentNode: TreeNode) => void;
}

export function AssetDetail({ node, allNodes, onAddChild }: AssetDetailProps) {
  const Icon = TYPE_ICON[node.type];
  const breadcrumb = getBreadcrumb(allNodes, node.id);
  const canAddChild = node.type !== "component";
  const childTypeLabel = CHILD_TYPE[node.type];

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 border-b border-slate-200 px-6 py-3 text-sm text-slate-500">
        {breadcrumb.map((n, i) => (
          <span key={n.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3" />}
            <span className={cn(i === breadcrumb.length - 1 ? "font-medium text-brand-600" : "hover:text-slate-700")}>
              {n.name}
            </span>
          </span>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
            <Icon className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{node.name}</h1>
            <div className="mt-0.5 flex items-center gap-2 text-sm text-slate-500">
              <span>{TYPE_LABEL[node.type]}</span>
              {node.status && (
                <>
                  <span>·</span>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    node.status === "ACTIVE" && "bg-green-100 text-green-700",
                    node.status === "MAINTENANCE" && "bg-yellow-100 text-yellow-700",
                    node.status === "DECOMMISSIONED" && "bg-red-100 text-red-700",
                    node.status === "PLANNED" && "bg-slate-100 text-slate-600",
                  )}>
                    {node.status}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        {canAddChild && (
          <button
            onClick={() => onAddChild(node)}
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Add {childTypeLabel && childTypeLabel.charAt(0).toUpperCase() + childTypeLabel.slice(1)}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Properties */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Properties</h2>
          </div>
          <dl className="divide-y divide-slate-100">
            <DetailRow label="ID" value={node.id} mono />
            <DetailRow label="Type" value={TYPE_LABEL[node.type]} />
            <DetailRow label="Name" value={node.name} />
            {node.status && <DetailRow label="Status" value={node.status} />}
          </dl>
        </div>

        {/* Children */}
        {canAddChild && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Children ({node.children.length})
              </h2>
            </div>
            {node.children.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">
                {!node.loaded
                  ? "Expand this node in the tree to load children"
                  : `No ${childTypeLabel}s found`}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {node.children.map((child) => {
                  const ChildIcon = TYPE_ICON[child.type];
                  return (
                    <li key={child.id}>
                      <Link
                        href={`/assets/${child.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50"
                      >
                        <ChildIcon className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-900">{child.name}</span>
                        {child.status && child.status !== "ACTIVE" && (
                          <span className={cn(
                            "ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold",
                            child.status === "MAINTENANCE" && "bg-yellow-100 text-yellow-700",
                            child.status === "DECOMMISSIONED" && "bg-red-100 text-red-700",
                          )}>
                            {child.status}
                          </span>
                        )}
                        <ChevronRight className="ml-1 h-4 w-4 text-slate-300" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Quick actions for mobile */}
        <div className="mt-6 lg:hidden">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/assets/scan`}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              QR Scan
            </Link>
            <Link
              href={`/tickets`}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Create Ticket
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center px-4 py-2.5 text-sm">
      <dt className="w-32 shrink-0 text-slate-500">{label}</dt>
      <dd className={cn("text-slate-900", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}
