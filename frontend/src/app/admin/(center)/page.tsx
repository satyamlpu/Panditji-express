"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { servicesApi } from "@/features/services/api";
import { enquiriesApi } from "@/features/enquiries/api";
import { mpApi } from "@/features/marketplace/api";
import { MODULES } from "@/config/admin-nav";
import { Icon, type IconName } from "@/components/admin/icons";

export default function ControlCenter() {
  const { data: me } = useAuth();

  const services = useQuery({
    queryKey: ["cc", "services"],
    queryFn: () => servicesApi.list({}),
  });
  const enquiries = useQuery({
    queryKey: ["cc", "enquiries"],
    queryFn: () => enquiriesApi.list({}),
  });
  const ops = useQuery({
    queryKey: ["cc", "ops"],
    queryFn: () => mpApi.dashboard(),
  });

  const items = services.data?.items ?? [];
  const published = items.filter((s) => s.status === "published").length;
  const drafts = items.filter((s) => s.status === "draft").length;
  const newEnquiries = enquiries.data?.items.filter((e) => e.status === "new").length ?? 0;

  const websiteStats = [
    { label: "Published", value: published, loading: services.isLoading },
    { label: "Drafts", value: drafts, loading: services.isLoading },
    { label: "New enquiries", value: newEnquiries, loading: enquiries.isLoading },
  ];
  const appStats = [
    { label: "Bookings today", value: ops.data?.bookings_today ?? 0, loading: ops.isLoading },
    { label: "Partners online", value: ops.data?.partners_online ?? 0, loading: ops.isLoading },
    { label: "Pending KYC", value: ops.data?.pending_verifications ?? 0, loading: ops.isLoading },
  ];

  const firstName = me?.email?.split("@")[0] ?? "there";

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 md:px-8 md:py-14">
      <p className="text-sm font-medium text-muted">Welcome back, {firstName}</p>
      <h1 className="mt-1 font-display text-3xl font-bold text-ink">Admin Control Center</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Choose a workspace. Website Management controls the public site; App &amp; CRM runs the
        marketplace, partners and operations. The two are independent — pick where you want to work.
      </p>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <ModuleCard
          href={MODULES.website.home}
          icon={MODULES.website.icon}
          eyebrow="Module 01"
          title={MODULES.website.label}
          description={MODULES.website.description}
          stats={websiteStats}
          features={["Pages & Homepage", "Services & Categories", "Media & SEO", "Testimonials, FAQs, Enquiries"]}
          cta="Open Website Management"
        />
        <ModuleCard
          href={MODULES.app.home}
          icon={MODULES.app.icon}
          eyebrow="Module 02"
          title={MODULES.app.label}
          description={MODULES.app.description}
          stats={appStats}
          features={["Customers & Partners", "Bookings & Live Ops", "Finance & Payouts", "Reviews & Support"]}
          cta="Open App & CRM"
          accent
        />
      </div>
    </div>
  );
}

function ModuleCard({
  href,
  icon,
  eyebrow,
  title,
  description,
  stats,
  features,
  cta,
  accent,
}: {
  href: string;
  icon: IconName;
  eyebrow: string;
  title: string;
  description: string;
  stats: { label: string; value: number; loading: boolean }[];
  features: string[];
  cta: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-card border border-line bg-surface p-6 shadow-soft transition-shadow hover:shadow-soft-lg"
    >
      <div className="flex items-start justify-between">
        <span
          className={
            accent
              ? "grid h-12 w-12 place-items-center rounded-xl bg-forest text-sunshine"
              : "grid h-12 w-12 place-items-center rounded-xl bg-forest/10 text-forest"
          }
        >
          <Icon name={icon} size={24} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">
          {eyebrow}
        </span>
      </div>

      <h2 className="mt-4 font-display text-xl font-bold text-ink">{title}</h2>
      <p className="mt-1.5 text-sm text-muted">{description}</p>

      <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl border border-line bg-surface-2 p-3">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-2xl font-semibold tabular-nums text-forest">
              {s.loading ? "—" : s.value}
            </p>
            <p className="text-[11px] leading-tight text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-1.5 text-xs text-ink/80">
            <Icon name="chevronRight" size={13} className="text-forest" />
            {f}
          </li>
        ))}
      </ul>

      <span className="mt-6 inline-flex items-center gap-1.5 self-start rounded-pill bg-forest px-4 py-2 text-sm font-semibold text-white transition-transform group-hover:translate-x-0.5">
        {cta}
        <Icon name="arrowRight" size={16} />
      </span>
    </Link>
  );
}
