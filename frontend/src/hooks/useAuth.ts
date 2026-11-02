"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Me } from "@/lib/types";

/** Current admin, resolved through the BFF proxy from the backend /me endpoint.
 * A 401 means "not signed in" — we don't retry it. */
export function useAuth() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<Me>("/api/v1/auth/me"),
    retry: false,
  });
}
