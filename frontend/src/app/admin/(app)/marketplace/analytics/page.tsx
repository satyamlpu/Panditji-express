"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LoadingSkeleton,
  MetricCard,
  PageHeader,
} from "@/components/admin/kit";
import {
  BarDistribution,
  ChartCard,
  type BarItem,
} from "@/components/admin/charts";
import { mpApi, type MpAnalyticsDaily } from "@/features/marketplace/api";

const RANGES = [7, 30, 90] as const;

function pct(v: number): string {
  return `${Math.round(v * 1000) / 10}%`;
}

/** Dependency-free daily column chart: total bookings per day with the completed
 *  portion shaded. Scales to the busiest day; labels thin out for long ranges. */
function DailyTrend({ daily }: { daily: MpAnalyticsDaily[] }) {
  const max = Math.max(1, ...daily.map((d) => d.total));
  const W = 720;
  const H = 180;
  const pad = { top: 10, right: 8, bottom: 22, left: 8 };
  const n = daily.length;
  const bw = (W - pad.left - pad.right) / n;
  const chartH = H - pad.top - pad.bottom;
  const everyNth = n > 31 ? 7 : n > 10 ? 5 : 1;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[180px] w-full min-w-[520px]"
        role="img"
        aria-label="Daily bookings"
      >
        {daily.map((d, i) => {
          const x = pad.left + i * bw;
          const totalH = (d.total / max) * chartH;
          const compH = (d.completed / max) * chartH;
          const barW = Math.max(1, bw - 2);
          const label = d.date.slice(5); // MM-DD
          return (
            <g key={d.date}>
              <rect
                x={x + 1}
                y={pad.top + chartH - totalH}
                width={barW}
                height={totalH}
                rx={1.5}
                fill="var(--line)"
              />
              <rect
                x={x + 1}
                y={pad.top + chartH - compH}
                width={barW}
                height={compH}
                rx={1.5}
                fill="var(--forest)"
              />
              {i % everyNth === 0 && (
                <text
                  x={x + bw / 2}
                  y={H - 6}
                  textAnchor="middle"
                  className="fill-muted"
                  style={{ fontSize: 9 }}
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex items-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-forest" /> Completed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: "var(--line)" }}
          />{" "}
          All bookings
        </span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading } = useQuery({
    queryKey: ["mp", "analytics", days],
    queryFn: () => mpApi.analytics(days),
  });

  const topItems: BarItem[] =
    data?.top_services.map((s) => ({ label: s.title, value: s.bookings })) ?? [];

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Booking trends over time, computed from real operations data. Indicative figures for monitoring — not a financial report."
        actions={
          <div className="inline-flex overflow-hidden rounded-pill border border-line">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDays(r)}
                aria-pressed={days === r}
                className={
                  "px-3 py-1.5 text-sm font-medium transition-colors " +
                  (days === r
                    ? "bg-brand text-white"
                    : "bg-surface text-muted hover:bg-surface-2")
                }
              >
                {r}d
              </button>
            ))}
          </div>
        }
      />

      {isLoading || !data ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label={`Bookings (${days}d)`}
              value={data.totals.bookings.toLocaleString()}
              icon="bookings"
            />
            <MetricCard
              label="Completion rate"
              value={pct(data.totals.completion_rate)}
              icon="operations"
              sub={`${data.totals.completed} completed`}
            />
            <MetricCard
              label="No-match rate"
              value={pct(data.totals.no_match_rate)}
              icon="partners"
              sub={`${data.totals.no_partner} unmatched`}
            />
            <MetricCard
              label={`GMV (${days}d)`}
              value={data.totals.gmv_display}
              icon="finance"
              hint="Sum of completed-booking prices"
            />
          </div>

          <ChartCard title="Daily bookings">
            {data.daily.every((d) => d.total === 0) ? (
              <p className="py-8 text-center text-sm text-muted">
                No bookings in this window yet.
              </p>
            ) : (
              <DailyTrend daily={data.daily} />
            )}
          </ChartCard>

          <ChartCard title="Top services">
            {topItems.length ? (
              <BarDistribution items={topItems} />
            ) : (
              <p className="py-6 text-center text-sm text-muted">No bookings yet.</p>
            )}
          </ChartCard>
        </div>
      )}
    </div>
  );
}
