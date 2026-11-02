import type { Metadata } from "next";
import { Clock, Mail, MessageCircle, Phone } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ContactForm } from "@/components/site/ContactForm";
import { fetchPage, fetchSettings } from "@/lib/serverApi";
import { renderMarkdown } from "@/lib/markdown";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage("contact-us");
  return {
    title: page?.seo.title ?? "Contact us",
    description:
      page?.seo.description ??
      "Get in touch with Pandit Ji Express to book a puja or ask a question.",
    alternates: { canonical: "/contact-us" },
  };
}

export default async function ContactPage() {
  const [page, settings] = await Promise.all([
    fetchPage("contact-us"),
    fetchSettings(),
  ]);
  const c = settings.contact ?? {};
  const bodyHtml = renderMarkdown(page?.body);

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Get in touch"
        description="Have a question or want to book a puja? Send us a message and we'll respond shortly."
      />
      <div className="container-pad py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Contact", href: "/contact-us" },
          ]}
        />

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
          <ContactForm />

          <aside className="rounded-card border border-line bg-surface-2 p-6">
            <h2 className="font-display text-lg font-semibold text-ink">
              Reach us directly
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              {c.phone && (
                <li className="flex items-center gap-3">
                  <Phone size={17} className="text-forest" />
                  <a href={`tel:${c.phone}`} className="text-ink hover:text-forest">
                    {c.phone}
                  </a>
                </li>
              )}
              {c.whatsapp && (
                <li className="flex items-center gap-3">
                  <MessageCircle size={17} className="text-forest" />
                  <span className="text-ink">{c.whatsapp} (WhatsApp)</span>
                </li>
              )}
              {c.email && (
                <li className="flex items-center gap-3">
                  <Mail size={17} className="text-forest" />
                  <a href={`mailto:${c.email}`} className="text-ink hover:text-forest">
                    {c.email}
                  </a>
                </li>
              )}
              {c.hours && (
                <li className="flex items-center gap-3">
                  <Clock size={17} className="text-forest" />
                  <span className="text-muted">{c.hours}</span>
                </li>
              )}
            </ul>
            {bodyHtml && (
              <div
                className="prose mt-5 border-t border-line pt-4 text-sm"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
