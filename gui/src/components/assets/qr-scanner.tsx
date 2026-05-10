"use client";

import { useState, useCallback } from "react";
import { apiGet } from "@/lib/api-client";
import type { AssetLookupResult } from "@/types";
import { Camera, X, Loader2, ScanLine } from "lucide-react";
import { useRouter } from "next/navigation";

interface QRScannerProps {
  onClose: () => void;
}

export function QRScanner({ onClose }: QRScannerProps) {
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLookup = useCallback(async (code: string) => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const result = await apiGet<AssetLookupResult>(`/assets/lookup?qr_code=${encodeURIComponent(code.trim())}`);
      // Navigate to asset detail — we use the entity ID which can be found in the tree
      router.push(`/assets/${result.id}`);
      onClose();
    } catch {
      setError("Asset not found. Check the code and try again.");
    } finally {
      setLoading(false);
    }
  }, [router, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLookup(manualCode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Scan QR Code</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Camera placeholder — native camera API not available in all browsers */}
        <div className="mt-4 flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50">
          <div className="text-center">
            <Camera className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">Camera access required for QR scanning</p>
            <p className="mt-1 text-xs text-slate-400">Use manual entry below instead</p>
          </div>
        </div>

        {/* Manual entry */}
        <form onSubmit={handleSubmit} className="mt-4">
          <label className="block text-sm font-medium text-slate-700">
            Enter Asset ID
          </label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Paste UUID or scan result"
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={loading || !manualCode.trim()}
              className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
              Lookup
            </button>
          </div>
        </form>

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}
      </div>
    </div>
  );
}
