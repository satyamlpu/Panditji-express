import { api } from "@/lib/api";
import type { Paged } from "@/lib/types";

export interface Enquiry {
  id: string;
  service_title_snapshot: string | null;
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  preferred_date: string | null;
  message: string | null;
  status: "new" | "contacted" | "confirmed" | "cancelled";
  admin_notes: string | null;
  created_at: string;
}

const BASE = "/api/v1/admin/enquiries";

export const enquiriesApi = {
  list: (params: { status?: string; page?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.page) q.set("page", String(params.page));
    q.set("page_size", "100");
    return api.get<Paged<Enquiry>>(`${BASE}?${q.toString()}`);
  },
  update: (id: string, payload: { status?: string; admin_notes?: string }) =>
    api.patch<Enquiry>(`${BASE}/${id}`, payload),
};
