"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Phone, MapPin, Star } from "lucide-react";
import { mpApi } from "@/features/marketplace/api";
import { Spinner } from "@/components/ui/spinner";
import { StatusDot } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

const TABS = ["bookings", "reviews", "earnings"] as const;
type Tab = (typeof TABS)[number];

function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—";
}
function pct(v: number | null) {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

function Tile({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5 text-center">
      <p className={cn("text-base font-semibold tabular-nums text-ink", tone)}>{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

export default function PartnerDetailPage() {
  const id = useParams().id as string;
  const [tab, setTab] = useState<Tab>("bookings");

  const overview = useQuery({
    queryKey: ["mp", "partner-overview", id],
    queryFn: () => mpApi.partnerOverview(id),
  });

  const p = overview.data;

  return (
    <div>
      <Link
        href="/admin/marketplace/partners"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft size={15} /> Back to partners
      </Link>

      {overview.isLoading || !p ? (
        <div className="py-16 text-center"><Spinner className="text-forest" /></div>
      ) : (
        <div className="mt-4 space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold text-ink">{p.name ?? "(unnamed)"}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><Phone size={14} /> {p.phone}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                <MapPin size={14} /> {p.city ?? "—"} · {p.service_radius_km} km radius · joined {fmtDate(p.created_at)}
              </p>
              {p.languages?.length ? (
                <p className="mt-0.5 text-sm text-muted">Languages: {p.languages.join(", ")}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <StatusDot status={p.status} />
              <span className="rounded-pill border border-line bg-surface-2 px-2.5 py-0.5 text-xs capitalize text-muted">
                {p.availability}
              </span>
            </div>
          </div>

          {p.verification_reason ? (
            <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-muted">
              Last verification note: {p.verification_reason}
              {p.reviewed_by ? <span className="text-xs"> · by {p.reviewed_by}</span> : null}
            </p>
          ) : null}

          {/* Performance */}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Performance</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Tile label="Completed" value={p.performance.completed_count} />
              <Tile label="Active now" value={p.performance.active_count} />
              <Tile label="Cancelled" value={p.performance.cancelled_count} />
              <Tile label="Acceptance" value={pct(p.performance.acceptance_rate)} />
              <Tile
                label={`Rating (${p.performance.rating_count})`}
                value={
                  <span className="inline-flex items-center gap-1">
                    {p.performance.rating_avg ?? "—"}
                    {p.performance.rating_avg !== null ? <Star size={13} className="fill-sunshine text-sunshine" /> : null}
                  </span>
                }
              />
              <Tile label="Offers" value={`${p.performance.offers_accepted}/${p.performance.offers_received}`} />
            </div>
          </section>

          {/* Earnings */}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Earnings</h2>
            <div className="grid grid-cols-3 gap-2">
              <Tile label="Lifetime earned" value={p.earnings.lifetime_earned_display} />
              <Tile label="Paid out" value={p.earnings.paid_out_display} />
              <Tile label="Outstanding" value={p.earnings.outstanding_display} tone={p.earnings.outstanding_paise > 0 ? "text-tomato" : undefined} />
            </div>
          </section>

          {/* Services */}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Declared services</h2>
            <div className="flex flex-wrap gap-1.5">
              {p.capabilities.length ? (
                p.capabilities.map((c) => (
                  <span key={c.service_id} className="rounded-pill border border-line bg-surface-2 px-2.5 py-0.5 text-xs text-ink">
                    {c.title}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted">None declared</span>
              )}
            </div>
          </section>

          {/* Tabs */}
          <section>
            <div className="flex gap-1 border-b border-line">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  className={cn(
                    "-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize",
                    tab === t ? "border-forest text-forest" : "border-transparent text-muted hover:text-ink",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="pt-3">
              <PartnerTab id={id} tab={tab} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function PartnerTab({ id, tab }: { id: string; tab: Tab }) {
  const bookings = useQuery({ queryKey: ["mp", "partner", id, "bookings"], queryFn: () => mpApi.partnerBookings(id), enabled: tab === "bookings" });
  const reviews = useQuery({ queryKey: ["mp", "partner", id, "reviews"], queryFn: () => mpApi.partnerReviews(id), enabled: tab === "reviews" });
  const earnings = useQuery({ queryKey: ["mp", "partner", id, "earnings"], queryFn: () => mpApi.partnerEarnings(id), enabled: tab === "earnings" });

  const Loading = () => <div className="py-6 text-center"><Spinner className="text-forest" /></div>;
  const Empty = ({ label }: { label: string }) => <p className="py-6 text-center text-sm text-muted">No {label} yet.</p>;

  if (tab === "bookings")
    return bookings.isLoading ? <Loading /> : !bookings.data?.length ? <Empty label="bookings" /> : (
      <ul className="space-y-1.5">
        {bookings.data.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
            <span className="min-w-0"><span className="font-medium text-ink">{b.code}</span><span className="text-muted"> · {b.service_title}</span></span>
            <span className="shrink-0 text-xs text-muted">{b.price_display} · <span className="capitalize">{b.status.replace(/_/g, " ")}</span></span>
          </li>
        ))}
      </ul>
    );

  if (tab === "reviews")
    return reviews.isLoading ? <Loading /> : !reviews.data?.length ? <Empty label="reviews" /> : (
      <ul className="space-y-1.5">
        {reviews.data.map((r) => (
          <li key={r.id} className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
            <p className="font-medium text-ink">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} <span className="text-xs text-muted">· {r.booking_code}{r.hidden ? " · hidden" : ""}</span></p>
            {r.comment ? <p className="text-muted">{r.comment}</p> : null}
          </li>
        ))}
      </ul>
    );

  // earnings
  return earnings.isLoading ? <Loading /> : !earnings.data ? <Empty label="earnings" /> : (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Payouts</p>
        {earnings.data.payouts.length ? (
          <ul className="space-y-1.5">
            {earnings.data.payouts.map((po, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
                <span className="font-medium text-ink">{po.amount_display}</span>
                <span className="shrink-0 text-xs text-muted">{po.bookings_count} booking{po.bookings_count === 1 ? "" : "s"} · {po.status} · {fmtDate(po.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : <Empty label="payouts" />}
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Ledger</p>
        {earnings.data.entries.length ? (
          <ul className="space-y-1.5">
            {earnings.data.entries.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium capitalize text-ink">{e.entry_type.replace(/_/g, " ")}</span>
                  {e.booking_code ? <span className="text-muted"> · {e.booking_code}</span> : null}
                  {e.entry_type === "partner_payable" ? (
                    <span className={cn("ml-1 text-xs", e.settled ? "text-muted" : "text-tomato")}>({e.settled ? "settled" : "outstanding"})</span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums text-ink">{e.amount_display}</span>
              </li>
            ))}
          </ul>
        ) : <Empty label="ledger entries" />}
      </div>
    </div>
  );
}
