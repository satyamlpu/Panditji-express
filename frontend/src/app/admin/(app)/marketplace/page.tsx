"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { mpApi } from "@/features/marketplace/api";
import { Icon } from "@/components/admin/icons";
import { MetricCard, PageHeader, LoadingSkeleton } from "@/components/admin/kit";
import { BarDistribution, ChartCard, Donut, type BarItem } from "@/components/admin/charts";

const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  searching: "Searching",
  awaiting_acceptance: "Awaiting partner",
  confirmed: "Confirmed",
  en_route: "En route",
  arrived: "Arrived",
  in_progress: "In progress",
  completed: "Completed",
  no_partner_available: "No partner",
  expired: "Expired",
  cancelled_customer: "Cancelled (customer)",
  cancelled_partner: "Cancelled (partner)",
  cancelled_platform: "Cancelled (platform)",
};

function statusColor(status: string): string {
  if (status === "completed") return "var(--forest)";
  if (status === "confirmed") return "var(--burgundy)";
  if (["searching", "awaiting_acceptance", "en_route", "arrived", "in_progress"].includes(status))
    return "var(--sunshine)";
  if (status.startsWith("cancelled") || ["no_partner_available", "expired", "rejected"].includes(status))
    return "var(--tomato)";
  return "var(--muted)";
}

export default function MarketplaceDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["mp", "dashboard"],
    queryFn: () => mpApi.dashboard(),
    refetchInterval: 15000,
  });

  const bars: BarItem[] = data
    ? Object.entries(data.bookings_by_status)
        .map(([status, count]) => ({
          label: STATUS_LABEL[status] ?? status,
          value: count,
          color: statusColor(status),
        }))
        .sort((a, b) => b.value - a.value)
    : [];

  return (
    <div>
      <PageHeader
        title="Operations"
        description="Live marketplace health — bookings, partner supply and confirmation."
      />

      {isLoading || !data ? (
        <LoadingSkeleton rows={3} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Bookings today" value={data.bookings_today} icon="bookings" />
            <MetricCard
              label="Partners online"
              value={data.partners_online}
              tone="forest"
              icon="partners"
              sub={`${data.partners_approved} approved`}
            />
            <MetricCard label="Partners busy" value={data.partners_busy} icon="operations" />
            <MetricCard
              label="No-match rate"
              value={`${Math.round(data.no_match_rate * 100)}%`}
              tone={data.no_match_rate > 0.2 ? "tomato" : "ink"}
              icon="analytics"
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Link
              href="/admin/marketplace/partners?status=submitted"
              className="group flex items-center justify-between rounded-card border border-line bg-surface p-5 shadow-soft hover:shadow-soft-lg"
            >
              <span className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-sunshine/20 text-[#7a5a00]">
                  <Icon name="partners" size={20} />
                </span>
                <span>
                  <span className="block font-semibold text-ink">
                    {data.pending_verifications} pending verification
                    {data.pending_verifications === 1 ? "" : "s"}
                  </span>
                  <span className="text-sm text-muted">{data.partners_approved} approved partners</span>
                </span>
              </span>
              <Icon name="arrowRight" size={18} className="text-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/admin/marketplace/bookings"
              className="group flex items-center justify-between rounded-card border border-line bg-surface p-5 shadow-soft hover:shadow-soft-lg"
            >
              <span className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-forest/10 text-forest">
                  <Icon name="bookings" size={20} />
                </span>
                <span>
                  <span className="block font-semibold text-ink">Booking operations</span>
                  <span className="text-sm text-muted">Dispatch, events and manual reassignment</span>
                </span>
              </span>
              <Icon name="arrowRight" size={18} className="text-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <ChartCard title="Bookings by status">
              <BarDistribution items={bars} />
            </ChartCard>
            <ChartCard title="Partner supply">
              <div className="flex items-center gap-5">
                <Donut
                  value={data.partners_online}
                  total={Math.max(data.partners_approved, data.partners_online)}
                  centerTop={String(data.partners_online)}
                  centerBottom="online"
                />
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-forest" />
                    <span className="text-muted">Online</span>
                    <span className="ml-auto font-semibold tabular-nums text-ink">{data.partners_online}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-sunshine" />
                    <span className="text-muted">Busy</span>
                    <span className="ml-auto font-semibold tabular-nums text-ink">{data.partners_busy}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-surface-2 ring-1 ring-line" />
                    <span className="text-muted">Approved</span>
                    <span className="ml-auto font-semibold tabular-nums text-ink">{data.partners_approved}</span>
                  </li>
                </ul>
              </div>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
