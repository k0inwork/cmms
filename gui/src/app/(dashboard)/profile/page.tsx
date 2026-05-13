"use client";

import { useAuth } from "@/lib/auth-context";
import { clearTokens } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { LogOut, ChevronRight, Shield, Clock } from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    clearTokens();
    router.push("/login");
  };

  return (
    <div className="pb-28 lg:hidden">
      <h1 className="mb-6 text-lg font-bold text-slate-900">Profile</h1>

      {/* User Card */}
      <div className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-sm text-slate-500">{user?.email}</p>
            <span className="mt-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
              {user?.role?.replace("_", " ")}
            </span>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="space-y-2">
        <Link
          href="/dispatch/mobile"
          className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
        >
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-slate-400" />
            <span className="text-sm font-medium text-slate-900">My Status & Availability</span>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Link>

        <Link
          href="/sync"
          className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
        >
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-slate-400" />
            <span className="text-sm font-medium text-slate-900">Offline Sync</span>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Link>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </button>
    </div>
  );
}
