import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { CatalogClient } from "@/components/site/CatalogClient";
import { fetchCategories, fetchServices } from "@/lib/serverApi";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Puja Services — browse and book pujas",
  description:
    "Explore our full catalogue of pujas with transparent pricing, inclusions and samagri. Book an experienced pandit for your occasion.",
  alternates: { canonical: "/puja-services" },
  openGraph: {
    title: "Puja Services — Pandit Ji Express",
    description:
      "Explore our full catalogue of pujas with transparent pricing and samagri included.",
    url: "/puja-services",
  },
};

export default async function CatalogPage() {
  const [services, categories] = await Promise.all([
    fetchServices(),
    fetchCategories(),
  ]);

  return (
    <>
      <PageHero
        eyebrow="Puja Services"
        title="Browse our pujas"
        description="Transparent pricing, clear inclusions and samagri — choose a puja and book an experienced pandit."
      />
      <div className="container-pad py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Puja Services", href: "/puja-services" },
          ]}
        />
        <div className="mt-6">
          <CatalogClient services={services} categories={categories} />
        </div>
      </div>
    </>
  );
}
