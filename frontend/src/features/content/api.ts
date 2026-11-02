import { api } from "@/lib/api";

type Status = "draft" | "published" | "unpublished";

/* ── Categories ─────────────────────────────────────────────────────────── */
export interface CategoryAdmin {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  status: Status;
  seo_title: string | null;
  seo_description: string | null;
  service_count: number | null;
}
export const categoriesApi = {
  list: () => api.get<CategoryAdmin[]>("/api/v1/admin/categories"),
  create: (p: Partial<CategoryAdmin>) =>
    api.post<CategoryAdmin>("/api/v1/admin/categories", p),
  update: (id: string, p: Partial<CategoryAdmin>) =>
    api.patch<CategoryAdmin>(`/api/v1/admin/categories/${id}`, p),
  remove: (id: string) =>
    api.del<{ message: string }>(`/api/v1/admin/categories/${id}`),
};

/* ── Locations ──────────────────────────────────────────────────────────── */
export interface LocationAdmin {
  id: string;
  slug: string;
  city: string;
  region: string | null;
  description: string | null;
  sort_order: number;
  status: Status;
  seo_title: string | null;
  seo_description: string | null;
  service_ids: string[];
}
export const locationsApi = {
  list: () => api.get<LocationAdmin[]>("/api/v1/admin/locations"),
  create: (p: Partial<LocationAdmin>) =>
    api.post<LocationAdmin>("/api/v1/admin/locations", p),
  update: (id: string, p: Partial<LocationAdmin>) =>
    api.patch<LocationAdmin>(`/api/v1/admin/locations/${id}`, p),
  setServices: (id: string, service_ids: string[]) =>
    api.put<LocationAdmin>(`/api/v1/admin/locations/${id}/services`, {
      service_ids,
    }),
  remove: (id: string) =>
    api.del<{ message: string }>(`/api/v1/admin/locations/${id}`),
};

/* ── Testimonials ───────────────────────────────────────────────────────── */
export interface TestimonialAdmin {
  id: string;
  author_name: string;
  author_location: string | null;
  service_label: string | null;
  quote: string;
  rating: number | null;
  sort_order: number;
  status: Status;
}
export const testimonialsApi = {
  list: () => api.get<TestimonialAdmin[]>("/api/v1/admin/testimonials"),
  create: (p: Partial<TestimonialAdmin>) =>
    api.post<TestimonialAdmin>("/api/v1/admin/testimonials", p),
  update: (id: string, p: Partial<TestimonialAdmin>) =>
    api.patch<TestimonialAdmin>(`/api/v1/admin/testimonials/${id}`, p),
  remove: (id: string) =>
    api.del<{ message: string }>(`/api/v1/admin/testimonials/${id}`),
};

/* ── FAQs ───────────────────────────────────────────────────────────────── */
export interface FaqAdmin {
  id: string;
  question: string;
  answer: string;
  topic: string | null;
  service_id: string | null;
  sort_order: number;
  status: Status;
}
export const faqsApi = {
  list: () => api.get<FaqAdmin[]>("/api/v1/admin/faqs"),
  create: (p: Partial<FaqAdmin>) => api.post<FaqAdmin>("/api/v1/admin/faqs", p),
  update: (id: string, p: Partial<FaqAdmin>) =>
    api.patch<FaqAdmin>(`/api/v1/admin/faqs/${id}`, p),
  remove: (id: string) => api.del<{ message: string }>(`/api/v1/admin/faqs/${id}`),
};

/* ── Pages ──────────────────────────────────────────────────────────────── */
export interface PageAdmin {
  id: string;
  slug: string;
  title: string;
  body: string | null;
  status: Status;
  seo_title: string | null;
  seo_description: string | null;
}
export const pagesApi = {
  list: () => api.get<PageAdmin[]>("/api/v1/admin/pages"),
  get: (id: string) => api.get<PageAdmin>(`/api/v1/admin/pages/${id}`),
  create: (p: Partial<PageAdmin>) => api.post<PageAdmin>("/api/v1/admin/pages", p),
  update: (id: string, p: Partial<PageAdmin>) =>
    api.patch<PageAdmin>(`/api/v1/admin/pages/${id}`, p),
  remove: (id: string) => api.del<{ message: string }>(`/api/v1/admin/pages/${id}`),
};

/* ── Homepage sections ──────────────────────────────────────────────────── */
export interface BannerAdmin {
  id: string;
  kind: string;
  heading: string | null;
  subheading: string | null;
  body: string | null;
  cta_label: string | null;
  cta_href: string | null;
  image_url: string | null;
  sort_order: number;
  status: Status;
}
export const bannersApi = {
  list: () => api.get<BannerAdmin[]>("/api/v1/admin/homepage-sections"),
  create: (p: Partial<BannerAdmin>) =>
    api.post<BannerAdmin>("/api/v1/admin/homepage-sections", p),
  update: (id: string, p: Partial<BannerAdmin>) =>
    api.patch<BannerAdmin>(`/api/v1/admin/homepage-sections/${id}`, p),
  remove: (id: string) =>
    api.del<{ message: string }>(`/api/v1/admin/homepage-sections/${id}`),
};

/* ── Settings ───────────────────────────────────────────────────────────── */
export const settingsApi = {
  all: () => api.get<Record<string, unknown>>("/api/v1/admin/settings"),
  set: (key: string, value: unknown) =>
    api.put<Record<string, unknown>>(
      `/api/v1/admin/settings/${encodeURIComponent(key)}`,
      { value },
    ),
};
