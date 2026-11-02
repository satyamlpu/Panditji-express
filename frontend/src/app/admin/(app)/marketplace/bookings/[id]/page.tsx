"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Navigation } from "lucide-react";
import { mpApi } from "@/features/marketplace/api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { selectClass } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

const TERMINAL = new Set([
  "completed", "expired", "no_partner_available", "rejected",
  "cancelled_customer", "cancelled_partner", "cancelled_platform",
]);

export default function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [pid, setPid] = useState("");
  const [reason, setReason] = useState("");

  const { data: b, isLoading } = useQuery({
    queryKey: ["mp", "booking", id],
    queryFn: () => mpApi.booking(id),
    refetchInterval: 10000,
  });
  const approved = useQuery({
    queryKey: ["mp", "pandits", "approved"],
    queryFn: () => mpApi.pandits("approved"),
  });

  const reassign = useMutation({
    mutationFn: () => mpApi.reassign(id, pid, reason),
    onSuccess: () => {
      toast.success("Booking reassigned");
      setReason("");
      setPid("");
      qc.invalidateQueries({ queryKey: ["mp", "booking", id] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Reassign failed"),
  });

  return (
    <div>
      <Link
        href="/admin/marketplace/bookings"
        className="inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline"
      >
        <ArrowLeft size={15} /> Bookings
      </Link>

      {isLoading || !b ? (
        <div className="py-16 text-center">
          <Spinner className="text-forest" />
        </div>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold text-ink">{b.code}</h1>
              <p className="text-sm text-muted">
                {b.service_title} · {b.price_display} · {b.mode}
              </p>
            </div>
            <span className="rounded-pill bg-forest/10 px-3 py-1 text-sm font-semibold capitalize text-forest">
              {b.status.replace(/_/g, " ")}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-card border border-line bg-surface p-5 shadow-soft">
              <h2 className="font-display font-semibold text-ink">Customer & location</h2>
              <p className="mt-2 text-sm text-ink">
                {b.customer_name ?? "—"} · {b.customer_phone}
              </p>
              <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
                <MapPin size={15} className="mt-0.5 shrink-0" />
                {b.address_line}
                {b.landmark ? ` (${b.landmark})` : ""}
              </p>
              <p className="mt-2 text-sm text-ink">
                Partner: <strong>{b.assigned_pandit?.name ?? "—"}</strong>
              </p>
            </div>

            {!TERMINAL.has(b.status) && (
              <div className="rounded-card border border-line bg-surface p-5 shadow-soft">
                <h2 className="font-display font-semibold text-ink">Manual reassign</h2>
                <p className="mt-1 text-xs text-muted">
                  Validated, audited. The current partner is freed.
                </p>
                <div className="mt-3 space-y-2">
                  <select
                    className={selectClass}
                    value={pid}
                    onChange={(e) => setPid(e.target.value)}
                  >
                    <option value="">Select an approved partner…</option>
                    {approved.data?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.city ?? "—"} · {p.availability}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (required)"
                  />
                  <Button
                    onClick={() => reassign.mutate()}
                    disabled={!pid || reason.length < 2 || reassign.isPending}
                  >
                    {reassign.isPending ? <Spinner /> : "Reassign"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {b.live_eta_minutes != null && (
            <div className="mt-4 rounded-card border border-forest/30 bg-forest/5 p-5">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                <div className="flex items-center gap-2">
                  <Navigation size={18} className="text-forest" />
                  <span className="font-display font-semibold text-ink">
                    Live tracking
                  </span>
                </div>
                <div>
                  <span className="font-display text-2xl font-bold text-forest">
                    ~{b.live_eta_minutes} min
                  </span>
                  <span className="ml-1 text-sm text-muted">ETA</span>
                </div>
                <div className="text-sm text-muted">
                  Partner at {b.live_lat?.toFixed(4)}, {b.live_lng?.toFixed(4)}
                </div>
                <div
                  className={cn(
                    "text-sm",
                    (b.live_freshness_seconds ?? 0) > 45
                      ? "text-tomato"
                      : "text-forest",
                  )}
                >
                  {(b.live_freshness_seconds ?? 0) > 45 ? "Stale" : "Fresh"} ·{" "}
                  {b.live_freshness_seconds}s ago
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 rounded-card border border-line bg-surface p-5 shadow-soft">
            <h2 className="font-display font-semibold text-ink">Dispatch attempts</h2>
            {b.attempts.length === 0 ? (
              <p className="py-4 text-sm text-muted">No dispatch attempts.</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase text-muted">
                    <th className="py-2 font-medium">#</th>
                    <th className="py-2 font-medium">Partner</th>
                    <th className="py-2 font-medium">Distance</th>
                    <th className="py-2 font-medium">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {b.attempts.map((a, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="py-2 text-muted">{a.rank}</td>
                      <td className="py-2 text-ink">{a.pandit_name ?? a.pandit_id.slice(0, 8)}</td>
                      <td className="py-2 text-muted">
                        {a.distance_km != null ? `${a.distance_km} km` : "—"}
                      </td>
                      <td className="py-2">
                        <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-xs capitalize text-ink">
                          {a.outcome}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 rounded-card border border-line bg-surface p-5 shadow-soft">
            <h2 className="font-display font-semibold text-ink">Event history</h2>
            <ol className="mt-3 space-y-3">
              {b.events.map((e, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-forest" />
                  <div>
                    <p className="text-ink">
                      <span className="capitalize">{e.to_status.replace(/_/g, " ")}</span>
                      <span className="text-muted"> · by {e.actor}</span>
                    </p>
                    {e.reason && <p className="text-xs text-muted">{e.reason}</p>}
                    <p className="text-xs text-muted">
                      {new Date(e.at).toLocaleString("en-IN")}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
