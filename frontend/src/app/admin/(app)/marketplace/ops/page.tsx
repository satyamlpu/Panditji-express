"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, MapPin, Navigation, Users } from "lucide-react";
import {
  mpApi,
  type OpsAlert,
  type OpsMap,
  type OpsMapPartner,
} from "@/features/marketplace/api";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

function mins(sec: number) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

const ALERT_LABEL: Record<string, string> = {
  stuck_dispatch: "Stuck in dispatch",
  no_partner: "No partner found",
  stale_location: "Stale GPS",
};

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3 shadow-soft">
      <p className={cn("text-2xl font-bold tabular-nums text-ink", tone)}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

/** Dependency-free schematic position view of REAL coordinates (no street
 *  basemap / no external tiles). North is up; axes are relative, not to scale. */
function OpsMapView({ map }: { map: OpsMap }) {
  const W = 640, H = 340, P = 22;
  const pts = [
    ...map.partners.map((p) => ({ lat: p.lat, lng: p.lng })),
    ...map.destinations.map((d) => ({ lat: d.lat, lng: d.lng })),
  ];
  if (!pts.length)
    return (
      <p className="rounded-card border border-line bg-surface-2 px-4 py-10 text-center text-sm text-muted">
        No partners online or active bookings to plot right now.
      </p>
    );

  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  let [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  if (maxLat - minLat < 1e-4) { minLat -= 0.01; maxLat += 0.01; }
  if (maxLng - minLng < 1e-4) { minLng -= 0.01; maxLng += 0.01; }
  const x = (lng: number) => P + ((lng - minLng) / (maxLng - minLng)) * (W - 2 * P);
  const y = (lat: number) => P + ((maxLat - lat) / (maxLat - minLat)) * (H - 2 * P);

  const partnerTone = (p: OpsMapPartner) =>
    p.availability === "online" ? "text-forest" : "text-[#7a5a00]";

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-soft">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full bg-surface-2" role="img" aria-label="Partner and booking position map">
        {map.destinations.map((d) => (
          <g key={d.code} className="text-tomato">
            <rect x={x(d.lng) - 4} y={y(d.lat) - 4} width="8" height="8" fill="currentColor" opacity="0.85" />
            <title>{`Booking ${d.code} · ${d.status}`}</title>
          </g>
        ))}
        {map.partners.map((p) => (
          <g key={p.id} className={partnerTone(p)}>
            <circle
              cx={x(p.lng)} cy={y(p.lat)} r={p.is_live ? 6 : 5}
              fill={p.is_live ? "currentColor" : "transparent"}
              stroke="currentColor" strokeWidth="2"
            />
            <title>{`${p.name ?? "Partner"} · ${p.availability} · ${p.is_live ? "live GPS" : "base location"}`}</title>
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-4 border-t border-line px-4 py-2 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-forest" /> Online partner</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[#7a5a00]" /> Busy (base loc)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 bg-tomato" /> Booking destination</span>
        <span className="ml-auto italic">Schematic — relative real coordinates, no street basemap</span>
      </div>
    </div>
  );
}

function AlertRow({ a }: { a: OpsAlert }) {
  return (
    <Link
      href={`/admin/marketplace/bookings/${a.id}`}
      className="flex items-center justify-between gap-2 rounded-lg border border-tomato/30 bg-tomato/5 px-3 py-2 text-sm hover:bg-tomato/10"
    >
      <span className="flex min-w-0 items-center gap-2">
        <AlertTriangle size={14} className="shrink-0 text-tomato" />
        <span className="font-medium text-ink">{a.code}</span>
        <span className="text-muted">· {ALERT_LABEL[a.kind] ?? a.kind}</span>
      </span>
      {a.since_seconds !== null ? <span className="shrink-0 text-xs text-tomato">{mins(a.since_seconds)}</span> : null}
    </Link>
  );
}

export default function LiveOpsPage() {
  const overview = useQuery({
    queryKey: ["mp", "ops", "overview"],
    queryFn: () => mpApi.opsOverview(),
    refetchInterval: 10_000,
  });
  const map = useQuery({
    queryKey: ["mp", "ops", "map"],
    queryFn: () => mpApi.opsMap(),
    refetchInterval: 10_000,
  });

  const d = overview.data;

  return (
    <div>
      <PageHeader
        title="Live Operations"
        description="Real-time partner supply, booking queues and dispatch health. Refreshes every 10s."
      />

      {overview.isLoading || !d ? (
        <div className="py-16 text-center"><Spinner className="text-forest" /></div>
      ) : (
        <div className="mt-4 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Partners online" value={<span className="flex items-center gap-1.5"><Users size={18} />{d.partners.online}</span>} />
            <Stat label="Busy" value={d.partners.busy} />
            <Stat label="Dispatching" value={d.bookings.dispatching} tone={d.bookings.dispatching ? "text-[#7a5a00]" : undefined} />
            <Stat label="Active" value={d.bookings.active} />
            <Stat label="Unassigned" value={d.bookings.unassigned} tone={d.bookings.unassigned ? "text-tomato" : undefined} />
            <Stat label="Completed today" value={d.bookings.completed_today} />
          </div>

          {/* Alerts */}
          {d.alerts.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-tomato">
                <AlertTriangle size={13} /> Attention needed ({d.alerts.length})
              </h2>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {d.alerts.slice(0, 9).map((a) => <AlertRow key={`${a.id}-${a.kind}`} a={a} />)}
              </div>
            </section>
          )}

          {/* Map */}
          <section>
            <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <MapPin size={13} /> Live service map
            </h2>
            {map.isLoading || !map.data ? (
              <div className="py-10 text-center"><Spinner className="text-forest" /></div>
            ) : (
              <OpsMapView map={map.data} />
            )}
          </section>

          {/* Queues */}
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Active */}
            <section>
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                <Navigation size={13} /> Active ({d.active.length})
              </h2>
              {!d.active.length ? (
                <p className="py-4 text-sm text-muted">No active bookings.</p>
              ) : (
                <ul className="space-y-1.5">
                  {d.active.map((b) => (
                    <li key={b.id}>
                      <Link href={`/admin/marketplace/bookings/${b.id}`} className="block rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:bg-surface-2">
                        <p className="flex items-center justify-between">
                          <span className="font-medium text-ink">{b.code}</span>
                          <span className="text-xs capitalize text-muted">{b.status.replace(/_/g, " ")}</span>
                        </p>
                        <p className="text-xs text-muted">
                          {b.partner_name ?? "—"} → {b.customer_name ?? "customer"}
                          {b.eta_minutes !== null ? <span className="text-forest"> · ETA {b.eta_minutes}m</span> : <span> · no GPS</span>}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Dispatching */}
            <section>
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                <Clock size={13} /> Dispatching ({d.dispatching.length})
              </h2>
              {!d.dispatching.length ? (
                <p className="py-4 text-sm text-muted">Nothing searching for a partner.</p>
              ) : (
                <ul className="space-y-1.5">
                  {d.dispatching.map((b) => (
                    <li key={b.id}>
                      <Link href={`/admin/marketplace/bookings/${b.id}`} className="block rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:bg-surface-2">
                        <p className="flex items-center justify-between">
                          <span className="font-medium text-ink">{b.code}</span>
                          <span className="text-xs text-muted">waiting {mins(b.waiting_seconds)}</span>
                        </p>
                        <p className="text-xs text-muted">
                          {b.offers_count} live offer{b.offers_count === 1 ? "" : "s"}
                          {b.current_partner_name ? ` · ${b.current_partner_name}` : ""}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Unassigned */}
            <section>
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                <AlertTriangle size={13} /> Unassigned ({d.unassigned.length})
              </h2>
              {!d.unassigned.length ? (
                <p className="py-4 text-sm text-muted">No bookings waiting for manual assignment.</p>
              ) : (
                <ul className="space-y-1.5">
                  {d.unassigned.map((b) => (
                    <li key={b.id}>
                      <Link href={`/admin/marketplace/bookings/${b.id}`} className="block rounded-lg border border-tomato/30 bg-tomato/5 px-3 py-2 text-sm hover:bg-tomato/10">
                        <p className="flex items-center justify-between">
                          <span className="font-medium text-ink">{b.code}</span>
                          <span className="text-xs text-tomato">{mins(b.waiting_seconds)} ago</span>
                        </p>
                        <p className="text-xs text-muted">No partner found — reassign from booking detail.</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
