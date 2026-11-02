"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ServiceCard } from "@/components/site/ServiceCard";
import { EmptyState } from "@/components/site/EmptyState";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CategoryPublic, ServiceListItem } from "@/lib/types";

/** Client-side search + category filter over the full, server-rendered list.
 * The complete catalog is already in the initial HTML (crawlable); this only
 * narrows what is shown. */
export function CatalogClient({
  services,
  categories,
}: {
  services: ServiceListItem[];
  categories: CategoryPublic[];
}) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s) => {
      if (cat && s.category?.slug !== cat) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        (s.summary ?? "").toLowerCase().includes(q)
      );
    });
  }, [services, query, cat]);

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search pujas…"
            aria-label="Search pujas"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {categories.length > 0 && (
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Filter by category"
          >
            <FilterChip active={cat === null} onClick={() => setCat(null)}>
              All
            </FilterChip>
            {categories.map((c) => (
              <FilterChip
                key={c.slug}
                active={cat === c.slug}
                onClick={() => setCat(c.slug)}
              >
                {c.name}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 text-sm text-muted" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? "puja" : "pujas"}
      </p>

      {filtered.length ? (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <ServiceCard key={s.slug} service={s} />
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState
            title="No pujas match your search"
            description="Try a different keyword or clear the category filter."
          />
        </div>
      )}
    </div>
  );
}

function FilterChip({
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
        "rounded-pill border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-forest bg-forest text-white"
          : "border-line bg-surface text-ink hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}
