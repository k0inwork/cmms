"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet } from "@/lib/api-client";
import type { AssetLookupResult } from "@/types";
import { useRouter } from "next/navigation";
import { Loader2, Camera, ScanLine, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ScanPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssetLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLookup = useCallback(async (value: string) => {
    if (!value.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await apiGet<AssetLookupResult>(`/assets/lookup?qr_code=${encodeURIComponent(value.trim())}`);
      setResult(data);
    } catch {
      setError("Asset not found. Check the code and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/assets" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Scan QR Code</h1>
      </div>

      {/* Camera placeholder */}
      <div className="flex aspect-video items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50">
        <div className="text-center">
          <Camera className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-2 text-sm text-slate-400">Camera access required for QR scanning</p>
        </div>
      </div>

      {/* Manual entry */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleLookup(code);
        }}
      >
        <label className="block text-sm font-medium text-slate-700">Asset ID</label>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste UUID or scan result"
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            Lookup
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-900">{result.name}</p>
          <p className="text-xs text-slate-500">{result.type}</p>
          <button
            onClick={() => router.push(`/assets/${result.id}`)}
            className="mt-3 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            View Asset
          </button>
        </div>
      )}
    </div>
  );
}
