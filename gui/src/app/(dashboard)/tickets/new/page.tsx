"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, apiGet } from "@/lib/api-client";
import type { Priority, Severity, Turbine, PaginatedResponse } from "@/types";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const SEVERITIES: { value: Severity; label: string }[] = [
  { value: "COSMETIC", label: "Cosmetic" },
  { value: "MINOR", label: "Minor" },
  { value: "MAJOR", label: "Major" },
  { value: "CRITICAL", label: "Critical" },
  { value: "SAFETY", label: "Safety" },
];

export default function NewTicketPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [turbines, setTurbines] = useState<Turbine[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [turbineId, setTurbineId] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Lazy-load turbines on focus
  const handleTurbineFocus = async () => {
    if (turbines.length > 0) return;
    try {
      const res = await apiGet<PaginatedResponse<Turbine>>("/turbines?limit=100");
      setTurbines(res.data);
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError("Title and description are required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await apiPost("/tickets", {
        title: title.trim(),
        description: description.trim(),
        priority,
        ...(severity ? { severity } : {}),
        ...(turbineId ? { turbineId } : {}),
        ...(dueDate ? { dueDate: new Date(dueDate).toISOString() } : {}),
      });
      router.push("/tickets");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create ticket";
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/tickets"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tickets
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Create Ticket</h1>
        <p className="mt-1 text-sm text-slate-500">Report a new maintenance issue</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Title */}
        <div>
          <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-slate-700">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={500}
            placeholder="Brief summary of the issue"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="desc" className="mb-1.5 block text-sm font-medium text-slate-700">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Detailed description of the issue, including location and impact"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Priority + Severity */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="priority" className="mb-1.5 block text-sm font-medium text-slate-700">
              Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="severity" className="mb-1.5 block text-sm font-medium text-slate-700">
              Severity
            </label>
            <select
              id="severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity | "")}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Select severity</option>
              {SEVERITIES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Turbine + Due date */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="turbine" className="mb-1.5 block text-sm font-medium text-slate-700">
              Turbine
            </label>
            <select
              id="turbine"
              value={turbineId}
              onChange={(e) => setTurbineId(e.target.value)}
              onFocus={handleTurbineFocus}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Select turbine</option>
              {turbines.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="due" className="mb-1.5 block text-sm font-medium text-slate-700">
              Due date
            </label>
            <input
              id="due"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
          <Link
            href="/tickets"
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm",
              submitting ? "opacity-60 cursor-not-allowed" : "hover:bg-brand-700",
            )}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Ticket
          </button>
        </div>
      </form>
    </div>
  );
}
