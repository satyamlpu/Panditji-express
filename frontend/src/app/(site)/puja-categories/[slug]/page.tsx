import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/site/PageHero";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ServiceMiniCard } from "@/components/site/ServiceMiniCard";
import { EmptyState } from "@/components/site/EmptyState";
import { fetchCategory } from "@/lib/serverApi";

export const revalidate = 3600;

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cat = await fetchCategory(slug);
  if (!cat) return { title: "Category not found" };
  return {
    title: cat.seo.title,
    description: cat.seo.description ?? undefined,
    alternates: { canonical: cat.seo.canonical_path },
    openGraph: { title: cat.seo.og_title, url: cat.seo.canonical_path },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const cat = await fetchCategory(slug);
  if (!cat) notFound();

  return (
    <>
      <PageHero
        eyebrow="Category"
        title={cat.name}
        description={cat.description ?? undefined}
      />
      <div className="container-pad py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Puja Services", href: "/puja-services" },
            { label: cat.name, href: `/puja-categories/${cat.slug}` },
          ]}
        />
        <div className="mt-6">
          {cat.services.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {cat.services.map((s) => (
                <ServiceMiniCard key={s.slug} service={s} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No pujas in this category yet"
              description="Published pujas in this category will appear here."
            />
          )}
        </div>
      </div>
    </>
  );
}
