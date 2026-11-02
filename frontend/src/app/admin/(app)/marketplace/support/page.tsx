"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { mpApi } from "@/features/marketplace/api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { AField, AdminModal, StatusDot } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

const STATUSES = ["all", "open", "assigned", "escalated", "resolved", "closed"];

function SupportInner() {
  const qc = useQueryClient();
  const [status, setStatus] = useState(useSearchParams().get("status") ?? "all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [resolution, setResolution] = useState("");

  const list = useQuery({
    queryKey: ["mp", "tickets", status],
    queryFn: () => mpApi.tickets(status === "all" ? undefined : status),
    refetchInterval: 20000,
  });
  const detail = useQuery({
    queryKey: ["mp", "ticket", openId],
    queryFn: () => mpApi.ticket(openId as string),
    enabled: !!openId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["mp", "tickets"] });
    if (openId) qc.invalidateQueries({ queryKey: ["mp", "ticket", openId] });
  };
  const onErr = (e: unknown) =>
    toast.error(e instanceof ApiError ? e.message : "Action failed");

  const assign = useMutation({
    mutationFn: () => mpApi.assignTicket(openId as string),
    onSuccess: () => { toast.success("Assigned to you"); invalidate(); },
    onError: onErr,
  });
  const sendReply = useMutation({
    mutationFn: () => mpApi.replyTicket(openId as string, reply),
    onSuccess: () => { toast.success("Reply sent"); setReply(""); invalidate(); },
    onError: onErr,
  });
  const resolve = useMutation({
    mutationFn: () => mpApi.ticketStatus(openId as string, "resolved", resolution),
    onSuccess: () => { toast.success("Resolved"); setResolution(""); invalidate(); },
    onError: onErr,
  });

  const d = detail.data;
  const closed = d && (d.status === "resolved" || d.status === "closed");

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Support</h1>
      <p className="mt-1 text-sm text-muted">
        Customer and partner tickets — assign, reply and resolve.
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

      <div className="mt-5 overflow-hidden rounded-card border border-line bg-surface">
        {list.isLoading ? (
          <div className="py-16 text-center"><Spinner className="text-forest" /></div>
        ) : !list.data?.length ? (
          <p className="py-16 text-center text-sm text-muted">No tickets in this view.</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.data.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-4">
                <button className="min-w-0 text-left" onClick={() => setOpenId(t.id)}>
                  <p className="font-medium text-forest hover:underline">
                    {t.ref} · {t.subject}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {t.opener_kind} · {t.opener_label ?? "—"}
                    {t.booking_code ? ` · ${t.booking_code}` : ""}
                    {t.assignee_email ? ` · @${t.assignee_email}` : ""}
                  </p>
                </button>
                <StatusDot status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <AdminModal
        title={d ? `${d.ref} · ${d.subject}` : "Ticket"}
        open={openId !== null}
        onClose={() => { setOpenId(null); setReply(""); setResolution(""); }}
      >
        {!d ? (
          <div className="py-10 text-center"><Spinner className="text-forest" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusDot status={d.status} />
              <span className="text-muted">{d.opener_kind} · {d.opener_label}</span>
              {d.assignee_email && (
                <span className="text-muted">· assigned @{d.assignee_email}</span>
              )}
            </div>

            {/* Thread */}
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-line bg-surface-2 p-3">
              {d.messages.map((m, i) => {
                const staff = m.author.startsWith("admin:");
                return (
                  <div key={i} className={cn("flex", staff ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-xl px-3 py-2 text-sm",
                        staff ? "bg-forest text-white" : "bg-surface text-ink border border-line",
                      )}
                    >
                      <p>{m.body}</p>
                      <p className={cn("mt-1 text-[10px]", staff ? "text-white/70" : "text-muted")}>
                        {staff ? m.author.replace("admin:", "") : m.author} ·{" "}
                        {new Date(m.at).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {d.resolution && (
              <p className="rounded-lg bg-forest/5 px-3 py-2 text-sm text-ink">
                <strong>Resolution:</strong> {d.resolution}
              </p>
            )}

            {!closed ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {!d.assignee_email && (
                    <Button variant="outline" size="sm" onClick={() => assign.mutate()} disabled={assign.isPending}>
                      Assign to me
                    </Button>
                  )}
                </div>
                <AField label="Reply">
                  <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type a reply to the customer/partner…" />
                </AField>
                <div className="flex justify-between gap-2">
                  <Button size="sm" onClick={() => sendReply.mutate()} disabled={reply.trim().length < 1 || sendReply.isPending}>
                    Send reply
                  </Button>
                  <div className="flex items-end gap-2">
                    <Input
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      placeholder="Resolution note"
                      className="w-56"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolve.mutate()}
                      disabled={resolution.trim().length < 2 || resolve.isPending}
                    >
                      Resolve
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-center text-sm text-muted">This ticket is {d.status}.</p>
            )}
          </div>
        )}
      </AdminModal>
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<Spinner className="text-forest" />}>
      <SupportInner />
    </Suspense>
  );
}
