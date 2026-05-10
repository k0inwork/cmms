"use client";

import { cn } from "@/lib/utils";
import { Home, ClipboardCheck, Ticket, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Home", href: "/", icon: Home },
  { label: "Inspections", href: "/inspections", icon: ClipboardCheck },
  { label: "Tickets", href: "/tickets", icon: Ticket },
  { label: "Profile", href: "/profile", icon: User }, // Might route to a mobile profile menu
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex h-[84px] border-t border-slate-200 bg-white pb-safe shadow-[0_-1px_3px_rgba(0,0,0,0.08)] lg:hidden">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center space-y-1 pt-2 pb-6",
              active ? "text-brand-700" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <item.icon className={cn("h-6 w-6", active ? "text-brand-700" : "text-slate-400")} />
            <span className={cn("text-[10px]", active && "font-semibold")}>
              {item.label}
            </span>
            {active && (
              <div className="absolute bottom-[6px] h-[5px] w-[135px] rounded-full bg-slate-300" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
