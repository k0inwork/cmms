"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/types";

interface RouteGuardProps {
  children: React.ReactNode;
  roles?: Role[];
}

export function RouteGuard({ children, roles }: RouteGuardProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (roles && user && !roles.includes(user.role)) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, user, roles, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (roles && user && !roles.includes(user.role)) return null;

  return <>{children}</>;
}
