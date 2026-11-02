"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { mpApi, type Payment } from "@/features/marketplace/api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { AField, AdminModal } from "@/components/admin/kit";

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export default function FinancePage() {
  const qc = useQueryClient();
  const summary = useQuery({ queryKey: ["mp", "finance", "summary"], queryFn: () => mpApi.financeSummary() });
  const payments = useQuery({ queryKey: ["mp", "finance", "payments"], queryFn: () => mpApi.payments() });
  const payouts = useQuery({ queryKey: ["mp", "finance", "payouts"], queryFn: () => mpApi.payoutsDue() });

  const [refundFor, setRefundFor] = useState<Payment | null>(null);
  const [reason, setReason] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["mp", "finance"] });
  };

  const refund = useMutation({
    mutationFn: () => mpApi.refund(refundFor!.id, reason),
    onSuccess: () => {
      toast.success("Refund processed");
      setRefundFor(null);
      setReason("");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Refund failed"),
  });

  const payout = useMutation({
    mutationFn: (pandit_id: string) => mpApi.processPayout(pandit_id),
    onSuccess: (r) => {
      toast.success(`Paid out ${r.amount_display}`);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Payout failed"),
  });

  const s = summary.data;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Finance</h1>
      <p className="mt-1 text-sm text-muted">
        Payments, the finance ledger, refunds and partner payouts.
      </p>

      {/* Summary */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Gross booking value" value={s ? rupees(s.gross_booking_value_paise) : "—"} />
        <Stat label="Platform commission" value={s ? rupees(s.platform_commission_paise) : "—"} tone="forest" />
        <Stat label="Refunds" value={s ? rupees(s.refunds_paise) : "—"} tone="tomato" />
        <Stat label="Outstanding payable" value={s ? rupees(s.outstanding_payable_paise) : "—"} />
      </div>

      {/* Payouts due */}
      <div className="mt-6 rounded-card border border-line bg-surface p-5 shadow-soft">
        <h2 className="font-display font-semibold text-ink">Partner payouts due</h2>
        {payouts.isLoading ? (
          <div className="py-6 text-center"><Spinner className="text-forest" /></div>
        ) : !payouts.data?.length ? (
          <p className="py-4 text-sm text-muted">Nothing outstanding.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {payouts.data.map((p) => (
              <li key={p.pandit_id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-ink">{p.pandit_name ?? p.pandit_id.slice(0, 8)}</p>
                  <p className="text-xs text-muted">{p.bookings} booking{p.bookings === 1 ? "" : "s"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display font-bold text-forest">{p.amount_display}</span>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (confirm(`Pay out ${p.amount_display} to ${p.pandit_name}?`))
                        payout.mutate(p.pandit_id);
                    }}
                    disabled={payout.isPending}
                  >
                    Pay out
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Payments */}
      <div className="mt-6 overflow-hidden rounded-card border border-line bg-surface shadow-soft">
        <h2 className="border-b border-line p-5 font-display font-semibold text-ink">Payments</h2>
        {payments.isLoading ? (
          <div className="py-10 text-center"><Spinner className="text-forest" /></div>
        ) : !payments.data?.length ? (
          <p className="py-10 text-center text-sm text-muted">No payments yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase text-muted">
                <th className="px-5 py-3 font-medium">Booking</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.data.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-medium text-ink">{p.booking_code}</td>
                  <td className="px-5 py-3 text-forest">
                    {p.amount_display}
                    {p.refunded_paise > 0 && (
                      <span className="ml-1 text-xs text-tomato">(−{rupees(p.refunded_paise)})</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-pill bg-surface-2 px-2.5 py-0.5 text-xs capitalize text-ink">
                      {p.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {(p.status === "paid" || p.status === "partially_refunded") && (
                      <Button variant="outline" size="sm" onClick={() => setRefundFor(p)}>
                        Refund
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AdminModal
        title={`Refund ${refundFor?.booking_code ?? ""}`}
        open={refundFor !== null}
        onClose={() => { setRefundFor(null); setReason(""); }}
      >
        {refundFor && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Refundable: {rupees(refundFor.amount_paise - refundFor.refunded_paise)} (full remaining).
            </p>
            <AField label="Reason (required)">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. customer request" />
            </AField>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setRefundFor(null); setReason(""); }}>Cancel</Button>
              <Button
                onClick={() => refund.mutate()}
                disabled={reason.trim().length < 2 || refund.isPending}
                className="border-tomato/40"
              >
                {refund.isPending ? <Spinner /> : "Process refund"}
              </Button>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}

function Stat({ label, value, tone = "ink" }: { label: string; value: string; tone?: "ink" | "forest" | "tomato" }) {
  const c = tone === "forest" ? "text-forest" : tone === "tomato" ? "text-tomato" : "text-ink";
  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-soft">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${c}`}>{value}</p>
    </div>
  );
}
