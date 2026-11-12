import Link from "next/link";
import { Mandala } from "@/components/site/Ornaments";
import type { SiteSettings } from "@/lib/serverApi";

const FALLBACK_COLUMNS = [
  {
    title: "Services",
    links: [
      { label: "All pujas", href: "/puja-services" },
      { label: "Locations", href: "/locations" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", href: "/about-us" },
      { label: "Testimonials", href: "/testimonials" },
      { label: "FAQs", href: "/faqs" },
      { label: "Contact", href: "/contact-us" },
    ],
  },
  {
    title: "Policies",
    links: [
      { label: "Privacy policy", href: "/privacy-policy" },
      { label: "Terms & conditions", href: "/terms-and-conditions" },
      { label: "Cancellation & refund", href: "/cancellation-refund-policy" },
    ],
  },
];

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const siteName = settings.site?.name ?? "Pandit Ji Express";
  const columns = settings.footer?.columns?.length
    ? settings.footer.columns
    : FALLBACK_COLUMNS;
  const contact = settings.contact ?? {};
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-16 overflow-hidden border-t border-line bg-surface">
      <Mandala className="pointer-events-none absolute -right-20 -top-16 h-72 w-72 text-gold opacity-[0.06]" />
      <div className="container-pad relative grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-full.svg" alt={siteName} className="h-10 w-auto" />
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted">
            {settings.site?.tagline ??
              "Book experienced pandits for authentic pujas — at home, on time."}
          </p>
          {(contact.phone || contact.email) && (
            <div className="mt-4 space-y-1 text-sm text-ink">
              {contact.phone && <p>Call: {contact.phone}</p>}
              {contact.email && <p>Email: {contact.email}</p>}
              {contact.hours && <p className="text-muted">{contact.hours}</p>}
            </div>
          )}
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="font-display text-sm font-semibold text-forest">
              {col.title}
            </h3>
            <ul className="mt-3 space-y-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted hover:text-forest"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-pad flex flex-col items-center justify-between gap-2 py-4 text-xs text-muted sm:flex-row">
          <p>
            © {year} {siteName}. All rights reserved.
          </p>
          <p>Authentic pujas • Transparent pricing • Samagri included</p>
        </div>
      </div>
    </footer>
  );
}
