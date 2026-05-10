"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet } from "@/lib/api-client";
import type { PaginatedResponse, Organization } from "@/types";
import {
  orgToNode,
  loadChildren,
  updateNodeInTree,
  findNodeInTree,
  getBreadcrumb,
  type TreeNode,
} from "@/components/assets/asset-tree";
import { TYPE_ICON, TYPE_LABEL, CHILD_TYPE } from "@/components/assets/asset-tree";
import { AssetCreateModal } from "@/components/assets/asset-create-modal";
import { MobileAssetDetail } from "@/components/assets/mobile-asset-detail";
import { Plus, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function AssetDetailPage() {
  const params = useParams();
  const assetId = params.id as string;
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    apiGet<PaginatedResponse<Organization>>("/organizations?limit=100")
      .then(async (res) => {
        const roots = res.data.map(orgToNode);
        setTree(roots);

        // Try to expand down to the target asset
        await expandToAsset(roots, assetId, setTree);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [assetId]);

  const refreshTree = useCallback(() => {
    apiGet<PaginatedResponse<Organization>>("/organizations?limit=100")
      .then((res) => setTree(res.data.map(orgToNode)))
      .catch(() => {});
  }, []);

  const node = findNodeInTree(tree, assetId);
  const breadcrumb = node ? getBreadcrumb(tree, node.id) : [];
  const canAddChild = node ? node.type !== "component" : false;
  const childTypeLabel = node && canAddChild ? CHILD_TYPE[node.type] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!node) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">Asset not found</p>
        <Link href="/assets" className="mt-2 inline-block text-sm text-brand-600 hover:underline">
          Back to Assets
        </Link>
      </div>
    );
  }

  const Icon = TYPE_ICON[node.type];

  return (
    <>
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-1 text-sm text-slate-500">
        <Link href="/assets" className="text-brand-600 hover:underline">Assets</Link>
        {breadcrumb.map((n, i) => (
            <span key={n.id} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              {i < breadcrumb.length - 1 ? (
                <Link href={`/assets/${n.id}`} className="hover:text-slate-700">
                  {n.name}
                </Link>
              ) : (
                <span className="font-medium text-brand-600">{n.name}</span>
              )}
            </span>
        ))}
      </div>

      {/* Mobile detail */}
      <div className="lg:hidden">
        <MobileAssetDetail node={node} />
      </div>

      {/* Desktop detail */}
      <div className="hidden lg:block">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
              <Icon className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{node.name}</h1>
              <p className="text-sm text-slate-500">
                {TYPE_LABEL[node.type]}
                {node.status && (
                  <span className={cn(
                    "ml-2 rounded-full px-2 py-0.5 text-xs font-semibold",
                    node.status === "ACTIVE" && "bg-green-100 text-green-700",
                    node.status === "MAINTENANCE" && "bg-yellow-100 text-yellow-700",
                    node.status === "DECOMMISSIONED" && "bg-red-100 text-red-700",
                    node.status === "PLANNED" && "bg-slate-100 text-slate-600",
                  )}>
                    {node.status}
                  </span>
                )}
              </p>
            </div>
          </div>
          {canAddChild && childTypeLabel && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              Add {childTypeLabel.charAt(0).toUpperCase() + childTypeLabel.slice(1)}
            </button>
          )}
        </div>

        {/* Properties card */}
        <div className="mt-6 rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Properties</h2>
          </div>
          <dl className="divide-y divide-slate-100">
            <PropRow label="ID" value={node.id} mono />
            <PropRow label="Type" value={TYPE_LABEL[node.type]} />
            <PropRow label="Name" value={node.name} />
            {node.status && <PropRow label="Status" value={node.status} />}
          </dl>
        </div>

        {/* Children list */}
        {canAddChild && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Children ({node.children.length})
              </h2>
            </div>
            {node.children.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                {node.loaded ? `No children found` : "Expand in tree to load children"}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {node.children.map((child) => {
                  const CIcon = TYPE_ICON[child.type];
                  return (
                    <li key={child.id}>
                      <Link
                        href={`/assets/${child.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50"
                      >
                        <CIcon className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-900">{child.name}</span>
                        <ChevronRight className="ml-auto h-4 w-4 text-slate-300" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && node && (
        <AssetCreateModal
          parentNode={node}
          onClose={() => setShowCreate(false)}
          onCreated={refreshTree}
        />
      )}
    </>
  );
}

function PropRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center px-4 py-2.5 text-sm">
      <dt className="w-32 shrink-0 text-slate-500">{label}</dt>
      <dd className={cn("text-slate-900", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}

// Recursively expand tree to find the target asset
async function expandToAsset(
  nodes: TreeNode[],
  targetId: string,
  setter: React.Dispatch<React.SetStateAction<TreeNode[]>>,
  path: string[] = [],
): Promise<boolean> {
  for (const node of nodes) {
    if (node.id === targetId) return true;
    if (node.type === "component") continue;

    try {
      const children = await loadChildren(node);
      const updated = { ...node, expanded: true, loaded: true, loading: false, children };
      setter((prev) => updateNodeInTree(prev, node.id, () => updated));

      if (children.some((c) => c.id === targetId)) return true;
      if (await expandToAsset(children, targetId, setter, [...path, node.id])) return true;
    } catch {
      continue;
    }
  }
  return false;
}
