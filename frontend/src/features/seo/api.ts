import { api } from "@/lib/api";

export interface SeoSettings {
  title_suffix?: string;
  default_description?: string;
  default_og_image?: string;
  noindex?: boolean;
  organization?: {
    name?: string;
    logo_url?: string;
    same_as?: string[];
    phone?: string;
  };
}

export const seoApi = {
  get: async (): Promise<SeoSettings> => {
    const all = await api.get<Record<string, unknown>>("/api/v1/admin/settings");
    return (all?.seo as SeoSettings) ?? {};
  },
  save: (value: SeoSettings) =>
    api.put<Record<string, unknown>>("/api/v1/admin/settings/seo", { value }),
};
