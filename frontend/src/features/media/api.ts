import { api, ApiError } from "@/lib/api";

export interface MediaAsset {
  id: string;
  path: string;
  url: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  alt_text: string | null;
  created_at: string;
}

const BASE = "/api/v1/admin/media";

export const mediaApi = {
  list: (q?: string) =>
    api.get<MediaAsset[]>(q ? `${BASE}?q=${encodeURIComponent(q)}` : BASE),

  /** Multipart upload — mirrors the inline ImageUpload contract. */
  upload: async (file: File): Promise<MediaAsset> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/backend${BASE}`, { method: "POST", body: fd });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const err = body?.error ?? {};
      throw new ApiError(
        res.status,
        err.code ?? "error",
        err.message ?? "Upload failed",
        err.details ?? [],
      );
    }
    return body as MediaAsset;
  },

  updateAlt: (id: string, alt_text: string | null) =>
    api.patch<MediaAsset>(`${BASE}/${id}`, { alt_text }),

  remove: (id: string) => api.del<{ message: string }>(`${BASE}/${id}`),
};
