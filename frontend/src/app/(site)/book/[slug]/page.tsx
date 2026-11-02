import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BookingForm } from "@/components/site/BookingForm";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { fetchRedirect, fetchService } from "@/lib/serverApi";

export const revalidate = 3600;

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = await fetchService(slug);
  if (!service) return { title: "Book a puja" };
  return {
    title: `Book ${service.title}`,
    description: `Send a booking enquiry for ${service.title}. We confirm the date, pandit and samagri with you.`,
    alternates: { canonical: `/book/${service.slug}` },
    // Booking forms are transactional; keep them out of the index.
    robots: { index: false, follow: true },
  };
}

export default async function BookPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const service = await fetchService(slug);

  if (!service) {
    const redirect = await fetchRedirect(`/book/${slug}`);
    if (redirect) permanentRedirect(redirect.to_path);
    notFound();
  }

  return (
    <div className="container-pad py-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Puja Services", href: "/puja-services" },
          { label: service.title, href: `/puja-services/${service.slug}` },
          { label: "Book", href: `/book/${service.slug}` },
        ]}
      />

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
        <div>
          <Link
            href={`/puja-services/${service.slug}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline"
          >
            <ArrowLeft size={15} /> Back to {service.title}
          </Link>
          <h1 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">
            Book {service.title}
          </h1>
          <p className="mt-2 max-w-xl text-muted">
            Share your details and we&rsquo;ll confirm the date, pandit and
            samagri with you. No payment is taken online.
          </p>
          <div className="mt-6">
            <BookingForm serviceSlug={service.slug} serviceTitle={service.title} />
          </div>
        </div>

        <aside className="rounded-card border border-line bg-surface-2 p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-semibold text-ink">
            {service.title}
          </h2>
          <p className="mt-1 font-display text-2xl font-bold text-forest">
            {service.price_display}
          </p>
          {service.duration_label && (
            <p className="text-sm text-muted">{service.duration_label}</p>
          )}
          {service.inclusions.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-sm text-ink">
              {service.inclusions.slice(0, 5).map((i) => (
                <li key={i}>• {i}</li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
