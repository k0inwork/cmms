"use client";

import { RouteGuard } from "@/components/auth/route-guard";
import { SessionTimeout } from "@/components/auth/session-timeout";
import { AppLayout } from "@/components/layout/app-layout";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <SessionTimeout />
      <AppLayout>{children}</AppLayout>
    </RouteGuard>
  );
}
