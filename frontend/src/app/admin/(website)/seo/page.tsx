"use client";

import { EmptyState, PageHeader } from "@/components/admin/kit";

export default function SeoPage() {
  return (
    <div>
      <PageHeader
        title="SEO"
        description="Meta tags, canonical URLs, Open Graph, sitemap and structured data."
      />
      <EmptyState
        icon="seo"
        title="SEO management arrives in the next phase"
        description="Per-page meta titles and descriptions, canonical URLs, Open Graph/Twitter cards, sitemap and robots configuration, and structured data are planned next. Pages already store meta title/description fields today."
      />
    </div>
  );
}
