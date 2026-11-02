import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { EmptyState } from "@/components/site/EmptyState";
import { fetchLocations } from "@/lib/serverApi";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Service areas",
  description:
    "Cities and areas where Pandit Ji Express arranges experienced pandits for pujas.",
  alternates: { canonical: "/locations" },
};

export default async function LocationsPage() {
  const locations = await fetchLocations();

  return (
    <>
      <PageHero
        eyebrow="Service areas"
        title="Where we serve"
        description="We arrange experienced pandits for pujas across these areas. Don't see your city? Send an enquiry and we'll do our best to help."
      />
      <div className="container-pad py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Locations", href: "/locations" },
          ]}
        />
        <div className="mt-6">
          {locations.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {locations.map((loc) => (
                <Link
                  key={loc.slug}
                  href={`/locations/${loc.slug}`}
                  className="group flex items-center justify-between rounded-card border border-line bg-surface p-5 shadow-soft hover:shadow-soft-lg"
                >
                  <span className="flex items-center gap-3">
                    <MapPin className="text-forest" size={20} />
                    <span>
                      <span className="block font-display font-semibold text-ink">
                        {loc.city}
                      </span>
                      <span className="text-xs text-muted">
                        {loc.region ? `${loc.region} · ` : ""}
                        {loc.service_count} pujas available
                      </span>
                    </span>
                  </span>
                  <ArrowRight
                    size={18}
                    className="text-muted transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No service areas published yet"
              description="Published locations will appear here."
            />
          )}
        </div>
      </div>
    </>
  );
}
