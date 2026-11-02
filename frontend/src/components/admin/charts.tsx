"use client";

/**
 * Lightweight, dependency-free admin charts (CSS bars + inline SVG donut).
 * Fed only by real backend data — never fabricated series.
 */

export interface BarItem {
  label: string;
  value: number;
  color?: string; // CSS color; defaults to brand forest
}

export function BarDistribution({ items }: { items: BarItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">No data yet.</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-xs text-muted" title={i.label}>
            {i.label}
          </span>
          <div className="relative h-2.5 flex-1 overflow-hidden rounded-pill bg-surface-2">
            <div
              className="absolute inset-y-0 left-0 rounded-pill transition-[width] duration-500"
              style={{
                width: `${(i.value / max) * 100}%`,
                backgroundColor: i.color ?? "var(--forest)",
              }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-ink">
            {i.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Donut({
  value,
  total,
  color = "var(--forest)",
  size = 96,
  centerTop,
  centerBottom,
}: {
  value: number;
  total: number;
  color?: string;
  size?: number;
  centerTop?: string;
  centerBottom?: string;
}) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      role="img"
      aria-label={`${value} of ${total}`}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {centerTop && (
        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fill: "var(--ink)", fontSize: 22, fontWeight: 600 }}
        >
          {centerTop}
        </text>
      )}
      {centerBottom && (
        <text
          x="50%"
          y="64%"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fill: "var(--muted)", fontSize: 9.5 }}
        >
          {centerBottom}
        </text>
      )}
    </svg>
  );
}

/** Chart card wrapper for consistent framing. */
export function ChartCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}
