import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { fetchSettings, type SiteSettings } from "@/lib/serverApi";
import { SITE_URL } from "@/lib/config";

// Site-wide SEO defaults driven by the admin SEO settings. Per-page metadata
// (title/description/canonical) still overrides these.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchSettings();
  const seo = settings.seo ?? {};
  const meta: Metadata = {};
  if (seo.noindex) {
    // Global noindex (e.g. before public launch) — keeps the site out of search.
    meta.robots = { index: false, follow: false };
  }
  if (seo.default_og_image) {
    meta.openGraph = { images: [{ url: seo.default_og_image }] };
  }
  return meta;
}

function organizationJsonLd(settings: SiteSettings): Record<string, unknown> | null {
  const org = settings.seo?.organization;
  const name = org?.name ?? settings.site?.name;
  if (!name) return null;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url: SITE_URL,
  };
  if (org?.logo_url) data.logo = org.logo_url;
  if (org?.phone) data.telephone = org.phone;
  const sameAs = org?.same_as ?? Object.values(settings.social ?? {});
  if (sameAs.length) data.sameAs = sameAs;
  return data;
}

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await fetchSettings();
  const siteName = settings.site?.name ?? "Pandit Ji Express";
  const jsonLd = organizationJsonLd(settings);

  return (
    <div className="flex min-h-screen flex-col">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <SiteHeader siteName={siteName} nav={settings.nav} />
      <main className="flex-1">{children}</main>
      <SiteFooter settings={settings} />
    </div>
  );
}
