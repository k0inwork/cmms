"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet } from "@/lib/api-client";
import type { PaginatedResponse, Organization } from "@/types";
import {
  AssetTree,
  orgToNode,
  loadChildren,
  updateNodeInTree,
  findNodeInTree,
  type TreeNode,
} from "@/components/assets/asset-tree";
import { AssetDetail } from "@/components/assets/asset-detail";
import { AssetCreateModal } from "@/components/assets/asset-create-modal";
import { QRScanner } from "@/components/assets/qr-scanner";
import { MobileAssetDetail } from "@/components/assets/mobile-asset-detail";
import { ScanLine, Plus, Loader2 } from "lucide-react";

export default function AssetsPage() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // Load orgs on mount
  useEffect(() => {
    apiGet<PaginatedResponse<Organization>>("/organizations?limit=100")
      .then((res) => {
        setTree(res.data.map(orgToNode));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Refresh a node's children (re-fetch from API)
  const refreshTree = useCallback(() => {
    apiGet<PaginatedResponse<Organization>>("/organizations?limit=100")
      .then((res) => {
        setTree(res.data.map(orgToNode));
      })
      .catch(() => {});
  }, []);

  const handleToggle = useCallback(async (node: TreeNode) => {
    if (node.loaded && node.children.length > 0) {
      // Just toggle expand
      setTree((prev) =>
        updateNodeInTree(prev, node.id, (n) => ({ ...n, expanded: !n.expanded })),
      );
      return;
    }

    // Load children
    setTree((prev) =>
      updateNodeInTree(prev, node.id, (n) => ({ ...n, loading: true })),
    );

    try {
      const children = await loadChildren(node);
      setTree((prev) =>
        updateNodeInTree(prev, node.id, (n) => ({
          ...n,
          expanded: true,
          loaded: true,
          loading: false,
          children,
        })),
      );
    } catch {
      setTree((prev) =>
        updateNodeInTree(prev, node.id, (n) => ({ ...n, loading: false })),
      );
    }
  }, []);

  const handleSelect = useCallback((node: TreeNode) => {
    setSelectedId(node.id);
  }, []);

  const selectedNode = selectedId ? findNodeInTree(tree, selectedId) : null;
  const createParent = showCreate ? selectedNode ?? (tree.length > 0 ? tree[0] : null) : null;

  return (
    <>
      {/* Desktop layout */}
      <div className="hidden lg:grid lg:h-[calc(100vh-7rem)] lg:grid-cols-[300px_1fr] lg:gap-0 lg:-m-6">
        {/* Tree sidebar */}
        <div className="overflow-hidden border-r border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h1 className="text-lg font-semibold text-slate-900">Assets</h1>
            <div className="flex gap-1">
              <button
                onClick={() => setShowScanner(true)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="QR Scan"
              >
                <ScanLine className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="Add Asset"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <AssetTree
              nodes={tree}
              selectedId={selectedId}
              onSelect={handleSelect}
              onToggle={handleToggle}
              onRefresh={refreshTree}
            />
          )}
        </div>

        {/* Detail panel */}
        <div className="overflow-y-auto">
          {selectedNode ? (
            <AssetDetail
              node={selectedNode}
              allNodes={tree}
              onAddChild={(parent) => {
                setSelectedId(parent.id);
                setShowCreate(true);
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Select an asset from the tree to view details
            </div>
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Assets</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowScanner(true)}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
            >
              <ScanLine className="h-4 w-4" />
              Scan
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : !selectedNode ? (
          <div className="mt-4">
            <p className="mb-3 text-sm text-slate-500">Organizations</p>
            {tree.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  handleSelect(org);
                  if (!org.loaded) handleToggle(org);
                }}
                className="mb-2 flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left"
              >
                <div className="h-2 w-2 rounded-full bg-brand-500" />
                <span className="text-sm font-medium text-slate-900">{org.name}</span>
                <span className="ml-auto text-xs text-slate-400">Organization</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <MobileAssetDetail node={selectedNode} />
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && createParent && (
        <AssetCreateModal
          parentNode={createParent}
          onClose={() => setShowCreate(false)}
          onCreated={refreshTree}
        />
      )}
      {showScanner && <QRScanner onClose={() => setShowScanner(false)} />}
    </>
  );
}
