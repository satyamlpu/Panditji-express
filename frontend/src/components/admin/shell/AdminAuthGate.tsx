"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";

/**
 * Wraps an admin module shell: resolves the current admin and redirects to the
 * login page on a 401. Kept separate from any `admin/layout.tsx` so it never
 * wraps the (ungated) login route.
 */
export function AdminAuthGate({ children }: { children: ReactNode }) {
  const { data: me, isLoading, isError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isError) router.replace("/admin/login");
  }, [isError, router]);

  if (isLoading || isError || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-2">
        <Spinner className="text-forest" />
      </div>
    );
  }

  return <>{children}</>;
}

/** Sign out of the admin panel (clears the BFF session) and return to login. */
export function useAdminLogout() {
  const router = useRouter();
  return async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  };
}
