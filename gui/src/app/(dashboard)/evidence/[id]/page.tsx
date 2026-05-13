"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPut } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { EvidenceItem } from "@/types";
import { ArrowLeft, Check, Flag, Image as ImageIcon, Video, FileText } from "lucide-react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

function resolveUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
}

export default function EvidenceViewer({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [evidence, setEvidence] = useState<EvidenceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canReview = user?.role === "QA_REVIEWER" || user?.role === "ADMINISTRATOR";

  useEffect(() => {
    fetchEvidence();
  }, [params.id]);

  async function fetchEvidence() {
    setLoading(true);
    try {
      const res = await apiGet<EvidenceItem>(`/evidence/${params.id}`);
      setEvidence(res);
    } catch (err: any) {
      setError(err.message || "Failed to load evidence");
    } finally {
      setLoading(false);
    }
  }

  const handleApprove = async () => {
    try {
      await apiPut(`/evidence/${params.id}/approve`);
      fetchEvidence();
    } catch (err: any) {
      alert(err.message || "Failed to approve");
    }
  };

  const handleFlag = async () => {
    const reason = prompt("Enter flag reason:");
    if (reason === null) return;
    try {
      await apiPut(`/evidence/${params.id}/flag`, { reason });
      fetchEvidence();
    } catch (err: any) {
      alert(err.message || "Failed to flag");
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!evidence) return <div className="p-8 text-center">Not found</div>;

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col bg-slate-950 text-slate-300 md:flex-row">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center gap-4">
            <Link href="/evidence" className="text-slate-400 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-medium text-white truncate max-w-sm">
              {evidence.metadata?.fileName || 'Evidence'}
            </h1>
          </div>
          {canReview && evidence.status === "PENDING" && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleApprove}
                className="flex items-center gap-2 rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
              >
                <Check className="h-4 w-4" /> Approve
              </button>
              <button
                onClick={handleFlag}
                className="flex items-center gap-2 rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                <Flag className="h-4 w-4" /> Flag
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 relative flex items-center justify-center p-4">
           {evidence.media_type === "PHOTO" ? (
             <img src={resolveUrl(evidence.file_url)} alt="" className="max-h-full max-w-full object-contain" />
           ) : evidence.media_type === "VIDEO" ? (
             <video src={resolveUrl(evidence.file_url)} controls className="max-h-full max-w-full" />
           ) : (
             <div className="text-center">
                <FileText className="h-16 w-16 mx-auto mb-4 text-slate-500" />
                <a href={resolveUrl(evidence.file_url)} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">
                  Download {evidence.media_type}
                </a>
             </div>
           )}

           {/* Placeholder for annotations rendering on top of image */}
           {evidence.annotations && evidence.annotations.length > 0 && (
              <div className="absolute top-4 left-4 rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white">
                {evidence.annotations.length} Annotations
              </div>
           )}
        </div>
      </div>

      <div className="w-full border-t border-slate-800 bg-slate-900 p-6 md:w-80 md:border-l md:border-t-0 overflow-y-auto">
        <h2 className="mb-4 text-lg font-medium text-white">Details</h2>
        
        <div className="space-y-4 text-sm">
          <div>
            <div className="text-slate-500">Status</div>
            <div className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
              ${evidence.status === 'APPROVED' ? 'bg-green-900 text-green-300' :
                evidence.status === 'FLAGGED' ? 'bg-red-900 text-red-300' :
                'bg-yellow-900 text-yellow-300'}`}
            >
              {evidence.status}
            </div>
          </div>
          
          {evidence.status === "FLAGGED" && evidence.metadata?.flagReason && (
            <div className="rounded bg-red-950 p-3 text-red-400">
              <div className="font-medium text-xs uppercase mb-1">Flag Reason</div>
              {evidence.metadata.flagReason}
            </div>
          )}

          <div>
            <div className="text-slate-500">Type</div>
            <div className="mt-1 text-slate-300">{evidence.media_type} · {evidence.mime_type}</div>
          </div>
          
          <div>
            <div className="text-slate-500">Size</div>
            <div className="mt-1 text-slate-300">{(evidence.file_size_bytes / 1024 / 1024).toFixed(2)} MB</div>
          </div>
          
          <div>
            <div className="text-slate-500">Captured</div>
            <div className="mt-1 text-slate-300">
              {evidence.metadata?.capturedAt ? new Date(evidence.metadata.capturedAt).toLocaleString() : new Date(evidence.created_at).toLocaleString()}
            </div>
          </div>
          
          <div>
            <div className="text-slate-500">Uploader</div>
            <div className="mt-1 text-slate-300">{evidence.uploader?.firstName} {evidence.uploader?.lastName}</div>
          </div>

          {evidence.inspection_id && (
            <div>
              <div className="text-slate-500">Inspection</div>
              <Link href={`/inspections/${evidence.inspection_id}`} className="mt-1 text-brand-400 hover:underline block truncate">
                {evidence.inspection_id}
              </Link>
            </div>
          )}
        </div>

        {evidence.annotations && evidence.annotations.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-4 text-sm font-medium text-white uppercase tracking-wider">Annotations</h3>
            <div className="space-y-3">
              {evidence.annotations.map((ann, idx) => (
                <div key={ann.id} className="rounded bg-slate-800 p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-slate-300">{ann.annotation_type}</span>
                  </div>
                  <div className="text-slate-400 pl-7 text-xs">
                    {/* Placeholder for annotation data rendering */}
                    {JSON.stringify(ann.data)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
