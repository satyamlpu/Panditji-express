import { api, ApiError } from "@/lib/api";
import type {
  AuditEntry,
  ContentRevision,
  MediaAsset,
  MediaUploadResult,
  Paged,
  SyncStatus,
} from "@/lib/types";

const BASE = "/api/v1/admin/media";

export interface MediaUsage {
  services: string[];
  categories: string[];
}

export const mediaApi = {
  list: (params: { q?: string; page?: number; page_size?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.q) q.set("q", params.q);
    q.set("page", String(params.page ?? 1));
    q.set("page_size", String(params.page_size ?? 24));
    return api.get<Paged<MediaAsset>>(`${BASE}?${q.toString()}`);
  },

  /** Upload a file (multipart). Reports progress via the optional callback. */
  upload: (
    file: File,
    opts: { alt?: string; onProgress?: (pct: number) => void } = {},
  ): Promise<MediaUploadResult> =>
    new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append("file", file);
      if (opts.alt) fd.append("alt", opts.alt);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/backend${BASE}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && opts.onProgress) {
          opts.onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        let body: unknown = null;
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          /* ignore */
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body as MediaUploadResult);
        } else {
          const err = (body as { error?: { code?: string; message?: string } })?.error ?? {};
          reject(
            new ApiError(
              xhr.status,
              err.code ?? "error",
              err.message ?? "Upload failed",
              [],
            ),
          );
        }
      };
      xhr.onerror = () =>
        reject(new ApiError(0, "network", "Network error during upload", []));
      xhr.send(fd);
    }),

  updateAlt: (id: string, alt_text: string) =>
    api.patch<MediaAsset>(`${BASE}/${id}`, { alt_text }),

  usage: (id: string) => api.get<MediaUsage>(`${BASE}/${id}/usage`),

  remove: (id: string) => api.del<{ message: string }>(`${BASE}/${id}`),
};

export const systemApi = {
  syncStatus: (test = true) =>
    api.get<SyncStatus>(`/api/v1/admin/system/sync-status?test=${test}`),
  revisions: (entity_type: string, entity_id: string) =>
    api.get<ContentRevision[]>(
      `/api/v1/admin/revisions?entity_type=${entity_type}&entity_id=${encodeURIComponent(entity_id)}`,
    ),
  audit: (params: { entity?: string; action?: string; page?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.entity) q.set("entity", params.entity);
    if (params.action) q.set("action", params.action);
    q.set("page", String(params.page ?? 1));
    q.set("page_size", "100");
    return api.get<Paged<AuditEntry>>(
      `/api/v1/admin/system/audit?${q.toString()}`,
    );
  },
};
