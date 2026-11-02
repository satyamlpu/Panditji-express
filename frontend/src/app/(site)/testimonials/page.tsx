import type { Metadata } from "next";
import { Quote, Star } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { EmptyState } from "@/components/site/EmptyState";
import { fetchTestimonials } from "@/lib/serverApi";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Testimonials",
  description:
    "What families say about their puja experience with Pandit Ji Express.",
  alternates: { canonical: "/testimonials" },
};

export default async function TestimonialsPage() {
  const testimonials = await fetchTestimonials();

  return (
    <>
      <PageHero
        eyebrow="Testimonials"
        title="What families say"
        description="Genuine feedback from customers we've served."
      />
      <div className="container-pad py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Testimonials", href: "/testimonials" },
          ]}
        />
        <div className="mt-6">
          {testimonials.length ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {testimonials.map((t, i) => (
                <figure
                  key={i}
                  className="flex flex-col rounded-card border border-line bg-surface p-6 shadow-soft"
                >
                  <Quote className="text-kiwi" size={24} aria-hidden />
                  {t.rating != null && (
                    <div
                      className="mt-2 flex gap-0.5"
                      aria-label={`${t.rating} out of 5`}
                    >
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star
                          key={s}
                          size={15}
                          className={
                            s < t.rating!
                              ? "fill-sunshine text-sunshine"
                              : "text-line"
                          }
                        />
                      ))}
                    </div>
                  )}
                  <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed text-ink/90">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-4 border-t border-line pt-3 text-sm">
                    <span className="font-semibold text-ink">
                      {t.author_name}
                    </span>
                    {(t.author_location || t.service_label) && (
                      <span className="block text-muted">
                        {[t.service_label, t.author_location]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No testimonials published yet"
              description="Authorised customer feedback will appear here."
            />
          )}
        </div>
      </div>
    </>
  );
}
