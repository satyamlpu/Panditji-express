"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  HardDrive,
  RefreshCw,
} from "lucide-react";
import { systemApi } from "@/features/media/api";
import { PageHeader, StatusBadge } from "@/components/admin/kit";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const ACTION_LABEL: Record<string, string> = {
  "content.create": "Created",
  "content.update": "Updated",
  "content.publish": "Published",
  "content.unpublish": "Unpublished",
  "content.delete": "Deleted",
  "content.slug_change": "Slug changed",
  "auth.login": "Signed in",
  "auth.logout": "Signed out",
  "auth.password_change": "Password changed",
  "enquiry.update": "Enquiry updated",
};

export default function ActivityPage() {
  const [recheck, setRecheck] = useState(0);
  const sync = useQuery({
    queryKey: ["admin", "sync-status", recheck],
    queryFn: () => systemApi.syncStatus(true),
  });
  const audit = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => systemApi.audit({ page: 1 }),
  });

  const s = sync.data;

  return (
    <div>
      <PageHeader
        title="Sync & Activity"
        description="Publish-to-website sync health, plus the administrator audit trail."
      />

      {/* Sync status */}
      <section className="rounded-card border border-line bg-surface p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-ink">
            Content sync health
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRecheck((n) => n + 1)}
            disabled={sync.isFetching}
          >
            {sync.isFetching ? <Spinner /> : <RefreshCw size={14} />} Re-check
          </Button>
        </div>

        {sync.isLoading || !s ? (
          <div className="py-8 text-center">
            <Spinner className="text-forest" />
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4",
                s.revalidation_reachable
                  ? "border-forest/30 bg-forest/5"
                  : "border-sunshine/40 bg-sunshine/10",
              )}
            >
              {s.revalidation_reachable ? (
                <CheckCircle2 className="mt-0.5 shrink-0 text-forest" size={20} />
              ) : (
                <AlertTriangle className="mt-0.5 shrink-0 text-[#a9700a]" size={20} />
              )}
              <div>
                <p className="font-medium text-ink">
                  {s.revalidation_reachable
                    ? "Published changes appear on the website instantly"
                    : "On-demand revalidation is not reaching the website"}
                </p>
                <p className="mt-0.5 text-sm text-muted">{s.revalidation_detail}</p>
                {!s.revalidation_reachable && (
                  <p className="mt-2 text-xs text-muted">
                    Until this is fixed, edits still appear — but only after the
                    time-based cache window elapses, not immediately. Check
                    FRONTEND_REVALIDATE_URL and REVALIDATE_SECRET on the backend.
                  </p>
                )}
              </div>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Info
                icon={<RefreshCw size={15} />}
                label="Revalidation webhook"
                value={s.frontend_revalidate_url || "— not configured —"}
              />
              <Info
                icon={<Database size={15} />}
                label="Database"
                value={s.database}
              />
              <Info
                icon={<HardDrive size={15} />}
                label="Media storage"
                value={s.media_storage_backend}
              />
            </dl>

            {s.revalidation_secret_is_default && (
              <p className="rounded-lg bg-tomato/10 px-3 py-2 text-xs text-tomato">
                REVALIDATE_SECRET is still the default value — set a unique secret
                in production (backend and frontend must match).
              </p>
            )}
            {s.last_result && (
              <p className="text-xs text-muted">
                Last publish revalidation:{" "}
                <span className={s.last_result.ok ? "text-forest" : "text-tomato"}>
                  {s.last_result.ok ? "succeeded" : "failed"}
                </span>{" "}
                — {s.last_result.detail}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Audit log */}
      <section className="mt-6">
        <h2 className="mb-3 font-display text-base font-semibold text-ink">
          Administrator audit log
        </h2>
        <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-soft">
          {audit.isLoading ? (
            <div className="py-12 text-center">
              <Spinner className="text-forest" />
            </div>
          ) : !audit.data?.items.length ? (
            <p className="py-12 text-center text-sm text-muted">No activity yet.</p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Entity</th>
                  <th className="px-4 py-3 font-semibold">Admin</th>
                  <th className="px-4 py-3 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.items.map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                      {fmtTime(e.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={e.action}
                        label={ACTION_LABEL[e.action] ?? e.action}
                        tone={
                          e.action === "content.delete"
                            ? "tomato"
                            : e.action === "content.publish"
                              ? "forest"
                              : "neutral"
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {e.entity ? (
                        <>
                          <span className="capitalize text-ink">{e.entity}</span>
                          {e.entity_id && (
                            <span className="ml-1 text-xs text-muted/70">
                              {e.entity_id.slice(0, 8)}
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{e.actor_email ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted">{e.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/50 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {icon} {label}
      </div>
      <p className="mt-1 break-all text-sm text-ink">{value}</p>
    </div>
  );
}
