import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Check, Clock, Package } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { fetchRedirect, fetchService } from "@/lib/serverApi";
import { SITE_URL } from "@/lib/config";

export const revalidate = 3600;

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = await fetchService(slug);
  if (!service) return { title: "Puja not found" };
  const { seo } = service;
  return {
    title: seo.title,
    description: seo.description ?? undefined,
    alternates: { canonical: seo.canonical_path },
    openGraph: {
      title: seo.og_title,
      description: seo.og_description ?? undefined,
      url: seo.canonical_path,
      type: "website",
    },
  };
}

function Prose({ text }: { text: string }) {
  // Render admin-authored text as paragraphs without injecting raw HTML.
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-ink/90">
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p.replace(/\*(.+?)\*/g, "$1")}
        </p>
      ))}
    </div>
  );
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const service = await fetchService(slug);

  if (!service) {
    // A renamed slug keeps its old URL working with a permanent redirect.
    const redirect = await fetchRedirect(`/puja-services/${slug}`);
    if (redirect) permanentRedirect(redirect.to_path);
    notFound();
  }

  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    serviceType: "Puja",
    provider: { "@type": "Organization", name: "Pandit Ji Express" },
    ...(service.summary || service.description
      ? { description: service.summary ?? service.description ?? undefined }
      : {}),
    ...(service.price_rupees != null
      ? {
          offers: {
            "@type": "Offer",
            price: service.price_rupees,
            priceCurrency: "INR",
            availability: "https://schema.org/InStock",
            url: `${SITE_URL}${service.seo.canonical_path}`,
          },
        }
      : {}),
  };

  // FAQ markup only when there are genuine, visible FAQs on the page.
  const faqLd =
    service.faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: service.faqs.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }
      : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd) }}
      />
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}

      <div className="container-pad py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Puja Services", href: "/puja-services" },
            { label: service.title, href: service.seo.canonical_path },
          ]}
        />

        <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_340px] lg:items-start">
          {/* Main content */}
          <div>
            {service.category && (
              <Link
                href={`/puja-categories/${service.category.slug}`}
                className="text-xs font-semibold uppercase tracking-wide text-kiwi hover:underline"
              >
                {service.category.name}
              </Link>
            )}
            <h1 className="mt-1 font-display text-3xl font-bold text-ink md:text-4xl">
              {service.title}
            </h1>
            {service.summary && (
              <p className="mt-3 max-w-2xl text-lg text-muted">{service.summary}</p>
            )}

            {service.description && (
              <section className="mt-8">
                <h2 className="font-display text-xl font-semibold text-ink">
                  About this puja
                </h2>
                <div className="mt-3">
                  <Prose text={service.description} />
                </div>
              </section>
            )}

            {service.inclusions.length > 0 && (
              <section className="mt-8">
                <h2 className="font-display text-xl font-semibold text-ink">
                  What&rsquo;s included
                </h2>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {service.inclusions.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-ink">
                      <Check size={18} className="mt-0.5 shrink-0 text-forest" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {service.samagri.length > 0 && (
              <section className="mt-8">
                <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
                  <Package size={20} className="text-kiwi" /> Samagri
                </h2>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {service.samagri.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-ink">
                      <Check size={18} className="mt-0.5 shrink-0 text-forest" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {service.faqs.length > 0 && (
              <section className="mt-8">
                <h2 className="font-display text-xl font-semibold text-ink">
                  Frequently asked questions
                </h2>
                <dl className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
                  {service.faqs.map((f) => (
                    <div key={f.question} className="p-4">
                      <dt className="font-medium text-ink">{f.question}</dt>
                      <dd className="mt-1 text-sm text-muted">{f.answer}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>

          {/* Booking aside */}
          <aside className="lg:sticky lg:top-24">
            <div className="rounded-card border border-line bg-surface p-6 shadow-soft">
              {service.is_featured && (
                <Badge tone="sun" className="mb-3">
                  Popular
                </Badge>
              )}
              <p className="text-sm text-muted">Price</p>
              <p className="font-display text-3xl font-bold text-forest">
                {service.price_display}
              </p>
              {service.duration_label && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                  <Clock size={15} /> {service.duration_label}
                </p>
              )}
              <Link
                href={`/book/${service.slug}`}
                className={buttonClasses("accent", "lg", "mt-5 w-full")}
              >
                Book this puja
              </Link>
              <p className="mt-3 text-center text-xs text-muted">
                No payment now — we confirm details with you first.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
