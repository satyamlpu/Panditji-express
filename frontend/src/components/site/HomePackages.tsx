"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ServiceCard } from "@/components/site/ServiceCard";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CategoryPublic, ServiceListItem } from "@/lib/types";

/** Interactive package browser for the homepage: filter published pujas by
 * category (client-side over the server-rendered list — all cards are in the
 * initial HTML, so it stays crawlable). */
export function HomePackages({
  services,
  categories,
  limit = 6,
}: {
  services: ServiceListItem[];
  categories: CategoryPublic[];
  limit?: number;
}) {
  const [cat, setCat] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = cat
      ? services.filter((s) => s.category?.slug === cat)
      : services;
    return list.slice(0, limit);
  }, [services, cat, limit]);

  // Only show category chips that actually contain services.
  const usable = categories.filter((c) =>
    services.some((s) => s.category?.slug === c.slug),
  );

  return (
    <div>
      {usable.length > 0 && (
        <div
          className="mb-6 flex flex-wrap gap-2"
          role="group"
          aria-label="Filter packages by category"
        >
          <Chip active={cat === null} onClick={() => setCat(null)}>
            All pujas
          </Chip>
          {usable.map((c) => (
            <Chip key={c.slug} active={cat === c.slug} onClick={() => setCat(c.slug)}>
              {c.name}
            </Chip>
          ))}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s) => (
          <ServiceCard key={s.slug} service={s} />
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link href="/puja-services" className={buttonClasses("outline", "md")}>
          View all pujas
        </Link>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-pill border px-4 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-forest bg-forest text-white"
          : "border-line bg-surface text-ink hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}
