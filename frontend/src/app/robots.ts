import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { fetchSettings } from "@/lib/serverApi";

/** robots.txt — allow public pages, keep the admin and transactional/API routes
 * out of the index, and point crawlers at the sitemap. Honors the admin SEO
 * "noindex" switch (e.g. before public launch), which disallows everything. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await fetchSettings();
  if (settings.seo?.noindex) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
      host: SITE_URL,
    };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/book/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
