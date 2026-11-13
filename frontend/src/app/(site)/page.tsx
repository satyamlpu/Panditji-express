import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  ChevronRight,
  Clock,
  CreditCard,
  Flame,
  HandCoins,
  Headphones,
  MapPin,
  PackageCheck,
  Quote,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  UserCheck,
} from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { HeroSearch } from "@/components/site/HeroSearch";
import {
  fetchFaqs,
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

// Real photography cycled across service cards (services carry no image field).
const SERVICE_IMAGES = [
  "/images/griha-pravesh.png",
  "/images/hero-puja.png",
  "/images/aarti.png",
  "/images/samagri.png",
  "/images/kalash.png",
  "/images/deity.png",
  "/images/bells.png",
  "/images/om.png",
];

// Shown only if the CMS has no published FAQs yet (keeps the section complete).
const FALLBACK_FAQS = [
  { question: "How do I book a pandit?", answer: "Pick a puja, choose your city and date, and we match you with a verified, experienced pandit who confirms the details with you." },
  { question: "Are the pandits verified?", answer: "Yes. Every pandit is identity-verified and experienced in the rituals they perform, and families rate them after each puja." },
  { question: "Is the samagri included?", answer: "Where a puja lists samagri in its inclusions, we bring the complete kit — you don't need to arrange anything." },
  { question: "How is pricing shown?", answer: "Prices are transparent and shown up front on each puja. There are no hidden charges on the day of the ceremony." },
  { question: "Can I reschedule or cancel?", answer: "Yes — contact support before the scheduled time and we'll reschedule or cancel as per the policy for your booking." },
  { question: "Which cities do you serve?", answer: "We're expanding across Uttar Pradesh. Choose your city in the search above to see available pujas near you." },
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
  const [settings, sections, services, locations, testimonials, faqGroups] =
    await Promise.all([
      fetchSettings(),
      fetchHomepage(),
      fetchServices(),
      fetchLocations(),
      fetchTestimonials(),
      fetchFaqs(),
    ]);
  const faqs = faqGroups.flatMap((g) => g.items).slice(0, 6);

  const siteName = settings.site?.name ?? "Pandit Ji Express";
  const hero = section(sections, "hero");
  const cta = section(sections, "cta");

  const heroImg = hero?.image_url || FALLBACK.hero;
  const ctaImg = cta?.image_url || FALLBACK.cta;

  const testimonial = testimonials[0];
  const stats = [
    { value: `${services.length}`, label: "Pujas offered" },
    { value: `${locations.length}`, label: "Cities covered" },
    { value: "100%", label: "Samagri included" },
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

      {/* ── Hero: marketplace booking search ───────────────────────────────── */}
      <section className="relative overflow-hidden bg-ivory">
        <div className="container-pad relative grid items-center gap-10 py-10 md:grid-cols-[1.08fr_0.92fr] md:gap-14 md:py-20">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-pill border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-brand shadow-soft">
              <ShieldCheck size={14} className="text-saffron" aria-hidden /> India&rsquo;s trusted puja booking
            </p>
            <h1 className="font-deva text-[2.4rem] font-bold leading-[1.14] tracking-tight text-ink md:text-[3.3rem]">
              घर बैठे शुद्ध पूजा,
              <br />
              <span className="text-brand">अनुभवी पंडित&nbsp;जी</span> के साथ
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-ash md:text-lg">
              {hero?.subheading ??
                "Book verified pandits for authentic pujas at home — transparent pricing, complete samagri included, and on-time arrival."}
            </p>

            <HeroSearch
              services={services.map((s) => ({ slug: s.slug, label: s.title }))}
              locations={locations.map((l) => ({ slug: l.slug, label: l.city }))}
            />

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink/80">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck size={15} className="text-saffron" /> Verified pandits</span>
              <span className="inline-flex items-center gap-1.5"><HandCoins size={15} className="text-saffron" /> Transparent pricing</span>
              <span className="inline-flex items-center gap-1.5"><CalendarCheck size={15} className="text-saffron" /> On-time arrival</span>
            </div>
          </div>

          {/* Right: overlapping editorial image composition */}
          <div className="relative mx-auto w-full max-w-md md:mr-0">
            <div className="relative overflow-hidden rounded-[28px] shadow-soft-lg ring-1 ring-black/[0.06]">
              <div className="relative aspect-[4/5]">
                <Image
                  src={heroImg}
                  alt={`${siteName} — a traditional puja thali with diyas, marigold flowers and incense`}
                  fill
                  priority
                  sizes="(max-width: 768px) 88vw, 460px"
                  className="object-cover"
                />
              </div>
            </div>
            {/* overlapping deity image */}
            <div className="absolute -bottom-6 -left-5 hidden w-32 overflow-hidden rounded-[20px] shadow-soft-lg ring-[5px] ring-ivory sm:block md:-left-10 md:w-40">
              <div className="relative aspect-[3/4]">
                <Image src="/images/deity.png" alt="A golden deity idol adorned with marigold" fill sizes="160px" className="object-cover" />
              </div>
            </div>
            {/* floating verified chip */}
            <div className="absolute -right-2 top-6 flex items-center gap-2 rounded-[14px] bg-surface px-3.5 py-2 shadow-soft-lg ring-1 ring-black/[0.06] md:-right-5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-success/10 text-success">
                <ShieldCheck size={16} aria-hidden />
              </span>
              <span className="text-xs font-semibold leading-tight text-ink">
                Verified
                <span className="block font-normal text-muted">pandits only</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Service discovery grid ──────────────────────────────────────────── */}
      <section className="bg-bg">
        <div className="container-pad py-14 md:py-20">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-saffron-dark">
                Explore
              </p>
              <h2 className="font-display text-3xl font-bold text-ink md:text-4xl">
                Puja &amp; Services
              </h2>
            </div>
            <Link href="/puja-services" className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold text-brand hover:underline md:inline-flex">
              View all <ArrowRight size={15} />
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
            {services.slice(0, 8).map((s, i) => (
              <Link
                key={s.slug}
                href={`/book/${s.slug}`}
                className="group flex flex-col overflow-hidden rounded-[20px] border border-line bg-surface shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-soft-lg"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={SERVICE_IMAGES[i % SERVICE_IMAGES.length]}
                    alt={s.title}
                    fill
                    sizes="(max-width: 768px) 45vw, 260px"
                    className="object-cover transition duration-500 group-hover:scale-[1.06]"
                  />
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="line-clamp-1 font-display text-[15px] font-bold text-ink">
                    {s.title}
                  </h3>
                  {s.summary && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                      {s.summary}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <span className="text-sm font-bold text-brand">{s.price_display}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-saffron-dark">
                      Book <ArrowRight size={13} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center md:hidden">
            <Link href="/puja-services" className={buttonClasses("outline", "md")}>
              View all pujas <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── E. How booking works ───────────────────────────────────────────── */}
      <section className="border-y border-line bg-surface-2">
        <div className="container-pad py-14 md:py-20">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-saffron-dark">
              How it works
            </p>
            <h2 className="font-display text-3xl font-bold text-ink md:text-4xl">
              Book a pandit in four simple steps
            </h2>
          </div>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
            {[
              { icon: Search, t: "Select your puja", b: "Pick from Griha Pravesh, Satyanarayan, Havan and more — with transparent pricing." },
              { icon: MapPin, t: "Location & date", b: "Tell us your city and the date and time you'd like the ceremony." },
              { icon: UserCheck, t: "Get matched", b: "We assign a verified pandit who fits your puja, language and city." },
              { icon: BadgeCheck, t: "Confirm booking", b: "Review, confirm and relax — samagri and the full vidhi are handled." },
            ].map((s, i) => (
              <li key={s.t} className="rounded-[20px] border border-line bg-surface p-5 shadow-soft">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand text-white shadow-soft">
                    <s.icon size={20} aria-hidden />
                  </span>
                  <span className="font-display text-3xl font-bold text-line">0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-display text-[15px] font-bold text-ink">{s.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── D. Verified pandits ─────────────────────────────────────────────── */}
      <section className="bg-bg">
        <div className="container-pad grid items-center gap-12 py-16 md:grid-cols-2 md:gap-14">
          <div className="relative order-last md:order-first">
            <div className="overflow-hidden rounded-[24px] shadow-soft-lg ring-1 ring-black/[0.06]">
              <div className="relative aspect-[5/4]">
                <Image
                  src="/images/aarti.png"
                  alt="An experienced pandit performing aarti with diyas and marigold"
                  fill
                  sizes="(max-width: 768px) 90vw, 520px"
                  className="object-cover"
                />
              </div>
            </div>
            <div className="absolute -bottom-5 -right-2 flex items-center gap-2.5 rounded-[18px] bg-surface px-4 py-3 shadow-soft-lg ring-1 ring-black/[0.06] md:-right-6">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-success/10 text-success">
                <BadgeCheck size={18} aria-hidden />
              </span>
              <div className="text-xs leading-tight">
                <p className="font-bold text-ink">Verified before joining</p>
                <p className="text-muted">ID + experience checked</p>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-saffron-dark">
              Our pandits
            </p>
            <h2 className="font-display text-3xl font-bold text-ink md:text-4xl">
              Verified, experienced, matched to you
            </h2>
            <p className="mt-4 max-w-md text-muted">
              We verify every pandit&rsquo;s identity and ritual experience before they
              take a booking, then match you to the right one for your puja, language and
              city — so you can trust who comes home.
            </p>
            <ul className="mt-6 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {[
                { icon: BadgeCheck, t: "Identity verified" },
                { icon: Flame, t: "Ritual expertise" },
                { icon: Sparkles, t: "Language match" },
                { icon: Star, t: "Transparent reviews" },
              ].map((x) => (
                <li key={x.t} className="flex items-center gap-2.5 text-sm font-medium text-ink">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-saffron/10 text-saffron-dark">
                    <x.icon size={16} aria-hidden />
                  </span>
                  {x.t}
                </li>
              ))}
            </ul>
            <Link href="/puja-services" className={buttonClasses("primary", "md", "mt-8")}>
              Find a pandit <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── F. Why choose Panditji Express ──────────────────────────────────── */}
      <section className="border-y border-line bg-surface-2">
        <div className="container-pad grid gap-10 py-16 md:grid-cols-[0.85fr_1.15fr] md:gap-14 md:py-20">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-saffron-dark">
              Why {siteName}
            </p>
            <h2 className="font-display text-3xl font-bold text-ink md:text-4xl">
              The trusted way to book a puja
            </h2>
            {testimonial &&
              !/sample|placeholder/i.test(
                `${testimonial.quote} ${testimonial.author_name}`,
              ) && (
              <figure className="mt-7 rounded-[20px] border border-line bg-surface p-6 shadow-soft">
                <Quote size={22} className="text-saffron" aria-hidden />
                <blockquote className="mt-2 text-sm leading-relaxed text-ink">
                  “{testimonial.quote}”
                </blockquote>
                <figcaption className="mt-3 text-xs font-semibold text-muted">
                  {testimonial.author_name}
                  {testimonial.author_location ? ` · ${testimonial.author_location}` : ""}
                </figcaption>
              </figure>
            )}
          </div>
          <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {[
              { icon: ShieldCheck, t: "Verified pandits", b: "Background-checked and experienced in the rituals they perform." },
              { icon: HandCoins, t: "Transparent pricing", b: "Clear prices up front — no hidden charges on the day." },
              { icon: Flame, t: "Authentic rituals", b: "Every vidhi performed the traditional way, with the right samagri." },
              { icon: Clock, t: "Reliable scheduling", b: "On-time arrival, a confirmed date, and guidance throughout." },
              { icon: CreditCard, t: "Secure payments", b: "Protected, server-verified payments — never a client-only success." },
              { icon: Headphones, t: "Customer support", b: "Real people to help before, during and after your booking." },
            ].map((x) => (
              <li key={x.t} className="flex gap-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/[0.08] text-brand">
                  <x.icon size={18} aria-hidden />
                </span>
                <div>
                  <h3 className="font-display text-[15px] font-bold text-ink">{x.t}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{x.b}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Stat band ───────────────────────────────────────────────────────── */}
      <section className="bg-bg">
        <div className="container-pad py-14">
          <div className="grid gap-8 rounded-[28px] bg-brand px-8 py-10 text-white shadow-soft-lg md:grid-cols-[1.3fr_repeat(3,0.6fr)] md:items-center md:px-12">
            <div>
              <h2 className="font-display text-2xl font-semibold leading-snug">
                Authentic pujas,
                <br className="hidden md:block" /> across your city
              </h2>
              <Link href="/puja-services" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-swarna hover:underline">
                Explore pujas <ArrowRight size={15} />
              </Link>
            </div>
            {stats.map((s) => (
              <div key={s.label} className="border-l border-white/20 pl-5">
                <p className="font-display text-4xl font-bold text-swarna">{s.value}</p>
                <p className="mt-1 text-sm text-white/80">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── G. Samagri included ─────────────────────────────────────────────── */}
      <section className="border-y border-line bg-surface-2">
        <div className="container-pad py-16 md:py-20">
          <div className="max-w-xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-saffron-dark">
              Samagri included
            </p>
            <h2 className="font-display text-3xl font-bold text-ink md:text-4xl">
              The complete kit, prepared for you
            </h2>
            <p className="mt-3 text-muted">
              No running around markets. Where a puja lists samagri in its inclusions,
              we bring everything needed — fresh and ready for the vidhi.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-4">
            {GALLERY.map((g) => (
              <figure key={g.label} className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-soft">
                <div className="relative aspect-square">
                  <Image src={g.src} alt={g.label} fill sizes="(max-width:640px) 45vw, 240px" className="object-cover" />
                </div>
                <figcaption className="px-3 py-3 text-center text-sm font-semibold text-ink">
                  {g.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── H. Mobile app ───────────────────────────────────────────────────── */}
      <section className="bg-bg">
        <div className="container-pad py-16 md:py-20">
          <div className="grid items-center gap-10 overflow-hidden rounded-[28px] bg-brand px-8 py-12 text-white shadow-soft-lg md:grid-cols-2 md:gap-6 md:px-14 md:py-14">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-swarna">
                {siteName} app
              </p>
              <h2 className="font-display text-3xl font-bold leading-tight md:text-4xl">
                Your pujas, managed from your phone
              </h2>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Search, t: "Instant booking" },
                  { icon: CalendarCheck, t: "Scheduled booking" },
                  { icon: MapPin, t: "Live tracking" },
                  { icon: PackageCheck, t: "Booking management" },
                  { icon: CreditCard, t: "Secure payments" },
                ].map((x) => (
                  <li key={x.t} className="flex items-center gap-2.5 text-sm font-medium text-white/90">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-swarna">
                      <x.icon size={16} aria-hidden />
                    </span>
                    {x.t}
                  </li>
                ))}
              </ul>
              <p className="mt-7 inline-flex items-center gap-2 rounded-pill bg-white/10 px-4 py-2 text-sm font-semibold">
                <Smartphone size={16} className="text-swarna" aria-hidden /> Coming soon to iOS &amp; Android
              </p>
            </div>
            <div className="relative mx-auto w-[220px] md:w-[260px]">
              <div className="rounded-[2.2rem] border-[6px] border-white/15 bg-black/25 p-1.5 shadow-soft-lg">
                <div className="overflow-hidden rounded-[1.8rem]">
                  <div className="relative aspect-[9/19]">
                    <Image src="/images/hero-puja.png" alt={`${siteName} app preview`} fill sizes="260px" className="object-cover" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── I. FAQ ──────────────────────────────────────────────────────────── */}
      <section className="border-t border-line bg-surface-2">
        <div className="container-pad py-16 md:py-20">
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-saffron-dark">
                FAQ
              </p>
              <h2 className="font-display text-3xl font-bold text-ink md:text-4xl">
                Questions families ask
              </h2>
            </div>
            <div className="mt-8 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
              {(faqs.length ? faqs : FALLBACK_FAQS).map((f) => (
                <details
                  key={f.question}
                  className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-[15px] font-semibold text-ink">
                    {f.question}
                    <ChevronRight
                      size={18}
                      className="shrink-0 text-saffron transition-transform group-open:rotate-90"
                      aria-hidden
                    />
                  </summary>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted">{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────────── */}
      <section className="bg-bg">
        <div className="container-pad py-16">
          <div className="relative overflow-hidden rounded-[28px]">
            <Image
              src={ctaImg}
              alt="A decorated home entrance with marigold toran and rangoli for a Griha Pravesh puja"
              fill
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-charcoal/90 via-charcoal/70 to-charcoal/25" />
            <div className="relative px-8 py-14 text-center md:px-12 md:py-20">
              <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold leading-tight text-white md:text-4xl">
                {cta?.heading ?? "Planning a Griha Pravesh or a special puja?"}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-white/85">
                {cta?.subheading ??
                  "Tell us the occasion and your preferred date — we'll arrange an experienced pandit and confirm everything with you."}
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link href={cta?.cta_href ?? "/puja-services"} className={buttonClasses("primary", "lg")}>
                  {cta?.cta_label ?? "Browse pujas"} <ArrowRight size={18} />
                </Link>
                <Link
                  href="/contact-us"
                  className="inline-flex h-12 items-center justify-center rounded-pill border border-white/40 px-7 text-base font-semibold text-white hover:bg-white/10"
                >
                  Contact us
                </Link>
              </div>
            </div>
          </div>
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
