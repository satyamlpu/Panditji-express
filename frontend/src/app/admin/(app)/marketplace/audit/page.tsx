"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ShieldCheck, Search } from "lucide-react";
import {
  mpApi,
  type AuditListParams,
  type AuditLogRow,
} from "@/features/marketplace/api";
import { ApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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

const TABS = ["log", "roles"] as const;
type Tab = (typeof TABS)[number];

function fmtTime(s: string) {
  return new Date(s).toLocaleString(undefined, {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function MetaCell({ row }: { row: AuditLogRow }) {
  const [open, setOpen] = useState(false);
  if (!row.meta || Object.keys(row.meta).length === 0) return <span className="text-muted">—</span>;
  return (
    <>
      <button onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-forest underline underline-offset-2">
        {open ? "Hide" : "Details"}
      </button>
      {open ? (
        <pre className="mt-1 max-w-[320px] overflow-x-auto rounded bg-surface-2 p-2 text-[11px] text-ink">
          {JSON.stringify(row.meta, null, 2)}
        </pre>
      ) : null}
    </>
  );
}

function AuditLogTab() {
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const meta = useQuery({ queryKey: ["mp", "audit", "meta"], queryFn: () => mpApi.auditMeta() });

  const params: AuditListParams = {
    q: q || undefined, action: action || undefined, page, page_size: pageSize,
  };
  const log = useQuery({
    queryKey: ["mp", "audit", "log", params],
    queryFn: () => mpApi.auditLog(params),
  });

  if (log.isError) {
    const msg = log.error instanceof ApiError && log.error.status === 403
      ? "The audit log is restricted to super-admins."
      : "Could not load the audit log.";
    return <EmptyState icon="security" title="Access restricted" description={msg} />;
  }

  const total = log.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => { e.preventDefault(); setPage(1); setQ(draft.trim()); }}
          className="relative"
        >
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search action, actor, entity…" className="w-64 pl-8" />
        </form>
        <select
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          className={cn(selectClass, "w-auto")}
          aria-label="Filter by action"
        >
          <option value="">All actions</option>
          {meta.data?.actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="ml-auto text-sm text-muted">{total} event{total === 1 ? "" : "s"}</span>
      </div>

      {log.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : !log.data?.items.length ? (
        <EmptyState icon="security" title="No audit events" description="Nothing matches these filters yet." />
      ) : (
        <DataTable>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Actor</Th>
              <Th>Action</Th>
              <Th>Entity</Th>
              <Th>Details</Th>
            </tr>
          </thead>
          <tbody>
            {log.data.items.map((r) => (
              <tr key={r.id} className="align-top hover:bg-surface-2">
                <Td className="whitespace-nowrap text-muted">{fmtTime(r.created_at)}</Td>
                <Td>{r.actor_email ?? <span className="text-muted">system</span>}</Td>
                <Td><span className="font-medium text-ink">{r.action}</span></Td>
                <Td className="text-muted">
                  {r.entity ?? "—"}
                  {r.entity_id ? <span className="block text-[11px]">{r.entity_id.slice(0, 8)}…</span> : null}
                </Td>
                <Td><MetaCell row={r} /></Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}

      {total > pageSize && (
        <div className="mt-4 flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-muted">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

function RolesTab() {
  const perms = useQuery({ queryKey: ["mp", "audit", "permissions"], queryFn: () => mpApi.auditPermissions() });

  if (perms.isError)
    return <EmptyState icon="security" title="Access restricted" description="The permissions matrix is restricted to super-admins." />;
  if (perms.isLoading || !perms.data) return <LoadingSkeleton rows={6} />;

  const { roles, modules } = perms.data;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Server-enforced access by staff role. Super-admin is allowed everywhere. This
        mirrors the <code className="text-ink">require_staff</code> gates in the backend.
      </p>
      <DataTable>
        <thead>
          <tr>
            <Th>Module</Th>
            {roles.map((r) => <Th key={r} className="text-center capitalize">{r === "admin" ? "super-admin" : r}</Th>)}
          </tr>
        </thead>
        <tbody>
          {modules.map((m) => (
            <tr key={m.module} className="hover:bg-surface-2">
              <Td>
                <p className="font-medium text-ink">{m.module}</p>
                <p className="text-[11px] text-muted">{m.description}</p>
              </Td>
              {roles.map((r) => {
                const allowed = m.roles.includes(r) || r === "admin";
                return (
                  <Td key={r} className="text-center">
                    {allowed ? <Check size={15} className="mx-auto text-forest" /> : <span className="text-line">·</span>}
                  </Td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}

export default function AuditRolesPage() {
  const [tab, setTab] = useState<Tab>("log");
  return (
    <div>
      <PageHeader
        title="Audit & Roles"
        description="Every state-changing action is recorded. Review the trail and the access model."
      />
      <div className="mb-4 mt-4 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium",
              tab === t ? "border-forest text-forest" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t === "roles" ? <ShieldCheck size={14} /> : null}
            {t === "log" ? "Audit log" : "Roles & permissions"}
          </button>
        ))}
      </div>
      {tab === "log" ? <AuditLogTab /> : <RolesTab />}
    </div>
  );
}
