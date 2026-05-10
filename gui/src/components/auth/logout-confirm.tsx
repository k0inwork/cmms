"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export function useLogoutConfirm() {
  const [showConfirm, setShowConfirm] = useState(false);
  const { logout } = useAuth();

  function requestLogout() {
    setShowConfirm(true);
  }

  function cancel() {
    setShowConfirm(false);
  }

  function confirm() {
    setShowConfirm(false);
    logout();
  }

  return { showConfirm, requestLogout, cancel, confirm };
}

interface LogoutConfirmProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function LogoutConfirmDialog({ open, onCancel, onConfirm }: LogoutConfirmProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Sign out?</h3>
        <p className="mt-2 text-sm text-slate-600">
          You will be signed out and redirected to the login screen.
        </p>
        <div className="mt-4 flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Sign out
          </button>
          <button
            onClick={onCancel}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
