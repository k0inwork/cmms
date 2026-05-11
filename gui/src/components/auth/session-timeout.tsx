"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { getStoredTokens, storeTokens } from "@/lib/api-client";

// Access token lifetime is 15 minutes. Show warning at 13 min, force logout at 15.
const WARNING_AFTER_MS = 13 * 60 * 1000;
const MAX_SESSION_MS = 15 * 60 * 1000;

export function SessionTimeout() {
  const { isAuthenticated, logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const lastActivity = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const resetTimer = useCallback(async () => {
    try {
      const { refresh } = getStoredTokens();
      if (refresh) {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: refresh }),
        });
        if (res.ok) {
          const data = await res.json();
          storeTokens(data.accessToken, data.refreshToken);
        }
      }
    } catch {
      // refresh failed, timer will force logout soon anyway
    }
    lastActivity.current = Date.now();
    setShowWarning(false);
    setCountdown(0);
  }, []);

  // Track user activity
  useEffect(() => {
    if (!isAuthenticated) return;

    const events = ["mousedown", "keydown", "scroll", "touchstart"] as const;
    const handler = () => {
      lastActivity.current = Date.now();
      setShowWarning(false);
    };
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, handler));
  }, [isAuthenticated]);

  // Check session expiry
  useEffect(() => {
    if (!isAuthenticated) {
      setShowWarning(false);
      return;
    }

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivity.current;
      const remaining = MAX_SESSION_MS - elapsed;

      if (remaining <= 0) {
        logout();
        return;
      }

      if (elapsed >= WARNING_AFTER_MS) {
        setShowWarning(true);
        setCountdown(Math.ceil(remaining / 1000));
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAuthenticated, logout]);

  if (!showWarning) return null;

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">
          Session expiring
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Your session will expire in{" "}
          <span className="font-mono font-medium text-slate-900">
            {minutes}:{seconds.toString().padStart(2, "0")}
          </span>
          . Save your work or extend the session.
        </p>
        <div className="mt-4 flex gap-3">
          <button
            onClick={resetTimer}
            className="flex-1 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Extend session
          </button>
          <button
            onClick={() => logout()}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
