"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import type {
  AdminUser,
  Skill,
  Certification,
  WorkflowRule,
  Role,
  PaginatedResponse,
  TechnicianStatus,
} from "@/types";
import {
  Users,
  Award,
  Zap,
  Cog,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Search,
  UserCheck,
  UserX,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "users" | "skills" | "certifications" | "workflows";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "users", label: "Users", icon: Users },
  { key: "skills", label: "Skills", icon: Zap },
  { key: "certifications", label: "Certifications", icon: Award },
  { key: "workflows", label: "Workflows", icon: Cog },
];

const ROLE_LABELS: Record<Role, string> = {
  TECHNICIAN: "Technician",
  DISPATCHER: "Dispatcher",
  QA_REVIEWER: "QA Reviewer",
  OPERATIONS_MANAGER: "Ops Manager",
  ADMINISTRATOR: "Administrator",
};

const STATUS_COLORS: Record<TechnicianStatus, string> = {
  AVAILABLE: "bg-green-100 text-green-800",
  ASSIGNED: "bg-blue-100 text-blue-800",
  TRAVELING: "bg-yellow-100 text-yellow-800",
  ON_SITE: "bg-blue-100 text-blue-800",
  ON_BREAK: "bg-gray-100 text-gray-800",
  SICK: "bg-red-100 text-red-800",
  TRAINING: "bg-purple-100 text-purple-800",
  LEAVE: "bg-orange-100 text-orange-800",
  UNAVAILABLE: "bg-red-100 text-red-800",
};

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("users");
  const { user } = useAuth();

  if (user?.role !== "ADMINISTRATOR") {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-12 w-12 text-slate-300" />
        <p className="mt-4 text-lg font-medium text-slate-500">Administrator access required</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Admin</h1>
      <p className="mt-1 text-sm text-slate-500">
        Manage users, skills, certifications, and workflow rules.
      </p>

      {/* Tabs */}
      <div className="mt-6 border-b border-slate-200">
        <nav className="flex gap-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors",
                tab === t.key
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-slate-500 hover:text-slate-700",
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {tab === "users" && <UsersTab />}
        {tab === "skills" && <SkillsTab />}
        {tab === "certifications" && <CertsTab />}
        {tab === "workflows" && <WorkflowsTab />}
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<PaginatedResponse<AdminUser>>("/admin/users?limit=100");
      setUsers(res.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(
    (u) =>
      u.first_name.toLowerCase().includes(search.toLowerCase()) ||
      u.last_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Add User
        </button>
      </div>

      {loading ? (
        <p className="mt-8 text-center text-sm text-slate-500">Loading...</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Active</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">
                    {u.first_name} {u.last_name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{u.email}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STATUS_COLORS[u.status])}>
                      {u.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {u.is_active ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => u.is_active ? deactivateUser(u.id, load) : activateUser(u.id, load)}
                        className="rounded p-1 text-slate-400 hover:text-slate-600"
                        title={u.is_active ? "Deactivate" : "Activate"}
                      >
                        {u.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => setEditId(u.id)}
                        className="rounded p-1 text-slate-400 hover:text-slate-600"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <UserCreateModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {editId && <UserEditModal userId={editId} onClose={() => setEditId(null)} onSaved={load} />}
    </div>
  );
}

async function activateUser(id: string, refresh: () => void) {
  try {
    await apiPost(`/admin/users/${id}/activate`, {});
    refresh();
  } catch { /* ignore */ }
}

async function deactivateUser(id: string, refresh: () => void) {
  try {
    await apiPost(`/admin/users/${id}/deactivate`, {});
    refresh();
  } catch { /* ignore */ }
}

function UserCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ email: "", password: "", firstName: "", lastName: "", role: "TECHNICIAN" as Role });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await apiPost("/admin/users", form);
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e?.body?.error || "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Create User" onClose={onClose}>
      <Field label="First Name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
      <Field label="Last Name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
      <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
      <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
      <div>
        <label className="block text-sm font-medium text-slate-700">Role</label>
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          {Object.entries(ROLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
        <button onClick={submit} disabled={submitting} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {submitting ? "Creating..." : "Create"}
        </button>
      </div>
    </Modal>
  );
}

function UserEditModal({ userId, onClose, onSaved }: { userId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", role: "TECHNICIAN" as Role });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiGet<AdminUser>(`/admin/users/${userId}`).then((u) => {
      setForm({ firstName: u.first_name, lastName: u.last_name, email: u.email, role: u.role });
      setLoading(false);
    }).catch(() => { setLoading(false); onClose(); });
  }, [userId, onClose]);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await apiPatch(`/admin/users/${userId}`, form);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.body?.error || "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Modal title="Edit User" onClose={onClose}><p className="text-sm text-slate-500">Loading...</p></Modal>;

  return (
    <Modal title="Edit User" onClose={onClose}>
      <Field label="First Name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
      <Field label="Last Name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
      <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
      <div>
        <label className="block text-sm font-medium text-slate-700">Role</label>
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          {Object.entries(ROLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
        <button onClick={submit} disabled={submitting} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {submitting ? "Saving..." : "Save"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Skills Tab ───────────────────────────────────────────────────────────────

function SkillsTab() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<PaginatedResponse<Skill>>("/admin/skills?limit=100");
      setSkills(res.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this skill?")) return;
    try { await apiDelete(`/admin/skills/${id}`); load(); } catch { /* ignore */ }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-900">Skills Library</h2>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Add Skill
        </button>
      </div>

      {loading ? (
        <p className="mt-8 text-center text-sm text-slate-500">Loading...</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((s) => (
            <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-900">{s.name}</h3>
                  {s.category && <p className="mt-0.5 text-xs text-slate-500">{s.category}</p>}
                  {s.description && <p className="mt-1 text-xs text-slate-500">{s.description}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditId(s.id)} className="rounded p-1 text-slate-400 hover:text-slate-600"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(s.id)} className="rounded p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
          {skills.length === 0 && <p className="col-span-full py-8 text-center text-sm text-slate-500">No skills defined</p>}
        </div>
      )}

      {showCreate && (
        <SkillModal title="Create Skill" onClose={() => setShowCreate(false)} onSaved={load} />
      )}
      {editId && (
        <SkillModal title="Edit Skill" skillId={editId} onClose={() => setEditId(null)} onSaved={load} />
      )}
    </div>
  );
}

function SkillModal({ title, skillId, onClose, onSaved }: { title: string; skillId?: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", category: "", description: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load skill from list if editing
  useEffect(() => {
    if (skillId) {
      apiGet<PaginatedResponse<Skill>>("/admin/skills?limit=100").then((res) => {
        const s = res.data.find((x) => x.id === skillId);
        if (s) setForm({ name: s.name, category: s.category || "", description: s.description || "" });
      });
    }
  }, [skillId]);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const payload: Record<string, string> = { name: form.name };
      if (form.category) payload.category = form.category;
      if (form.description) payload.description = form.description;
      if (skillId) await apiPatch(`/admin/skills/${skillId}`, payload);
      else await apiPost("/admin/skills", payload);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.body?.error || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
      <Field label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} optional />
      <Field label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} optional />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
        <button onClick={submit} disabled={submitting} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {submitting ? "Saving..." : "Save"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Certifications Tab ───────────────────────────────────────────────────────

function CertsTab() {
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<PaginatedResponse<Certification>>("/admin/certifications?limit=100");
      setCerts(res.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this certification?")) return;
    try { await apiDelete(`/admin/certifications/${id}`); load(); } catch { /* ignore */ }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-900">Certifications</h2>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Add Certification
        </button>
      </div>

      {loading ? (
        <p className="mt-8 text-center text-sm text-slate-500">Loading...</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Issuing Body</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Validity</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {certs.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{c.issuing_body || "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{c.validity_months ? `${c.validity_months} months` : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditId(c.id)} className="rounded p-1 text-slate-400 hover:text-slate-600"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDelete(c.id)} className="rounded p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {certs.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">No certifications defined</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CertModal title="Create Certification" onClose={() => setShowCreate(false)} onSaved={load} />
      )}
      {editId && (
        <CertModal title="Edit Certification" certId={editId} onClose={() => setEditId(null)} onSaved={load} />
      )}
    </div>
  );
}

function CertModal({ title, certId, onClose, onSaved }: { title: string; certId?: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", issuingBody: "", validityMonths: "", description: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (certId) {
      apiGet<PaginatedResponse<Certification>>("/admin/certifications?limit=100").then((res) => {
        const c = res.data.find((x) => x.id === certId);
        if (c) setForm({ name: c.name, issuingBody: c.issuing_body || "", validityMonths: c.validity_months?.toString() || "", description: c.description || "" });
      });
    }
  }, [certId]);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const payload: Record<string, unknown> = { name: form.name };
      if (form.issuingBody) payload.issuingBody = form.issuingBody;
      if (form.validityMonths) payload.validityMonths = parseInt(form.validityMonths);
      if (form.description) payload.description = form.description;
      if (certId) await apiPatch(`/admin/certifications/${certId}`, payload);
      else await apiPost("/admin/certifications", payload);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.body?.error || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
      <Field label="Issuing Body" value={form.issuingBody} onChange={(v) => setForm({ ...form, issuingBody: v })} optional />
      <Field label="Validity (months)" value={form.validityMonths} onChange={(v) => setForm({ ...form, validityMonths: v })} optional />
      <Field label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} optional />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
        <button onClick={submit} disabled={submitting} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {submitting ? "Saving..." : "Save"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Workflows Tab ────────────────────────────────────────────────────────────

function WorkflowsTab() {
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ data: WorkflowRule[] }>("/admin/workflow-rules");
      setRules(res.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this workflow rule?")) return;
    try { await apiDelete(`/admin/workflow-rules/${id}`); load(); } catch { /* ignore */ }
  };

  const toggleActive = async (rule: WorkflowRule) => {
    try {
      await apiPatch(`/admin/workflow-rules/${rule.id}`, { isActive: !rule.isActive });
      load();
    } catch { /* ignore */ }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-900">Workflow Rules</h2>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Add Rule
        </button>
      </div>

      {loading ? (
        <p className="mt-8 text-center text-sm text-slate-500">Loading...</p>
      ) : rules.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">No workflow rules configured</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rules.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleActive(r)}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                      r.isActive ? "bg-brand-600" : "bg-slate-200",
                    )}
                  >
                    <span className={cn(
                      "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                      r.isActive ? "translate-x-4" : "translate-x-0",
                    )} />
                  </button>
                  <div>
                    <h3 className="text-sm font-medium text-slate-900">{r.name}</h3>
                    <p className="text-xs text-slate-500">Trigger: {r.trigger}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditId(r.id)} className="rounded p-1 text-slate-400 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(r.id)} className="rounded p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              {r.description && <p className="mt-2 text-xs text-slate-500">{r.description}</p>}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <WorkflowModal title="Create Workflow Rule" onClose={() => setShowCreate(false)} onSaved={load} />
      )}
      {editId && (
        <WorkflowModal title="Edit Workflow Rule" ruleId={editId} rules={rules} onClose={() => setEditId(null)} onSaved={load} />
      )}
    </div>
  );
}

function WorkflowModal({ title, ruleId, rules, onClose, onSaved }: { title: string; ruleId?: string; rules?: WorkflowRule[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", description: "", trigger: "", isActive: true });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ruleId && rules) {
      const r = rules.find((x) => x.id === ruleId);
      if (r) setForm({ name: r.name, description: r.description || "", trigger: r.trigger, isActive: r.isActive });
    }
  }, [ruleId, rules]);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const payload: Record<string, unknown> = { name: form.name, trigger: form.trigger, isActive: form.isActive };
      if (form.description) payload.description = form.description;
      if (ruleId) await apiPatch(`/admin/workflow-rules/${ruleId}`, payload);
      else await apiPost("/admin/workflow-rules", payload);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.body?.error || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
      <Field label="Trigger" value={form.trigger} onChange={(v) => setForm({ ...form, trigger: v })} placeholder="e.g. ticket.created" />
      <Field label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} optional />
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-slate-300" />
        <label className="text-sm text-slate-700">Active</label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
        <button onClick={submit} disabled={submitting} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {submitting ? "Saving..." : "Save"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", optional, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; optional?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label} {optional && <span className="text-slate-400">(optional)</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}
