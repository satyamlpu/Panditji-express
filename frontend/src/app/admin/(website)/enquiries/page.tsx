"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { enquiriesApi, type Enquiry } from "@/features/enquiries/api";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const STATUSES = ["all", "new", "contacted", "confirmed", "cancelled"] as const;
const NEXT: Record<string, string[]> = {
  new: ["contacted", "cancelled"],
  contacted: ["confirmed", "cancelled"],
  confirmed: ["cancelled"],
  cancelled: ["new"],
};

export default function AdminEnquiriesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "enquiries", status],
    queryFn: () =>
      enquiriesApi.list({ status: status === "all" ? undefined : status }),
  });

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      enquiriesApi.update(id, { status }),
    onSuccess: () => {
      toast.success("Enquiry updated");
      qc.invalidateQueries({ queryKey: ["admin", "enquiries"] });
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Update failed"),
  });

  const items = data?.items ?? [];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Booking enquiries</h1>
      <p className="mt-1 text-sm text-muted">
        Customer requests submitted from booking and contact forms.
      </p>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={cn(
              "rounded-pill border px-3 py-1.5 text-sm font-medium capitalize",
              status === s
                ? "border-forest bg-forest text-white"
                : "border-line bg-surface text-ink hover:bg-surface-2",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {isLoading ? (
          <div className="py-16 text-center">
            <Spinner className="text-forest" />
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-card border border-line bg-surface py-16 text-center text-sm text-muted">
            No enquiries in this view.
          </p>
        ) : (
          items.map((e) => <EnquiryCard key={e.id} e={e} onSet={update.mutate} />)
        )}
      </div>
    </div>
  );
}

function EnquiryCard({
  e,
  onSet,
}: {
  e: Enquiry;
  onSet: (v: { id: string; status: string }) => void;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display font-semibold text-ink">{e.name}</p>
          <p className="text-sm text-muted">
            {e.phone}
            {e.email ? ` · ${e.email}` : ""}
            {e.city ? ` · ${e.city}` : ""}
          </p>
        </div>
        <Badge tone={e.status === "new" ? "sun" : "neutral"}>{e.status}</Badge>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-muted">Service:</dt>
          <dd className="text-ink">{e.service_title_snapshot ?? "General enquiry"}</dd>
        </div>
        {e.preferred_date && (
          <div className="flex gap-2">
            <dt className="text-muted">Preferred:</dt>
            <dd className="text-ink">{e.preferred_date}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="text-muted">Received:</dt>
          <dd className="text-ink">
            {new Date(e.created_at).toLocaleString("en-IN")}
          </dd>
        </div>
      </dl>

      {e.message && (
        <p className="mt-3 rounded-lg bg-surface-2 p-3 text-sm text-ink">{e.message}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Mark as:</span>
        {(NEXT[e.status] ?? []).map((next) => (
          <button
            key={next}
            onClick={() => onSet({ id: e.id, status: next })}
            className="rounded-pill border border-line bg-surface px-3 py-1 text-xs font-medium capitalize text-ink hover:bg-surface-2"
          >
            {next}
          </button>
        ))}
      </div>
    </div>
  );
}
