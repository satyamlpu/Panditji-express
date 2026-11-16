"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, MapPin, Search, Sparkles } from "lucide-react";

interface Opt {
  slug: string;
  label: string;
}

/**
 * Marketplace-style booking search. Real services + locations drive the
 * selects; submitting routes into the existing booking flow (/book/<service>)
 * or the catalogue, carrying location/date as prefill query params.
 */
export function HeroSearch({
  services,
  locations,
}: {
  services: Opt[];
  locations: Opt[];
}) {
  const router = useRouter();
  const [service, setService] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams();
    if (location) q.set("location", location);
    if (date) q.set("date", date);
    const base = service ? `/book/${service}` : "/puja-services";
    const query = q.toString();
    router.push(query ? `${base}?${query}` : base);
  }

  const fieldWrap =
    "flex min-w-0 flex-1 items-center gap-2.5 px-4 py-3 md:py-0";
  const selectCls =
    "w-full min-w-0 appearance-none bg-transparent text-sm font-medium text-ink outline-none";

  return (
    <form
      onSubmit={onSearch}
      className="mt-8 w-full max-w-xl rounded-[20px] border border-line bg-surface p-2 shadow-soft-lg"
      aria-label="Find a puja"
    >
      <div className="flex flex-col divide-y divide-line md:flex-row md:items-stretch md:divide-x md:divide-y-0">
        <label className={`${fieldWrap} md:py-3`}>
          <Sparkles size={18} className="shrink-0 text-saffron" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">
              Puja
            </span>
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              className={selectCls}
              aria-label="Choose a puja"
            >
              <option value="">Any puja</option>
              {services.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className={`${fieldWrap} md:py-3`}>
          <MapPin size={18} className="shrink-0 text-saffron" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">
              Location
            </span>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={selectCls}
              aria-label="Choose a location"
            >
              <option value="">Any city</option>
              {locations.map((l) => (
                <option key={l.slug} value={l.slug}>
                  {l.label}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className={`${fieldWrap} md:py-3`}>
          <CalendarDays size={18} className="shrink-0 text-saffron" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">
              Date
            </span>
            <input
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={selectCls}
              aria-label="Choose a date"
            />
          </span>
        </label>

        <button
          type="submit"
          className="m-1 inline-flex items-center justify-center gap-2 rounded-[14px] bg-brand px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover md:m-0 md:self-stretch"
        >
          <Search size={17} aria-hidden /> Search Panditji
        </button>
      </div>
    </form>
  );
}
