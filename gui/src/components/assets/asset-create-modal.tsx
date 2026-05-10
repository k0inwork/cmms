"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api-client";
import type { TreeNode } from "./asset-tree";
import { X, Loader2 } from "lucide-react";

interface AssetCreateModalProps {
  parentNode: TreeNode | null;
  onClose: () => void;
  onCreated: () => void;
}

const CHILD_TYPE_LABEL: Record<string, string> = {
  organization: "Site",
  site: "Turbine",
  turbine: "Subsystem",
  subsystem: "Component",
};

interface FormData {
  name: string;
  status: string;
  model: string;
  type: string;
  time_zone: string;
}

export function AssetCreateModal({ parentNode, onClose, onCreated }: AssetCreateModalProps) {
  const [form, setForm] = useState<FormData>({
    name: "",
    status: "ACTIVE",
    model: "",
    type: "",
    time_zone: "UTC",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!parentNode) return null;

  const childType = CHILD_TYPE_LABEL[parentNode.type];
  if (!childType) return null;

  const parent = parentNode;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const path = parent.childrenApiPath;
      if (!path) throw new Error("Cannot create children here");

      const body: Record<string, unknown> = { name: form.name };

      if (parent.type === "organization") {
        body.time_zone = form.time_zone;
      } else if (parent.type === "site") {
        if (form.model) body.model = form.model;
      } else if (parent.type === "turbine") {
        if (form.type) body.type = form.type;
      } else if (parent.type === "subsystem") {
        body.status = form.status;
      }

      await apiPost(path, body);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create asset");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Add {childType}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Under <span className="font-medium text-slate-700">{parentNode.name}</span>
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder={`e.g., ${childType} Name`}
            />
          </div>

          {parentNode.type === "site" && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Model</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="e.g., Vestas V164-9.5 MW"
              />
            </div>
          )}

          {parentNode.type === "site" && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="PLANNED">Planned</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="DECOMMISSIONED">Decommissioned</option>
              </select>
            </div>
          )}

          {parentNode.type === "turbine" && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Subsystem Type</label>
              <input
                type="text"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="e.g., Rotor, Drivetrain"
              />
            </div>
          )}

          {parentNode.type === "subsystem" && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="PLANNED">Planned</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="DECOMMISSIONED">Decommissioned</option>
              </select>
            </div>
          )}

          {parentNode.type === "organization" && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Time Zone</label>
              <input
                type="text"
                value={form.time_zone}
                onChange={(e) => setForm((f) => ({ ...f, time_zone: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="UTC"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.name}
              className="flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create {childType}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
