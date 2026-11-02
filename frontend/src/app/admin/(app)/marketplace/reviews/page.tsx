"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Star } from "lucide-react";
import { mpApi } from "@/features/marketplace/api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export default function ReviewsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["mp", "reviews"],
    queryFn: () => mpApi.reviews(),
  });

  const moderate = useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) =>
      mpApi.moderateReview(id, hidden),
    onSuccess: () => {
      toast.success("Review updated");
      qc.invalidateQueries({ queryKey: ["mp", "reviews"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed"),
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Reviews</h1>
      <p className="mt-1 text-sm text-muted">
        Customer reviews of completed bookings. Hide any that breach the policy.
      </p>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <div className="py-16 text-center"><Spinner className="text-forest" /></div>
        ) : !data?.length ? (
          <p className="rounded-card border border-line bg-surface py-16 text-center text-sm text-muted">
            No reviews yet.
          </p>
        ) : (
          data.map((r) => (
            <div
              key={r.id}
              className={cn(
                "rounded-card border bg-surface p-5 shadow-soft",
                r.hidden ? "border-tomato/30 opacity-70" : "border-line",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5" aria-label={`${r.rating} of 5`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={15}
                          className={i < r.rating ? "fill-sunshine text-sunshine" : "text-line"}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-ink">
                      {r.pandit_name ?? "—"}
                    </span>
                    <span className="text-xs text-muted">· {r.booking_code}</span>
                    {r.hidden && (
                      <span className="rounded-pill bg-tomato/10 px-2 py-0.5 text-xs font-medium text-tomato">
                        Hidden
                      </span>
                    )}
                  </div>
                  {r.comment && <p className="mt-2 text-sm text-ink">“{r.comment}”</p>}
                  <p className="mt-1 text-xs text-muted">
                    by {r.customer_name ?? "customer"} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => moderate.mutate({ id: r.id, hidden: !r.hidden })}
                  disabled={moderate.isPending}
                >
                  {r.hidden ? (
                    <><Eye size={15} /> Unhide</>
                  ) : (
                    <><EyeOff size={15} /> Hide</>
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
