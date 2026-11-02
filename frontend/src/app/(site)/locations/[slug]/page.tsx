import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PageHero } from "@/components/site/PageHero";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ServiceMiniCard } from "@/components/site/ServiceMiniCard";
import { EmptyState } from "@/components/site/EmptyState";
import { fetchLocation, fetchRedirect } from "@/lib/serverApi";

export const revalidate = 3600;

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const loc = await fetchLocation(slug);
  if (!loc) return { title: "Location not found" };
  return {
    title: loc.seo.title,
    description: loc.seo.description ?? undefined,
    alternates: { canonical: loc.seo.canonical_path },
    openGraph: { title: loc.seo.og_title, url: loc.seo.canonical_path },
  };
}

export default async function LocationPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const loc = await fetchLocation(slug);

  if (!loc) {
    const redirect = await fetchRedirect(`/locations/${slug}`);
    if (redirect) permanentRedirect(redirect.to_path);
    notFound();
  }

  return (
    <>
      <PageHero
        eyebrow="Service area"
        title={`Pujas in ${loc.city}`}
        description={
          loc.description ??
          `Book experienced pandits for authentic pujas across ${loc.city}.`
        }
      />
      <div className="container-pad py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Locations", href: "/locations" },
            { label: loc.city, href: `/locations/${loc.slug}` },
          ]}
        />
        <div className="mt-6">
          <h2 className="font-display text-xl font-semibold text-ink">
            Available pujas in {loc.city}
          </h2>
          <div className="mt-4">
            {loc.services.length ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {loc.services.map((s) => (
                  <ServiceMiniCard key={s.slug} service={s} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No pujas listed for this area yet"
                description="Service availability for this location will appear here once set."
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
