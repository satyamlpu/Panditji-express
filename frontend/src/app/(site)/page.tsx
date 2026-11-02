import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  HandCoins,
  PackageCheck,
  Quote,
  ShieldCheck,
} from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { HomePackages } from "@/components/site/HomePackages";
import {
  GoldCorner,
  Mandala,
  OrnamentDivider,
  OrnateFrame,
  SectionHeading,
} from "@/components/site/Ornaments";
import {
  fetchCategories,
  fetchHomepage,
  fetchLocations,
  fetchServices,
  fetchSettings,
  fetchTestimonials,
  type SiteSettings,
} from "@/lib/serverApi";
import { SITE_URL } from "@/lib/config";
import type { HomepageSection } from "@/lib/types";

export const revalidate = 3600;

const FALLBACK = {
  hero: "/images/hero-puja.png",
  feature: "/images/samagri.png",
  cta: "/images/griha-pravesh.png",
};

const GALLERY = [
  { src: "/images/kalash.png", label: "Kalash & coconut" },
  { src: "/images/bells.png", label: "Temple bells" },
  { src: "/images/aarti.png", label: "Aarti & deepak" },
  { src: "/images/om.png", label: "Sacred symbols" },
];

function section(sections: HomepageSection[], kind: string) {
  return sections.find((s) => s.kind === kind);
}

export async function generateMetadata(): Promise<Metadata> {
  const [settings, sections] = await Promise.all([fetchSettings(), fetchHomepage()]);
  const title =
    "Pandit Ji Express — Book pandits for authentic pujas, samagri included";
  const description =
    settings.site?.tagline ||
    "Book verified, experienced pandits for authentic pujas with transparent pricing and samagri included — at home, on time.";
  const img = section(sections, "hero")?.image_url || FALLBACK.hero;
  const ogImage = img.startsWith("http") ? img : `${SITE_URL}${img}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      title,
      description,
      url: "/",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default async function HomePage() {
  const [settings, sections, services, categories, locations, testimonials] =
    await Promise.all([
      fetchSettings(),
      fetchHomepage(),
      fetchServices(),
      fetchCategories(),
      fetchLocations(),
      fetchTestimonials(),
    ]);

  const siteName = settings.site?.name ?? "Pandit Ji Express";
  const hero = section(sections, "hero");
  const feature = section(sections, "feature");
  const cta = section(sections, "cta");

  const heroImg = hero?.image_url || FALLBACK.hero;
  const featureImg = feature?.image_url || FALLBACK.feature;
  const ctaImg = cta?.image_url || FALLBACK.cta;

  const testimonial = testimonials[0];
  const stats = [
    { value: `${services.length}`, label: "Pujas offered" },
    { value: `${locations.length}`, label: "Cities served" },
    { value: "100%", label: "Samagri included" },
  ];
  const steps = [
    { icon: CalendarCheck, title: "Choose & enquire", body: "Pick a puja and share your preferred date and location." },
    { icon: ShieldCheck, title: "We confirm", body: "We assign an experienced pandit and confirm the details with you." },
    { icon: PackageCheck, title: "Puja at home", body: "The pandit arrives on time with samagri and performs the vidhi." },
  ];
  const included = [
    "An experienced, verified pandit",
    "Complete samagri kit, prepared for you",
    "Full vidhi performed as per tradition",
    "On-time arrival and clear guidance throughout",
  ];
  const structuredData = buildLd({ siteName, settings, services });

  return (
    <>
      {structuredData.map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-surface-2">
        <Mandala className="pointer-events-none absolute -right-24 -top-28 h-[520px] w-[520px] text-gold opacity-[0.08]" />
        <Mandala className="pointer-events-none absolute -bottom-32 -left-28 h-80 w-80 text-carrot opacity-[0.06]" />
        <div className="container-pad relative grid items-center gap-12 py-12 md:grid-cols-[1.05fr_0.95fr] md:py-20">
          <div>
            <p className="mb-5 inline-flex items-center gap-2.5 rounded-pill border border-gold/30 bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-gold shadow-soft">
              <span className="h-1.5 w-1.5 rotate-45 bg-gold" /> Sacred puja services
            </p>
            <h1 className="font-display text-5xl font-bold leading-[1.03] tracking-tight text-ink md:text-6xl">
              {hero?.heading ?? "Sacred pujas, divine blessings"}
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
              {hero?.subheading ??
                settings.site?.tagline ??
                "Book experienced pandits for authentic pujas — at home, on time, with samagri included."}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Link href={hero?.cta_href ?? "/puja-services"} className={buttonClasses("accent", "lg")}>
                {hero?.cta_label ?? "Browse pujas"} <ArrowRight size={18} />
              </Link>
              <Link href="/how-it-works" className="text-sm font-semibold text-forest underline-offset-4 hover:underline">
                How it works
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink/80">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck size={15} className="text-gold" /> Experienced pandits</span>
              <span className="inline-flex items-center gap-1.5"><HandCoins size={15} className="text-gold" /> Transparent pricing</span>
              <span className="inline-flex items-center gap-1.5"><CalendarCheck size={15} className="text-gold" /> On-time arrival</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm md:mr-0 md:max-w-md">
            <OrnateFrame arch className="relative">
              <div className="relative aspect-[4/5]">
                <Image
                  src={heroImg}
                  alt={`${siteName} — a traditional puja thali with diyas, marigold flowers and incense`}
                  fill
                  priority
                  sizes="(max-width: 768px) 85vw, 420px"
                  className="object-cover"
                />
              </div>
            </OrnateFrame>
            <GoldCorner className="absolute -left-2 -top-2 h-8 w-8" />
            <GoldCorner className="absolute -right-2 -top-2 h-8 w-8 -scale-x-100" />
            {/* overlapping deity frame */}
            <div className="absolute -bottom-6 -left-8 hidden w-28 sm:block md:w-36">
              <OrnateFrame arch>
                <div className="relative aspect-[2/3]">
                  <Image src="/images/deity.png" alt="A golden deity idol adorned with marigold" fill sizes="150px" className="object-cover" />
                </div>
              </OrnateFrame>
            </div>
          </div>
        </div>
      </section>

      <div className="bg-surface-2 py-6">
        <OrnamentDivider />
      </div>

      {/* ── Stat band (premium dark) ──────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-maroon text-white">
        <Mandala className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 text-gold-soft opacity-[0.1]" />
        <div className="container-pad relative grid gap-8 py-12 md:grid-cols-[1.2fr_repeat(3,0.6fr)] md:items-center">
          <div>
            <h2 className="font-display text-2xl font-semibold leading-snug">
              Find harmony within,
              <br className="hidden md:block" /> radiate peace without
            </h2>
            <Link href="/puja-services" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-soft hover:underline">
              Explore pujas <ArrowRight size={15} />
            </Link>
          </div>
          {stats.map((s) => (
            <div key={s.label} className="border-l border-white/15 pl-5">
              <p className="font-display text-4xl font-bold text-gold-soft">{s.value}</p>
              <p className="mt-1 text-sm text-white/80">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why choose us + testimonial ───────────────────────────────────── */}
      <section className="bg-bg">
        <div className="container-pad grid items-center gap-14 py-16 md:grid-cols-2">
          <div className="relative order-last md:order-first">
            <OrnateFrame>
              <div className="relative aspect-[4/3]">
                <Image
                  src={featureImg}
                  alt="Puja samagri — brass kalash, bell, coconut, kumkum, turmeric, rice, marigold and incense"
                  fill
                  sizes="(max-width: 768px) 90vw, 520px"
                  className="object-cover"
                />
              </div>
            </OrnateFrame>
            {testimonial && (
              <figure className="absolute -bottom-8 right-2 max-w-[17rem] rounded-[20px] border border-gold/30 bg-surface p-5 shadow-soft-lg md:-right-6">
                <Quote size={20} className="text-gold" aria-hidden />
                <blockquote className="mt-2 text-sm leading-relaxed text-ink">“{testimonial.quote}”</blockquote>
                <figcaption className="mt-2 text-xs font-semibold text-muted">
                  {testimonial.author_name}
                  {testimonial.author_location ? ` · ${testimonial.author_location}` : ""}
                </figcaption>
              </figure>
            )}
          </div>

          <div>
            <p className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              <span className="h-px w-8 bg-gold/60" /> Why families choose us
            </p>
            <h2 className="font-display text-4xl font-bold text-ink">
              {feature?.heading ?? "Everything arranged, nothing to worry about"}
            </h2>
            <p className="mt-4 max-w-md text-muted">
              {feature?.body ??
                "Where a puja lists samagri under its inclusions, we bring the complete kit — so you don't have to run around gathering items."}
            </p>
            <ul className="mt-6 space-y-3">
              {included.map((item) => (
                <li key={item} className="flex items-start gap-3 text-ink">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold/15">
                    <Check size={13} className="text-gold" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link href={feature?.cta_href ?? "/puja-services"} className={buttonClasses("primary", "md", "mt-8")}>
              {feature?.cta_label ?? "See what's included"}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Traditional elements gallery ──────────────────────────────────── */}
      <section className="relative overflow-hidden border-y border-line bg-surface-2">
        <Mandala className="pointer-events-none absolute -right-20 top-6 h-72 w-72 text-gold opacity-[0.07]" />
        <div className="container-pad relative py-16">
          <SectionHeading
            eyebrow="Rooted in tradition"
            title="Performed the authentic way"
            subtitle="From the kalash to the final aarti, every ritual is done with the right samagri and care."
          />
          <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {GALLERY.map((g) => (
              <figure key={g.label} className="text-center">
                <div className="mx-auto w-full max-w-[12rem]">
                  <OrnateFrame arch>
                    <div className="relative aspect-[3/4]">
                      <Image src={g.src} alt={g.label} fill sizes="(max-width:640px) 45vw, 200px" className="object-cover" />
                    </div>
                  </OrnateFrame>
                </div>
                <figcaption className="mt-4 font-display text-sm font-semibold text-ink">
                  {g.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Centered deity showcase ───────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-bg">
        <Mandala className="pointer-events-none absolute left-1/2 top-10 h-[460px] w-[460px] -translate-x-1/2 text-carrot opacity-[0.06]" />
        <div className="container-pad relative flex flex-col items-center py-16 text-center">
          <div className="w-52 sm:w-60">
            <OrnateFrame arch>
              <div className="relative aspect-[2/3]">
                <Image src="/images/deity.png" alt="A serene golden deity idol with marigold and diyas" fill sizes="240px" className="object-cover" />
              </div>
            </OrnateFrame>
          </div>
          <div className="mt-8">
            <OrnamentDivider className="mb-5" />
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold text-ink md:text-4xl">
              Blessings for every occasion, performed with devotion
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted">
              From Griha Pravesh to festival pujas and grah shanti — an experienced
              pandit guides your family through every step, the traditional way.
            </p>
            <Link href="/puja-services" className={buttonClasses("outline", "md", "mt-7")}>
              Explore all pujas
            </Link>
          </div>
        </div>
      </section>

      {/* ── Packages (interactive) ────────────────────────────────────────── */}
      <section className="container-pad py-16">
        <SectionHeading
          eyebrow="Our pujas"
          title="Browse by what you need"
          subtitle="Transparent pricing and samagri included."
        />
        <div className="mt-10">
          {services.length ? (
            <HomePackages services={services} categories={categories} />
          ) : (
            <p className="rounded-card border border-dashed border-line bg-surface-2 px-6 py-12 text-center text-sm text-muted">
              Published pujas will appear here.
            </p>
          )}
        </div>
      </section>

      {/* ── Full-width band ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <Image src={ctaImg} alt="A decorated home entrance with a marigold toran and rangoli for a Griha Pravesh puja" fill sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-maroon/95 via-maroon/85 to-maroon/55" />
        <Mandala className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 text-gold-soft opacity-10" />
        <div className="container-pad relative py-20 text-center md:py-28">
          <OrnamentDivider className="mb-6" />
          <h2 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-tight text-white md:text-5xl">
            {cta?.heading ?? "Planning a Griha Pravesh or a special puja?"}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/85">
            {cta?.subheading ??
              "Tell us the occasion and your preferred date. We'll arrange an experienced pandit and confirm everything with you — no payment online."}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={cta?.cta_href ?? "/puja-services"} className={buttonClasses("accent", "lg")}>
              {cta?.cta_label ?? "Browse pujas"}
            </Link>
            <Link href="/contact-us" className="inline-flex h-12 items-center justify-center rounded-pill border border-white/40 px-7 text-base font-semibold text-white hover:bg-white/10">
              Contact us
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="bg-bg">
        <div className="container-pad py-16">
          <SectionHeading eyebrow="Simple & transparent" title="How it works" />
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="relative rounded-card border border-line bg-surface p-6 transition-colors hover:border-gold/40">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-gold/10 font-display text-lg font-bold text-gold">
                    {i + 1}
                  </span>
                  <step.icon size={20} className="text-forest" aria-hidden />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold text-ink">{step.title}</h3>
                <p className="mt-1 text-sm text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}

function buildLd({
  siteName,
  settings,
  services,
}: {
  siteName: string;
  settings: SiteSettings;
  services: { slug: string; title: string; price_rupees: number | null }[];
}) {
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: SITE_URL,
    ...(settings.contact?.phone
      ? { contactPoint: { "@type": "ContactPoint", telephone: settings.contact.phone, contactType: "customer service" } }
      : {}),
  };
  const website = { "@context": "https://schema.org", "@type": "WebSite", name: siteName, url: SITE_URL };
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Puja services",
    itemListElement: services.slice(0, 10).map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.title,
      url: `${SITE_URL}/puja-services/${s.slug}`,
    })),
  };
  return services.length ? [org, website, itemList] : [org, website];
}
