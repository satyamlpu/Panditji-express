import type { MetadataRoute } from "next";
import { backendUrl, SITE_URL } from "@/lib/config";

interface Entry {
  path: string;
  lastmod: string | null;
}

/** XML sitemap of indexable, canonical, PUBLISHED public URLs. Dynamic entries
 * (pujas, categories) come from the backend, which only emits published items;
 * drafts and transactional routes (/book, /admin) are deliberately excluded. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    "/",
    "/puja-services",
    "/locations",
    "/how-it-works",
    "/about-us",
    "/testimonials",
    "/faqs",
    "/contact-us",
    "/privacy-policy",
    "/terms-and-conditions",
    "/cancellation-refund-policy",
  ];

  let dynamic: Entry[] = [];
  try {
    const res = await fetch(backendUrl("/api/v1/public/sitemap"), {
      next: { revalidate: 3600, tags: ["catalog"] },
    });
    if (res.ok) dynamic = (await res.json()) as Entry[];
  } catch {
    dynamic = [];
  }

  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((p) => ({
    url: `${SITE_URL}${p}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: p === "/" ? 1 : 0.7,
  }));

  const dynamicEntries: MetadataRoute.Sitemap = dynamic.map((e) => ({
    url: `${SITE_URL}${e.path}`,
    lastModified: e.lastmod ? new Date(e.lastmod) : now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...dynamicEntries];
}
