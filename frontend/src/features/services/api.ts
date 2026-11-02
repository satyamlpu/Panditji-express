import { api } from "@/lib/api";
import type { Paged, ServiceAdmin } from "@/lib/types";

export interface CategoryAdmin {
  id: string;
  slug: string;
  name: string;
  status: string;
  service_count: number | null;
}

export interface ServicePayload {
  slug: string;
  title: string;
  summary?: string | null;
  description?: string | null;
  price_rupees?: number | null;
  duration_label?: string | null;
  inclusions?: string[];
  samagri?: string[];
  category_id?: string | null;
  is_featured?: boolean;
  sort_order?: number;
  status?: string;
  seo_title?: string | null;
  seo_description?: string | null;
}

const BASE = "/api/v1/admin/services";

export const servicesApi = {
  list: (params: { status?: string; q?: string; page?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.q) q.set("q", params.q);
    if (params.page) q.set("page", String(params.page));
    q.set("page_size", "100");
    return api.get<Paged<ServiceAdmin>>(`${BASE}?${q.toString()}`);
  },
  get: (id: string) => api.get<ServiceAdmin>(`${BASE}/${id}`),
  create: (payload: ServicePayload) => api.post<ServiceAdmin>(BASE, payload),
  update: (id: string, payload: Partial<ServicePayload>) =>
    api.patch<ServiceAdmin>(`${BASE}/${id}`, payload),
  remove: (id: string) => api.del<{ message: string }>(`${BASE}/${id}`),
};

export const categoriesApi = {
  list: () => api.get<CategoryAdmin[]>("/api/v1/admin/categories"),
};
