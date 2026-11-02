import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { EmptyState } from "@/components/site/EmptyState";
import { fetchFaqs } from "@/lib/serverApi";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "FAQs",
  description:
    "Answers to common questions about booking pujas, pricing, samagri and service areas.",
  alternates: { canonical: "/faqs" },
};

export default async function FaqsPage() {
  const groups = await fetchFaqs();
  const allItems = groups.flatMap((g) => g.items);

  const faqLd =
    allItems.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: allItems.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }
      : null;

  return (
    <>
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}
      <PageHero
        eyebrow="FAQs"
        title="Frequently asked questions"
        description="Everything you need to know about booking a puja with us."
      />
      <div className="container-pad py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "FAQs", href: "/faqs" },
          ]}
        />
        <div className="mt-6 max-w-2xl space-y-8">
          {groups.length ? (
            groups.map((group) => (
              <section key={group.topic}>
                <h2 className="mb-3 font-display text-lg font-semibold text-forest">
                  {group.topic}
                </h2>
                <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
                  {group.items.map((item) => (
                    <details key={item.question} className="group">
                      <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 font-medium text-ink marker:content-none">
                        {item.question}
                        <ChevronDown
                          size={18}
                          className="shrink-0 text-muted transition-transform group-open:rotate-180"
                        />
                      </summary>
                      <p className="px-4 pb-4 text-sm text-muted">{item.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))
          ) : (
            <EmptyState
              title="No FAQs published yet"
              description="Answers to common questions will appear here."
            />
          )}
        </div>
      </div>
    </>
  );
}
