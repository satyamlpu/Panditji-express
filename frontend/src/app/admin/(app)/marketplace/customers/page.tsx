"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, Search, Download, Ban, RotateCcw, Pencil } from "lucide-react";
import {
  mpApi,
  type CustomerAdmin,
  type CustomerListParams,
} from "@/features/marketplace/api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  AdminModal,
  AField,
  DataTable,
  EmptyState,
  LoadingSkeleton,
  PageHeader,
  StatusDot,
  Td,
  Th,
  selectClass,
} from "@/components/admin/kit";
import { cn } from "@/lib/utils";

const STATUSES = ["all", "active", "suspended"];
const TABS = ["bookings", "payments", "reviews", "tickets", "addresses", "activity"] as const;
type Tab = (typeof TABS)[number];

function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

function CustomersInner() {
  const qc = useQueryClient();
  const initialStatus = useSearchParams().get("status") ?? "all";

  const [q, setQ] = useState("");
  const [queryText, setQueryText] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [openId, setOpenId] = useState<string | null>(null);

  const params: CustomerListParams = {
    q: queryText || undefined,
    status: status === "all" ? undefined : status,
    sort,
    order,
    page,
    page_size: pageSize,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["mp", "customers", params],
    queryFn: () => mpApi.customers(params),
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQueryText(q.trim());
  };

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Customer directory with profiles, booking, payment and support history."
      />

      {/* Toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <form onSubmit={submitSearch} className="relative">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or phone…"
            className="w-64 pl-8"
            aria-label="Search customers"
          />
        </form>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
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
        <select
          value={`${sort}:${order}`}
          onChange={(e) => {
            const [s, o] = e.target.value.split(":");
            setSort(s);
            setOrder(o as "asc" | "desc");
            setPage(1);
          }}
          className={cn(selectClass, "w-auto")}
          aria-label="Sort customers"
        >
          <option value="created_at:desc">Newest first</option>
          <option value="created_at:asc">Oldest first</option>
          <option value="name:asc">Name A–Z</option>
          <option value="name:desc">Name Z–A</option>
          <option value="phone:asc">Phone ↑</option>
        </select>
        <span className="ml-auto text-sm text-muted">{total} customer{total === 1 ? "" : "s"}</span>
      </div>

      {/* Table */}
      <div className="mt-4">
        {isLoading ? (
          <LoadingSkeleton rows={6} />
        ) : !data?.items.length ? (
          <EmptyState icon="customers" title="No customers match" description="Try a different search or filter." />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th className="text-right">Bookings</Th>
                <Th className="text-right">Spend</Th>
                <Th className="text-right">Reviews</Th>
                <Th className="text-right">Open tickets</Th>
                <Th>Joined</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((c: CustomerAdmin) => (
                <tr key={c.id} className="hover:bg-surface-2">
                  <Td>
                    <p className="font-medium text-ink">{c.name ?? "(unnamed)"}</p>
                    <p className="flex items-center gap-1 text-xs text-muted">
                      <Phone size={12} /> {c.phone}
                    </p>
                  </Td>
                  <Td><StatusDot status={c.status} /></Td>
                  <Td className="text-right tabular-nums">
                    {c.bookings_count}
                    {c.cancelled_count > 0 ? (
                      <span className="text-xs text-muted"> ({c.cancelled_count} canc.)</span>
                    ) : null}
                  </Td>
                  <Td className="text-right tabular-nums">{c.total_spent_display}</Td>
                  <Td className="text-right tabular-nums">{c.review_count}</Td>
                  <Td className="text-right tabular-nums">
                    {c.open_tickets > 0 ? (
                      <span className="font-medium text-tomato">{c.open_tickets}</span>
                    ) : (
                      "0"
                    )}
                  </Td>
                  <Td className="text-muted">{fmtDate(c.created_at)}</Td>
                  <Td className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setOpenId(c.id)}>
                      Open
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="mt-4 flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      {openId && (
        <CustomerDrawer
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["mp", "customers"] })}
        />
      )}
    </div>
  );
}

function CustomerDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("bookings");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("");

  const detail = useQuery({
    queryKey: ["mp", "customer", id],
    queryFn: () => mpApi.customer(id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["mp", "customer", id] });
    onChanged();
  };

  const save = useMutation({
    mutationFn: () => mpApi.updateCustomer(id, { name: name || undefined, language: language || undefined }),
    onSuccess: () => {
      toast.success("Customer updated");
      setEditing(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed"),
  });

  const lifecycle = useMutation({
    mutationFn: ({ action, reason }: { action: "suspend" | "reactivate"; reason: string }) =>
      action === "suspend" ? mpApi.suspendCustomer(id, reason) : mpApi.reactivateCustomer(id, reason),
    onSuccess: (_d, v) => {
      toast.success(v.action === "suspend" ? "Customer suspended" : "Customer reactivated");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed"),
  });

  const doLifecycle = (action: "suspend" | "reactivate") => {
    const reason = window.prompt(
      action === "suspend"
        ? "Reason for suspending this customer (recorded in the audit log):"
        : "Reason for reactivating (recorded in the audit log):",
    );
    if (reason && reason.trim().length >= 2) lifecycle.mutate({ action, reason: reason.trim() });
    else if (reason !== null) toast.error("A reason of at least 2 characters is required.");
  };

  const c = detail.data;

  return (
    <AdminModal title="Customer profile" open onClose={onClose}>
      {detail.isLoading || !c ? (
        <div className="py-10 text-center"><Spinner className="text-forest" /></div>
      ) : (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-lg font-semibold text-ink">{c.name ?? "(unnamed)"}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted"><Phone size={14} /> {c.phone}</p>
              <p className="mt-0.5 text-xs text-muted">Joined {fmtDate(c.created_at)} · {c.language ?? "no language set"}</p>
            </div>
            <StatusDot status={c.status} />
          </div>

          {/* Summary tiles */}
          <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
            {[
              ["Bookings", c.bookings_count],
              ["Completed", c.completed_count],
              ["Cancelled", c.cancelled_count],
              ["Spend", c.total_spent_display],
              ["Reviews", c.review_count],
              ["Open tickets", c.open_tickets],
            ].map(([label, val]) => (
              <div key={label as string} className="rounded-lg border border-line bg-surface-2 px-2 py-2">
                <p className="text-sm font-semibold tabular-nums text-ink">{val}</p>
                <p className="text-[11px] text-muted">{label}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => { setEditing(true); setName(c.name ?? ""); setLanguage(c.language ?? ""); }}>
                <Pencil size={14} /> Edit
              </Button>
            ) : null}
            {c.status === "active" ? (
              <Button variant="outline" size="sm" className="border-tomato/40 text-tomato" onClick={() => doLifecycle("suspend")} disabled={lifecycle.isPending}>
                <Ban size={14} /> Suspend
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => doLifecycle("reactivate")} disabled={lifecycle.isPending}>
                <RotateCcw size={14} /> Reactivate
              </Button>
            )}
            <a
              href={`/api/backend/api/v1/mp/admin/customers/${id}/export`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-2"
            >
              <Download size={14} /> Export
            </a>
          </div>

          {editing && (
            <div className="space-y-3 rounded-lg border border-line bg-surface-2 p-3">
              <AField label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></AField>
              <AField label="Language"><Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="e.g. Hindi" /></AField>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div>
            <div className="flex flex-wrap gap-1 border-b border-line">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  className={cn(
                    "border-b-2 px-3 py-2 text-sm font-medium capitalize -mb-px",
                    tab === t ? "border-forest text-forest" : "border-transparent text-muted hover:text-ink",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="pt-3">
              <CustomerTab id={id} tab={tab} addresses={c.addresses} />
            </div>
          </div>
        </div>
      )}
    </AdminModal>
  );
}

function CustomerTab({ id, tab, addresses }: { id: string; tab: Tab; addresses: { id: string; label: string | null; line: string; landmark: string | null }[] }) {
  const bookings = useQuery({ queryKey: ["mp", "customer", id, "bookings"], queryFn: () => mpApi.customerBookings(id), enabled: tab === "bookings" });
  const payments = useQuery({ queryKey: ["mp", "customer", id, "payments"], queryFn: () => mpApi.customerPayments(id), enabled: tab === "payments" });
  const reviews = useQuery({ queryKey: ["mp", "customer", id, "reviews"], queryFn: () => mpApi.customerReviews(id), enabled: tab === "reviews" });
  const tickets = useQuery({ queryKey: ["mp", "customer", id, "tickets"], queryFn: () => mpApi.customerTickets(id), enabled: tab === "tickets" });
  const activity = useQuery({ queryKey: ["mp", "customer", id, "activity"], queryFn: () => mpApi.customerActivity(id), enabled: tab === "activity" });

  const Empty = ({ label }: { label: string }) => <p className="py-6 text-center text-sm text-muted">No {label} yet.</p>;
  const Loading = () => <div className="py-6 text-center"><Spinner className="text-forest" /></div>;

  if (tab === "addresses")
    return addresses.length ? (
      <ul className="space-y-1.5">
        {addresses.map((a) => (
          <li key={a.id} className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
            <span className="font-medium text-ink">{a.label ?? "Address"}</span>
            <span className="text-muted"> · {a.line}{a.landmark ? `, ${a.landmark}` : ""}</span>
          </li>
        ))}
      </ul>
    ) : <Empty label="saved addresses" />;

  if (tab === "bookings")
    return bookings.isLoading ? <Loading /> : !bookings.data?.length ? <Empty label="bookings" /> : (
      <ul className="space-y-1.5">
        {bookings.data.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="font-medium text-ink">{b.code}</span>
              <span className="text-muted"> · {b.service_title}</span>
            </span>
            <span className="shrink-0 text-xs text-muted">{b.price_display} · <span className="capitalize">{b.status.replace(/_/g, " ")}</span></span>
          </li>
        ))}
      </ul>
    );

  if (tab === "payments")
    return payments.isLoading ? <Loading /> : !payments.data?.length ? <Empty label="payments" /> : (
      <ul className="space-y-1.5">
        {payments.data.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="font-medium text-ink">{p.amount_display}</span>
              <span className="text-muted"> · {p.booking_code}</span>
              {p.refunded_paise > 0 ? <span className="text-tomato"> · ₹{Math.floor(p.refunded_paise / 100)} refunded</span> : null}
            </span>
            <span className="shrink-0 text-xs capitalize text-muted">{p.status.replace(/_/g, " ")}</span>
          </li>
        ))}
      </ul>
    );

  if (tab === "reviews")
    return reviews.isLoading ? <Loading /> : !reviews.data?.length ? <Empty label="reviews" /> : (
      <ul className="space-y-1.5">
        {reviews.data.map((r) => (
          <li key={r.id} className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
            <p className="font-medium text-ink">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} <span className="text-xs text-muted">· {r.booking_code}{r.hidden ? " · hidden" : ""}</span></p>
            {r.comment ? <p className="text-muted">{r.comment}</p> : null}
          </li>
        ))}
      </ul>
    );

  if (tab === "tickets")
    return tickets.isLoading ? <Loading /> : !tickets.data?.length ? <Empty label="support tickets" /> : (
      <ul className="space-y-1.5">
        {tickets.data.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
            <span className="min-w-0"><span className="font-medium text-ink">{t.ref}</span><span className="text-muted"> · {t.subject}</span></span>
            <span className="shrink-0 text-xs capitalize text-muted">{t.status}</span>
          </li>
        ))}
      </ul>
    );

  // activity
  return activity.isLoading ? <Loading /> : !activity.data?.length ? <Empty label="account activity" /> : (
    <ul className="space-y-1.5">
      {activity.data.map((a, i) => (
        <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
          <span className="min-w-0">
            <span className="font-medium text-ink">{a.action.replace(/^mp\.customer\./, "").replace(/_/g, " ")}</span>
            {a.actor_email ? <span className="text-muted"> · {a.actor_email}</span> : null}
          </span>
          <span className="shrink-0 text-xs text-muted">{fmtDate(a.at)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<Spinner className="text-forest" />}>
      <CustomersInner />
    </Suspense>
  );
}
