"use client";

import { useAuth } from "@/lib/auth-context";
import { useLogoutConfirm, LogoutConfirmDialog } from "@/components/auth/logout-confirm";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Ticket,
  ClipboardCheck,
  Wrench,
  Radio,
  FileImage,
  ShieldCheck,
  FileText,
  BarChart3,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Tickets", href: "/tickets", icon: Ticket },
  { label: "Inspections", href: "/inspections", icon: ClipboardCheck },
  { label: "Work Orders", href: "/work-orders", icon: Wrench },
  { label: "Dispatch", href: "/dispatch", icon: Radio, roles: ["DISPATCHER", "ADMINISTRATOR"] },
  { label: "Evidence", href: "/evidence", icon: FileImage },
  { label: "Audit Trail", href: "/audit", icon: ShieldCheck, roles: ["ADMINISTRATOR", "OPERATIONS_MANAGER"] },
  { label: "Reports", href: "/reports", icon: BarChart3, roles: ["ADMINISTRATOR", "OPERATIONS_MANAGER", "QA_REVIEWER"] },
  { label: "Admin", href: "/admin", icon: FileText, roles: ["ADMINISTRATOR"] },
];

export function Sidebar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { showConfirm, requestLogout, cancel, confirm } = useLogoutConfirm();

  const filtered = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  const nav = (
    <>
      <div className="flex h-16 items-center border-b border-slate-200 px-4">
        <Link href="/" className="text-lg font-semibold text-brand-700">
          CMMS
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4">
        {filtered.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="mb-2 text-xs text-slate-500">
          {user?.firstName} {user?.lastName}
          <br />
          <span className="font-mono text-[10px]">{user?.role}</span>
        </div>
        <button
          onClick={requestLogout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white">
        {nav}
      </aside>

      {/* Mobile header */}
      <div className="sticky top-0 z-30 flex h-14 items-center border-b border-slate-200 bg-white px-4 lg:hidden">
        <button onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <span className="ml-3 text-lg font-semibold text-brand-700">CMMS</span>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 flex w-60 flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
              <span className="text-lg font-semibold text-brand-700">CMMS</span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <LogoutConfirmDialog open={showConfirm} onCancel={cancel} onConfirm={confirm} />
    </>
  );
}
