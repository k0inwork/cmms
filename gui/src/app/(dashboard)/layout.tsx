"use client";

import { RouteGuard } from "@/components/auth/route-guard";
import { AppLayout } from "@/components/layout/app-layout";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <AppLayout>{children}</AppLayout>
    </RouteGuard>
  );
}
