"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { mpApi } from "@/features/marketplace/api";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const STATUSES = [
  "all", "searching", "awaiting_acceptance", "confirmed", "en_route",
  "in_progress", "completed", "no_partner_available", "cancelled_customer",
];

function BookingsInner() {
  const initial = useSearchParams().get("status") ?? "all";
  const [status, setStatus] = useState(initial);

  const { data, isLoading } = useQuery({
    queryKey: ["mp", "bookings", status],
    queryFn: () => mpApi.bookings(status === "all" ? undefined : status),
    refetchInterval: 15000,
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Bookings</h1>
      <p className="mt-1 text-sm text-muted">
        All bookings with live dispatch status; open one to see attempts and reassign.
      </p>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={cn(
              "rounded-pill border px-3 py-1.5 text-sm font-medium",
              status === s
                ? "border-forest bg-forest text-white"
                : "border-line bg-surface text-ink hover:bg-surface-2",
            )}
          >
            {s === "all" ? "All" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-card border border-line bg-surface">
        {isLoading ? (
          <div className="py-16 text-center">
            <Spinner className="text-forest" />
          </div>
        ) : !data?.length ? (
          <p className="py-16 text-center text-sm text-muted">No bookings in this view.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Booking</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Partner</th>
                <th className="px-4 py-3 font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {data.map((b) => (
                <tr key={b.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/marketplace/bookings/${b.id}`}
                      className="font-medium text-forest hover:underline"
                    >
                      {b.code}
                    </Link>
                    <div className="text-xs text-muted">
                      {b.customer_name ?? b.customer_phone}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink">{b.service_title}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-pill bg-surface-2 px-2.5 py-0.5 text-xs font-medium capitalize text-ink">
                      {b.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {b.assigned_pandit?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-forest">{b.price_display}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<Spinner className="text-forest" />}>
      <BookingsInner />
    </Suspense>
  );
}
