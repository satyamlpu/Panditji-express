import { api } from "@/lib/api";

export interface AppRelease {
  id: string;
  app_type: "customer" | "partner";
  platform: "android" | "ios";
  channel: "beta" | "production";
  version: string;
  build_number: number | null;
  download_url: string | null;
  checksum_sha256: string | null;
  release_notes: string | null;
  min_supported_version: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AppReleaseInput {
  app_type: "customer" | "partner";
  platform: "android" | "ios";
  channel: "beta" | "production";
  version: string;
  build_number?: number | null;
  download_url?: string | null;
  checksum_sha256?: string | null;
  release_notes?: string | null;
  min_supported_version?: string | null;
  is_active: boolean;
}

const BASE = "/api/v1/admin/app-releases";

export const releasesApi = {
  list: () => api.get<AppRelease[]>(BASE),
  create: (data: AppReleaseInput) => api.post<AppRelease>(BASE, data),
  update: (id: string, data: Partial<AppReleaseInput>) =>
    api.patch<AppRelease>(`${BASE}/${id}`, data),
  remove: (id: string) => api.del<{ message: string }>(`${BASE}/${id}`),
};
