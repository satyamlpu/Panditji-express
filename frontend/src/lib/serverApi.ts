/** Server-side data access for public pages.
 *
 * Runs in Server Components, fetching the FastAPI backend directly (server to
 * server). Responses are cached and tagged so content edits can be revalidated
 * on demand (see /api/revalidate) — this is what lets published changes appear
 * without a redeploy. A time-based `revalidate` is the safety-net fallback.
 */

import { backendUrl } from "@/lib/config";
import type {
  CategoryDetail,
  CategoryPublic,
  FaqGroup,
  HomepageSection,
  LocationDetail,
  LocationListItem,
  PageContent,
  ServiceDetail,
  ServiceListItem,
  Testimonial,
} from "@/lib/types";

const DEFAULT_REVALIDATE = 3600; // 1 hour fallback; on-demand is the primary path

interface FetchOpts {
  tags?: string[];
  revalidate?: number;
}

async function getJson<T>(path: string, opts: FetchOpts = {}): Promise<T | null> {
  try {
    const res = await fetch(backendUrl(path), {
      next: {
        revalidate: opts.revalidate ?? DEFAULT_REVALIDATE,
        tags: opts.tags ?? [],
      },
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchServices(params?: {
  category?: string;
  featured?: boolean;
}): Promise<ServiceListItem[]> {
  const q = new URLSearchParams();
  if (params?.category) q.set("category", params.category);
  if (params?.featured != null) q.set("featured", String(params.featured));
  const query = q.toString();
  const data = await getJson<ServiceListItem[]>(
    `/api/v1/public/services${query ? `?${query}` : ""}`,
    { tags: ["catalog", "services"] },
  );
  return data ?? [];
}

export async function fetchService(slug: string): Promise<ServiceDetail | null> {
  return getJson<ServiceDetail>(`/api/v1/public/services/${slug}`, {
    tags: ["services", `service:${slug}`],
  });
}

export async function fetchCategories(): Promise<CategoryPublic[]> {
  const data = await getJson<CategoryPublic[]>("/api/v1/public/categories", {
    tags: ["catalog", "categories"],
  });
  return data ?? [];
}

export async function fetchCategory(
  slug: string,
): Promise<CategoryDetail | null> {
  return getJson<CategoryDetail>(`/api/v1/public/categories/${slug}`, {
    tags: ["catalog", "categories", `category:${slug}`],
  });
}

export async function fetchLocations(): Promise<LocationListItem[]> {
  const data = await getJson<LocationListItem[]>("/api/v1/public/locations", {
    tags: ["locations"],
  });
  return data ?? [];
}

export async function fetchLocation(
  slug: string,
): Promise<LocationDetail | null> {
  return getJson<LocationDetail>(`/api/v1/public/locations/${slug}`, {
    tags: ["locations", `location:${slug}`],
  });
}

export async function fetchHomepage(): Promise<HomepageSection[]> {
  const data = await getJson<HomepageSection[]>("/api/v1/public/homepage", {
    tags: ["homepage"],
  });
  return data ?? [];
}

export async function fetchTestimonials(): Promise<Testimonial[]> {
  const data = await getJson<Testimonial[]>("/api/v1/public/testimonials", {
    tags: ["testimonials"],
  });
  return data ?? [];
}

export async function fetchFaqs(): Promise<FaqGroup[]> {
  const data = await getJson<FaqGroup[]>("/api/v1/public/faqs", {
    tags: ["faqs"],
  });
  return data ?? [];
}

export async function fetchPage(slug: string): Promise<PageContent | null> {
  return getJson<PageContent>(`/api/v1/public/pages/${slug}`, {
    tags: ["pages", `page:${slug}`],
  });
}

export async function fetchRedirect(
  path: string,
): Promise<{ to_path: string; status_code: number } | null> {
  return getJson(`/api/v1/public/redirects?path=${encodeURIComponent(path)}`, {
    revalidate: 300,
  });
}

export interface SiteSettings {
  site?: { name?: string; tagline?: string };
  contact?: {
    phone?: string;
    whatsapp?: string;
    email?: string;
    hours?: string;
  };
  nav?: { label: string; href: string }[];
  footer?: {
    columns?: { title: string; links: { label: string; href: string }[] }[];
  };
  social?: Record<string, string>;
  seo_defaults?: { title_suffix?: string; default_description?: string };
}

export async function fetchSettings(): Promise<SiteSettings> {
  const data = await getJson<SiteSettings>("/api/v1/public/settings", {
    tags: ["settings"],
  });
  return data ?? {};
}
