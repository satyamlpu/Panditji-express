"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Database, Server } from "lucide-react";
import { mpApi, type SystemHealth } from "@/features/marketplace/api";
import { ApiError } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState, PageHeader } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

function Counter({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3 shadow-soft">
      <p className={cn("text-2xl font-bold tabular-nums text-ink", tone)}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function ConfigRow({ label, value, ok }: { label: string; value: React.ReactNode; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className={cn("font-medium", ok === false ? "text-tomato" : "text-ink")}>{value}</span>
    </div>
  );
}

function Bool({ v }: { v: boolean }) {
  return <span className={v ? "text-forest" : "text-[#7a5a00]"}>{v ? "yes" : "no"}</span>;
}

export default function SystemHealthPage() {
  const health = useQuery({
    queryKey: ["mp", "system", "health"],
    queryFn: () => mpApi.systemHealth(),
    refetchInterval: 15_000,
  });

  if (health.isError) {
    const msg = health.error instanceof ApiError && health.error.status === 403
      ? "System health is restricted to super-admins."
      : "Could not load system health.";
    return (
      <div>
        <PageHeader title="System Health" description="Platform liveness and configuration posture." />
        <EmptyState icon="security" title="Access restricted" description={msg} />
      </div>
    );
  }

  const d: SystemHealth | undefined = health.data;

  return (
    <div>
      <PageHeader title="System Health" description="Platform liveness, live counters and configuration posture. Refreshes every 15s." />

      {!d ? (
        <div className="py-16 text-center"><Spinner className="text-forest" /></div>
      ) : (
        <div className="mt-4 space-y-6">
          {/* Status banner */}
          <div
            className={cn(
              "flex items-center gap-3 rounded-card border px-4 py-3",
              d.status === "ok"
                ? "border-forest/30 bg-forest/5"
                : "border-tomato/30 bg-tomato/5",
            )}
          >
            {d.status === "ok" ? (
              <CheckCircle2 className="text-forest" size={20} />
            ) : (
              <AlertTriangle className="text-tomato" size={20} />
            )}
            <div>
              <p className="font-semibold text-ink">
                {d.status === "ok" ? "All systems operational" : "Attention needed"}
              </p>
              <p className="text-xs text-muted">
                {d.config.environment} · updated {new Date(d.generated_at).toLocaleTimeString()}
              </p>
            </div>
          </div>

          {/* Warnings */}
          {d.warnings.length > 0 && (
            <ul className="space-y-1.5">
              {d.warnings.map((w, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg border border-tomato/30 bg-tomato/5 px-3 py-2 text-sm text-ink">
                  <AlertTriangle size={14} className="shrink-0 text-tomato" /> {w}
                </li>
              ))}
            </ul>
          )}

          {/* Infra cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-soft">
              <Database size={20} className={d.database.status === "connected" ? "text-forest" : "text-tomato"} />
              <div>
                <p className="font-medium text-ink">Database — {d.database.dialect}</p>
                <p className="text-xs text-muted capitalize">{d.database.status}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-soft">
              <Server size={20} className="text-forest" />
              <div>
                <p className="font-medium text-ink">Geo backend — {d.config.geo_backend}</p>
                <p className="text-xs text-muted">KYC: {d.config.storage_backend} · Media: {d.config.media_storage_backend}</p>
              </div>
            </div>
          </div>

          {/* Counters */}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Live counters</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Counter label="Customers" value={d.counters.customers} />
              <Counter label="Partners (approved)" value={d.counters.pandits_approved} />
              <Counter label="Partners online" value={d.counters.pandits_online} tone="text-forest" />
              <Counter label="Bookings (total)" value={d.counters.bookings_total} />
              <Counter label="Active bookings" value={d.counters.bookings_active} />
              <Counter label="Dispatching" value={d.counters.bookings_dispatching} tone={d.counters.bookings_dispatching ? "text-[#7a5a00]" : undefined} />
              <Counter label="No partner" value={d.counters.bookings_no_partner} tone={d.counters.bookings_no_partner ? "text-tomato" : undefined} />
              <Counter label="Open tickets" value={d.counters.open_tickets} tone={d.counters.open_tickets ? "text-[#7a5a00]" : undefined} />
            </div>
          </section>

          {/* Config posture */}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Configuration</h2>
            <div className="rounded-card border border-line bg-surface px-4 py-2 shadow-soft">
              <ConfigRow label="Environment" value={d.config.environment} ok={!d.config.is_production || d.database.dialect !== "sqlite"} />
              <ConfigRow label="API docs exposed" value={<Bool v={d.config.docs_enabled} />} />
              <ConfigRow label="Platform commission" value={`${d.config.commission_percent}%`} />
              <ConfigRow label="Gateway fee" value={`${d.config.gateway_fee_percent}%`} />
              <ConfigRow label="Allowed CORS origins" value={d.config.cors_origins} />
              <ConfigRow label="Supabase KYC storage" value={<Bool v={d.config.supabase_kyc_configured} />} />
              <ConfigRow label="Supabase media storage" value={<Bool v={d.config.supabase_media_configured} />} />
              <ConfigRow label="Public-site revalidation" value={<Bool v={d.config.revalidate_configured} />} ok={d.config.revalidate_configured} />
            </div>
            <p className="mt-1.5 text-[11px] text-muted">Configuration shows names and status only — no secret values are exposed.</p>
          </section>
        </div>
      )}
    </div>
  );
}
