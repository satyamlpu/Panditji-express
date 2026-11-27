"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import {
  mpApi,
  type LedgerFeedRow,
  type ReconciliationTotals,
} from "@/features/marketplace/api";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  EmptyState,
  LoadingSkeleton,
  PageHeader,
  Td,
  Th,
  selectClass,
} from "@/components/admin/kit";
import { cn } from "@/lib/utils";

const TABS = ["reconciliation", "ledger", "refunds"] as const;
type Tab = (typeof TABS)[number];
const ENTRY_TYPES = [
  "", "customer_charge", "platform_commission", "gateway_fee",
  "partner_payable", "refund", "payout",
];

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}
function rupees(paise: number) {
  return `₹${Math.round(paise / 100).toLocaleString()}`;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3 shadow-soft">
      <p className={cn("text-xl font-bold tabular-nums text-ink", tone)}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function ReconciliationTab() {
  const [days, setDays] = useState(30);
  const recon = useQuery({
    queryKey: ["mp", "finance", "recon", days],
    queryFn: () => mpApi.reconciliation(days),
  });

  if (recon.isError)
    return <EmptyState icon="finance" title="Access restricted" description="Finance reports are restricted to finance staff." />;
  if (recon.isLoading || !recon.data) return <LoadingSkeleton rows={5} />;

  const t: ReconciliationTotals = recon.data.totals;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted">Range</span>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={cn(selectClass, "w-auto")}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Metric label="Gross booking value" value={t.gross_booking_value_display} />
        <Metric label="Platform commission" value={t.platform_commission_display} />
        <Metric label="Gateway fees" value={t.gateway_fees_display} />
        <Metric label="Net platform revenue" value={t.net_platform_revenue_display} tone="text-forest" />
        <Metric label="Partner payable" value={t.partner_payable_display} />
        <Metric label="Paid out" value={t.payouts_display} />
        <Metric label="Refunds" value={t.refunds_display} tone={t.refunds_paise ? "text-tomato" : undefined} />
        <Metric label="Outstanding payable" value={t.outstanding_payable_display} tone={t.outstanding_payable_paise ? "text-[#7a5a00]" : undefined} />
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Daily breakdown</h2>
        {!recon.data.by_day.length ? (
          <p className="py-6 text-center text-sm text-muted">No ledger activity in this range.</p>
        ) : (
          <DataTable>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th className="text-right">Charges</Th>
                <Th className="text-right">Commission</Th>
                <Th className="text-right">Gateway</Th>
                <Th className="text-right">Payable</Th>
                <Th className="text-right">Refunds</Th>
                <Th className="text-right">Payouts</Th>
              </tr>
            </thead>
            <tbody>
              {recon.data.by_day.map((d) => (
                <tr key={d.date} className="hover:bg-surface-2">
                  <Td className="whitespace-nowrap text-muted">{fmtDate(d.date)}</Td>
                  <Td className="text-right tabular-nums">{rupees(d.charges_paise)}</Td>
                  <Td className="text-right tabular-nums">{rupees(d.commission_paise)}</Td>
                  <Td className="text-right tabular-nums text-muted">{rupees(d.gateway_paise)}</Td>
                  <Td className="text-right tabular-nums">{rupees(d.payable_paise)}</Td>
                  <Td className="text-right tabular-nums text-tomato">{d.refunds_paise ? rupees(d.refunds_paise) : "—"}</Td>
                  <Td className="text-right tabular-nums">{d.payouts_paise ? rupees(d.payouts_paise) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </div>
    </div>
  );
}

function LedgerTab() {
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const feed = useQuery({
    queryKey: ["mp", "finance", "ledger", type, page],
    queryFn: () => mpApi.ledgerFeed(type || undefined, page),
  });

  if (feed.isError)
    return <EmptyState icon="finance" title="Access restricted" description="Finance reports are restricted to finance staff." />;

  const total = feed.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <select
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1); }}
          className={cn(selectClass, "w-auto")}
          aria-label="Filter ledger by entry type"
        >
          {ENTRY_TYPES.map((t) => (
            <option key={t || "all"} value={t}>{t ? t.replace(/_/g, " ") : "All entry types"}</option>
          ))}
        </select>
        <span className="ml-auto text-sm text-muted">{total} entr{total === 1 ? "y" : "ies"}</span>
      </div>

      {feed.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : !feed.data?.items.length ? (
        <EmptyState icon="finance" title="No ledger entries" description="Nothing matches this filter." />
      ) : (
        <DataTable>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Type</Th>
              <Th>Booking</Th>
              <Th className="text-right">Amount</Th>
              <Th>Settled</Th>
            </tr>
          </thead>
          <tbody>
            {feed.data.items.map((e: LedgerFeedRow) => (
              <tr key={e.id} className="hover:bg-surface-2">
                <Td className="whitespace-nowrap text-muted">{fmtDate(e.created_at)}</Td>
                <Td><span className="font-medium capitalize text-ink">{e.entry_type.replace(/_/g, " ")}</span></Td>
                <Td className="text-muted">{e.booking_code ?? "—"}</Td>
                <Td className="text-right tabular-nums text-ink">{e.amount_display}</Td>
                <Td className="text-xs text-muted">{e.entry_type === "partner_payable" ? (e.settled ? "settled" : "outstanding") : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}

      {total > 50 && (
        <div className="mt-4 flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-muted">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

function RefundsTab() {
  const refunds = useQuery({ queryKey: ["mp", "finance", "refunds"], queryFn: () => mpApi.financeRefunds() });
  if (refunds.isError)
    return <EmptyState icon="finance" title="Access restricted" description="Finance reports are restricted to finance staff." />;
  if (refunds.isLoading) return <LoadingSkeleton rows={4} />;
  if (!refunds.data?.length)
    return <EmptyState icon="finance" title="No refunds yet" description="Refunds issued from the Finance page will appear here." />;

  return (
    <DataTable>
      <thead>
        <tr>
          <Th>When</Th>
          <Th>Booking</Th>
          <Th className="text-right">Amount</Th>
          <Th>Reason</Th>
          <Th>By</Th>
        </tr>
      </thead>
      <tbody>
        {refunds.data.map((r) => (
          <tr key={r.id} className="hover:bg-surface-2">
            <Td className="whitespace-nowrap text-muted">{fmtDate(r.created_at)}</Td>
            <Td className="text-muted">{r.booking_code ?? "—"}</Td>
            <Td className="text-right tabular-nums text-tomato">{r.amount_display}</Td>
            <Td className="max-w-[260px] text-muted">{r.reason ?? "—"}</Td>
            <Td className="text-xs text-muted">{r.created_by ?? "—"}</Td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

export default function FinanceReportsPage() {
  const [tab, setTab] = useState<Tab>("reconciliation");
  return (
    <div>
      <Link href="/admin/marketplace/finance" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft size={15} /> Back to Finance
      </Link>
      <PageHeader
        title="Finance Reports"
        description="Reconciliation, ledger drill-down and refund history (read-only)."
      />
      <div className="mb-4 mt-2 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize",
              tab === t ? "border-forest text-forest" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "reconciliation" ? <ReconciliationTab /> : tab === "ledger" ? <LedgerTab /> : <RefundsTab />}
    </div>
  );
}
