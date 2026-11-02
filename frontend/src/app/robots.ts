import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

/** robots.txt — allow public pages, keep the admin and transactional/API
 * routes out of the index, and point crawlers at the sitemap. */
export default function robots(): MetadataRoute.Robots {
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
