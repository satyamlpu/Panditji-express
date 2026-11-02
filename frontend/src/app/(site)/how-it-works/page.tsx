import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarCheck,
  ClipboardList,
  PackageCheck,
  PhoneCall,
  Sparkles,
} from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { buttonClasses } from "@/components/ui/button";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Booking a puja with Pandit Ji Express is simple: choose a puja, send an enquiry, and we confirm the pandit, date and samagri with you.",
  alternates: { canonical: "/how-it-works" },
};

const STEPS = [
  {
    icon: ClipboardList,
    title: "Choose your puja",
    body: "Browse the catalogue and open a puja to see what it includes, the samagri provided and the price.",
  },
  {
    icon: CalendarCheck,
    title: "Send an enquiry",
    body: "Share your name, phone, preferred date and city. No payment is taken online.",
  },
  {
    icon: PhoneCall,
    title: "We confirm the details",
    body: "Our team contacts you to assign an experienced pandit and confirm the date, timing and samagri.",
  },
  {
    icon: Sparkles,
    title: "Puja performed at home",
    body: "The pandit arrives on time and performs the vidhi as per tradition, guiding your family throughout.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="From enquiry to puja, step by step"
        description="A simple, transparent process — no online payment, no surprises."
      />
      <div className="container-pad py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "How it works", href: "/how-it-works" },
          ]}
        />

        <ol className="mt-8 grid gap-5 md:grid-cols-2">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="rounded-card border border-line bg-surface p-6 shadow-soft"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-forest/10 font-display text-lg font-bold text-forest">
                  {i + 1}
                </span>
                <step.icon size={22} className="text-kiwi" aria-hidden />
              </div>
              <h2 className="mt-4 font-display text-lg font-semibold text-ink">
                {step.title}
              </h2>
              <p className="mt-1 text-sm text-muted">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-card border border-line bg-surface-2 p-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <PackageCheck className="text-forest" size={24} />
            <p className="text-sm text-ink">
              Samagri is included wherever it&rsquo;s listed under a puja&rsquo;s
              inclusions — one less thing to arrange.
            </p>
          </div>
          <Link
            href="/puja-services"
            className={buttonClasses("accent", "md", "shrink-0")}
          >
            Browse pujas
          </Link>
        </div>
      </div>
    </>
  );
}
