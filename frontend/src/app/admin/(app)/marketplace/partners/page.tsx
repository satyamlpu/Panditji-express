"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, MapPin, Phone } from "lucide-react";
import { mpApi, type PanditAdmin } from "@/features/marketplace/api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { AField, AdminModal, StatusDot } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

const STATUSES = [
  "all", "submitted", "under_review", "action_required", "approved", "rejected", "suspended",
];

function PartnersInner() {
  const qc = useQueryClient();
  const initial = useSearchParams().get("status") ?? "all";
  const [status, setStatus] = useState(initial);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["mp", "pandits", status],
    queryFn: () => mpApi.pandits(status === "all" ? undefined : status),
  });
  const detail = useQuery({
    queryKey: ["mp", "pandit", reviewId],
    queryFn: () => mpApi.pandit(reviewId as string),
    enabled: !!reviewId,
  });

  const decide = useMutation({
    mutationFn: ({
      id, decision,
    }: {
      id: string;
      decision: "approve" | "reject" | "request_changes" | "suspend";
    }) => mpApi.decide(id, decision, reason),
    onSuccess: () => {
      toast.success("Decision recorded");
      setReviewId(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["mp", "pandits"] });
      qc.invalidateQueries({ queryKey: ["mp", "dashboard"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed"),
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Partners</h1>
      <p className="mt-1 text-sm text-muted">
        Review pandit applications and manage verification.
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
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-card border border-line bg-surface">
        {isLoading ? (
          <div className="py-16 text-center">
            <Spinner className="text-forest" />
          </div>
        ) : !data?.length ? (
          <p className="py-16 text-center text-sm text-muted">No partners in this view.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.map((p: PanditAdmin) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-ink">
                    {p.name ?? "(unnamed)"}{" "}
                    <span className="text-xs text-muted">· {p.phone}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {p.city ?? "—"} · {p.capability_count} services · {p.availability}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusDot status={p.status} />
                  <Button variant="outline" size="sm" onClick={() => setReviewId(p.id)}>
                    Review
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AdminModal
        title="Review partner"
        open={reviewId !== null}
        onClose={() => {
          setReviewId(null);
          setReason("");
        }}
      >
        {detail.isLoading || !detail.data ? (
          <div className="py-10 text-center">
            <Spinner className="text-forest" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="font-display text-lg font-semibold text-ink">
                {detail.data.name ?? "(unnamed)"}
              </p>
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <Phone size={14} /> {detail.data.phone}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                <MapPin size={14} /> {detail.data.city ?? "—"} · radius{" "}
                {detail.data.service_radius_km} km
              </p>
              {detail.data.languages?.length ? (
                <p className="mt-1 text-sm text-muted">
                  Languages: {detail.data.languages.join(", ")}
                </p>
              ) : null}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                Declared services
              </p>
              <div className="flex flex-wrap gap-1.5">
                {detail.data.capabilities.length ? (
                  detail.data.capabilities.map((c) => (
                    <span
                      key={c.service_id}
                      className="rounded-pill border border-line bg-surface-2 px-2.5 py-0.5 text-xs text-ink"
                    >
                      {c.title}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted">None declared</span>
                )}
              </div>
            </div>

            <AField label="Reason / note (recorded with the decision)">
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. ID verified / needs clearer address proof"
              />
            </AField>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => decide.mutate({ id: detail.data!.id, decision: "approve" })}
                disabled={decide.isPending}
              >
                <CheckCircle2 size={15} /> Approve
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  decide.mutate({ id: detail.data!.id, decision: "request_changes" })
                }
                disabled={decide.isPending}
              >
                Request changes
              </Button>
              <Button
                variant="outline"
                onClick={() => decide.mutate({ id: detail.data!.id, decision: "reject" })}
                disabled={decide.isPending}
                className="border-tomato/40 text-tomato"
              >
                Reject
              </Button>
              {detail.data.status === "approved" && (
                <Button
                  variant="outline"
                  onClick={() => decide.mutate({ id: detail.data!.id, decision: "suspend" })}
                  disabled={decide.isPending}
                  className="border-tomato/40 text-tomato"
                >
                  Suspend
                </Button>
              )}
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}

export default function PartnersPage() {
  return (
    <Suspense fallback={<Spinner className="text-forest" />}>
      <PartnersInner />
    </Suspense>
  );
}
