"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiClientError } from "@/lib/api-client";
import { Wind } from "lucide-react";

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.body.error || "Invalid credentials");
      } else {
        setError("Login failed. Please try again.");
      }
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left panel: branding (hidden on mobile) ─────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center bg-brand-600 text-white">
        <div className="max-w-md px-8 text-center">
          <Wind className="mx-auto mb-6 h-16 w-16" />
          <h1 className="text-3xl font-bold">CMMS</h1>
          <p className="mt-3 text-lg text-brand-100">
            Wind Turbine Management Platform
          </p>
          <p className="mt-6 text-sm text-brand-200">
            Monitor, maintain, and manage your wind farm assets from a single
            dashboard.
          </p>
        </div>
      </div>

      {/* ── Right panel: form ────────────────────────────────────────────────── */}
      <div className="flex w-full flex-col items-center justify-center px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Mobile-only branding */}
          <div className="mb-8 text-center lg:hidden">
            <Wind className="mx-auto mb-2 h-10 w-10 text-brand-600" />
            <h1 className="text-2xl font-bold text-slate-900">CMMS</h1>
            <p className="mt-1 text-sm text-slate-500">
              Wind Turbine Management
            </p>
          </div>

          <h2 className="mb-6 text-xl font-semibold text-slate-900">Sign in</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                className="rounded-md bg-red-50 p-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isLoading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
