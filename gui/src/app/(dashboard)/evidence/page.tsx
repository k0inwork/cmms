"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPut } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { EvidenceItem, PaginatedResponse } from "@/types";
import { Image as ImageIcon, Video, FileText, CheckCircle, Flag, Search, Filter } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function EvidenceLibrary() {
  const { user } = useAuth();
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const canReview = user?.role === "QA_REVIEWER" || user?.role === "ADMINISTRATOR";

  useEffect(() => {
    fetchEvidence();
  }, [statusFilter]);

  async function fetchEvidence() {
    setLoading(true);
    try {
      let url = "/evidence?limit=50";
      if (statusFilter) url += `&approvalStatus=${statusFilter}`;
      
      const res = await apiGet<PaginatedResponse<EvidenceItem>>(url);
      setEvidence(res.data);
    } catch (err: any) {
      setError(err.message || "Failed to load evidence");
    } finally {
      setLoading(false);
    }
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedItems(newSet);
  };

  const handleApprove = async (id: string) => {
    try {
      await apiPut(`/evidence/${id}/approve`);
      fetchEvidence();
    } catch (err: any) {
      alert(err.message || "Failed to approve");
    }
  };

  const handleFlag = async (id: string) => {
    const reason = prompt("Enter flag reason:");
    if (reason === null) return;
    try {
      await apiPut(`/evidence/${id}/flag`, { reason });
      fetchEvidence();
    } catch (err: any) {
      alert(err.message || "Failed to flag");
    }
  };

  const renderIcon = (type: string) => {
    if (type === "VIDEO") return <Video className="h-8 w-8 text-slate-400" />;
    if (type === "DOCUMENT" || type === "PDF") return <FileText className="h-8 w-8 text-slate-400" />;
    return <ImageIcon className="h-8 w-8 text-slate-400" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {canReview && statusFilter === "PENDING" ? "Evidence Queue" : "Evidence Library"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {canReview && statusFilter === "PENDING" 
              ? "Review and approve submitted evidence." 
              : "Browse and manage inspection evidence."}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by filename, tag, asset..."
            className="w-full rounded-md border-slate-200 pl-10 text-sm focus:border-brand-500 focus:ring-brand-500"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border-slate-200 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="FLAGGED">Flagged</option>
          </select>
          
          <button className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            <Filter className="h-4 w-4" />
            Filters
          </button>
          
          <div className="ml-2 flex items-center rounded-md border border-slate-200 p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={cn("rounded px-2 py-1", viewMode === "grid" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900")}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn("rounded px-2 py-1", viewMode === "list" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900")}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading evidence...</div>
      ) : evidence.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-500">No evidence found.</div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {evidence.map((item) => (
            <div
              key={item.id}
              className={cn(
                "group relative overflow-hidden rounded-lg bg-white shadow-sm ring-1 transition-all hover:shadow-md",
                selectedItems.has(item.id) ? "ring-brand-500" : "ring-slate-200"
              )}
            >
              <div 
                className="absolute left-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100"
                style={{ opacity: selectedItems.has(item.id) ? 1 : undefined }}
              >
                <input
                  type="checkbox"
                  checked={selectedItems.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
              </div>

              <Link href={`/evidence/${item.id}`} className="block">
                <div className="relative flex h-48 items-center justify-center bg-slate-100">
                  {item.thumbnail_url ? (
                    <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    renderIcon(item.media_type)
                  )}
                  
                  <div className="absolute right-2 top-2">
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                      item.status === "APPROVED" ? "bg-green-100 text-green-700" :
                      item.status === "FLAGGED" ? "bg-red-100 text-red-700" :
                      "bg-yellow-100 text-yellow-800"
                    )}>
                      {item.status}
                    </span>
                  </div>
                </div>
              </Link>
              
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <Link href={`/evidence/${item.id}`}>
                      <h3 className="truncate text-sm font-medium text-slate-900" title={item.metadata?.fileName || 'Evidence'}>
                        {item.metadata?.fileName || 'Evidence'}
                      </h3>
                    </Link>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {item.uploader?.firstName} {item.uploader?.lastName} · {formatDate(item.created_at)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatSize(item.file_size_bytes)}
                    </p>
                    
                    {item.status === "FLAGGED" && item.metadata?.flagReason && (
                      <p className="mt-2 text-xs text-red-600 line-clamp-2">
                        Flagged: {item.metadata.flagReason}
                      </p>
                    )}
                  </div>
                </div>

                {canReview && item.status === "PENDING" && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleApprove(item.id)}
                      className="flex-1 rounded-md bg-green-50 px-2 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleFlag(item.id)}
                      className="flex-1 rounded-md bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                    >
                      Flag
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  File
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  Uploader
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  Size
                </th>
                {canReview && (
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {evidence.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-slate-100 flex items-center justify-center">
                         {item.thumbnail_url ? (
                          <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          renderIcon(item.media_type)
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-slate-900">
                          <Link href={`/evidence/${item.id}`} className="hover:underline">
                            {item.metadata?.fileName || 'Evidence'}
                          </Link>
                        </div>
                        <div className="text-sm text-slate-500">{item.media_type}</div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      item.status === "APPROVED" ? "bg-green-100 text-green-800" :
                      item.status === "FLAGGED" ? "bg-red-100 text-red-800" :
                      "bg-yellow-100 text-yellow-800"
                    )}>
                      {item.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                    {item.uploader?.firstName} {item.uploader?.lastName}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                    {formatDate(item.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                    {formatSize(item.file_size_bytes)}
                  </td>
                  {canReview && (
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                      {item.status === "PENDING" && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleApprove(item.id)} className="text-green-600 hover:text-green-900">Approve</button>
                          <button onClick={() => handleFlag(item.id)} className="text-red-600 hover:text-red-900">Flag</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
