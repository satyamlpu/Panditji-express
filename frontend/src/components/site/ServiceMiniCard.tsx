import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ServiceCard } from "@/lib/types";

/** Compact service card for category/location listings (lean data shape). */
export function ServiceMiniCard({ service }: { service: ServiceCard }) {
  return (
    <article className="group relative flex flex-col rounded-card border border-line bg-surface p-5 shadow-soft transition-shadow hover:shadow-soft-lg">
      <h3 className="font-display text-lg font-semibold text-ink">
        <Link
          href={`/puja-services/${service.slug}`}
          className="after:absolute after:inset-0"
        >
          {service.title}
        </Link>
      </h3>
      {service.summary && (
        <p className="mt-2 line-clamp-2 text-sm text-muted">{service.summary}</p>
      )}
      <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
        <div>
          <p className="font-display text-xl font-bold text-forest">
            {service.price_display}
          </p>
          {service.duration_label && (
            <p className="text-xs text-muted">{service.duration_label}</p>
          )}
        </div>
        <span className="relative z-10 inline-flex items-center gap-1 text-sm font-semibold text-forest">
          View
          <ArrowRight
            size={16}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </article>
  );
}
