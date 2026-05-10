"use client";

import { apiGet } from "@/lib/api-client";
import type { PaginatedResponse, Organization, AssetType } from "@/types";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  Building2,
  MapPin,
  Wind,
  Settings2,
  Wrench,
  Loader2,
} from "lucide-react";

export interface TreeNode {
  id: string;
  name: string;
  type: AssetType;
  status?: string;
  expanded: boolean;
  loaded: boolean;
  loading: boolean;
  children: TreeNode[];
  childrenApiPath: string | null;
}

export const TYPE_ICON: Record<AssetType, React.ElementType> = {
  organization: Building2,
  site: MapPin,
  turbine: Wind,
  subsystem: Settings2,
  component: Wrench,
};

export const CHILD_TYPE: Record<string, AssetType | null> = {
  organization: "site",
  site: "turbine",
  turbine: "subsystem",
  subsystem: "component",
  component: null,
};

export const TYPE_LABEL: Record<AssetType, string> = {
  organization: "Organization",
  site: "Site",
  turbine: "Turbine",
  subsystem: "Subsystem",
  component: "Component",
};

const GRANDCHILD_SEGMENT: Record<string, string | null> = {
  site: "turbines",
  turbine: "subsystems",
  subsystem: "components",
  component: null,
  organization: null,
};

interface AssetTreeProps {
  nodes: TreeNode[];
  selectedId: string | null;
  onSelect: (node: TreeNode) => void;
  onToggle: (node: TreeNode) => void;
  onRefresh: () => void;
}

export function AssetTree({ nodes, selectedId, onSelect, onToggle }: AssetTreeProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700">Asset Tree</h2>
      </div>
      <div className="p-2">
        {nodes.length === 0 && (
          <p className="px-2 py-4 text-sm text-slate-400">No organizations found</p>
        )}
        {nodes.map((node) => (
          <TreeNodeItem
            key={node.id}
            node={node}
            selectedId={selectedId}
            onSelect={onSelect}
            onToggle={onToggle}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
}

interface TreeNodeItemProps {
  node: TreeNode;
  selectedId: string | null;
  onSelect: (node: TreeNode) => void;
  onToggle: (node: TreeNode) => void;
  depth: number;
}

function TreeNodeItem({ node, selectedId, onSelect, onToggle, depth }: TreeNodeItemProps) {
  const Icon = TYPE_ICON[node.type];
  const hasChildren = node.type !== "component";
  const isSelected = selectedId === node.id;

  return (
    <div>
      <button
        onClick={() => {
          onSelect(node);
          if (hasChildren) onToggle(node);
        }}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50",
          isSelected && "bg-brand-50 text-brand-700",
          !isSelected && "text-slate-700",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          node.loading ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" />
          ) : node.expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{node.name}</span>
        {node.status && node.status !== "ACTIVE" && (
          <span className={cn(
            "ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold",
            node.status === "MAINTENANCE" && "bg-yellow-100 text-yellow-700",
            node.status === "DECOMMISSIONED" && "bg-red-100 text-red-700",
            node.status === "PLANNED" && "bg-slate-100 text-slate-500",
          )}>
            {node.status}
          </span>
        )}
      </button>
      {node.expanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tree data helpers ────────────────────────────────────────────────────────

export function orgToNode(org: Organization): TreeNode {
  return {
    id: org.id,
    name: org.name,
    type: "organization",
    expanded: false,
    loaded: false,
    loading: false,
    children: [],
    childrenApiPath: `/organizations/${org.id}/sites`,
  };
}

export async function loadChildren(node: TreeNode): Promise<TreeNode[]> {
  if (!node.childrenApiPath) return [];

  const res = await apiGet<PaginatedResponse<Record<string, unknown>>>(`${node.childrenApiPath}?limit=100`);
  const childType = CHILD_TYPE[node.type];
  if (!childType) return [];

  const grandchildSegment = GRANDCHILD_SEGMENT[childType];

  return res.data.map((item) => {
    const child: TreeNode = {
      id: item.id as string,
      name: item.name as string,
      type: childType,
      status: item.status as string | undefined,
      expanded: false,
      loaded: false,
      loading: false,
      children: [],
      childrenApiPath: grandchildSegment
        ? `${node.childrenApiPath}/${item.id}/${grandchildSegment}`
        : null,
    };
    return child;
  });
}

export function updateNodeInTree(nodes: TreeNode[], targetId: string, updater: (n: TreeNode) => TreeNode): TreeNode[] {
  return nodes.map((n) => {
    if (n.id === targetId) return updater(n);
    if (n.children.length > 0) {
      return { ...n, children: updateNodeInTree(n.children, targetId, updater) };
    }
    return n;
  });
}

export function findNodeInTree(nodes: TreeNode[], targetId: string): TreeNode | null {
  for (const n of nodes) {
    if (n.id === targetId) return n;
    if (n.children.length > 0) {
      const found = findNodeInTree(n.children, targetId);
      if (found) return found;
    }
  }
  return null;
}

export function getBreadcrumb(nodes: TreeNode[], targetId: string): TreeNode[] {
  const path: TreeNode[] = [];
  function walk(list: TreeNode[]): boolean {
    for (const n of list) {
      path.push(n);
      if (n.id === targetId) return true;
      if (n.children.length > 0 && walk(n.children)) return true;
      path.pop();
    }
    return false;
  }
  walk(nodes);
  return path;
}
