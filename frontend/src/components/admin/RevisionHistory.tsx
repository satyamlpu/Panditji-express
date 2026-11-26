"use client";

import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { systemApi } from "@/features/media/api";
import { Spinner } from "@/components/ui/spinner";

const ACTION_LABEL: Record<string, string> = {
  create: "Created",
  update: "Edited",
  publish: "Published",
  unpublish: "Unpublished",
  restore: "Restored",
};

function fmt(iso: string): string {
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

/** Per-entity content revision history (Website Management). Read-only list of
 *  snapshots recorded on each save/publish. */
export function RevisionHistory({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "revisions", entityType, entityId],
    queryFn: () => systemApi.revisions(entityType, entityId),
  });

  return (
    <div className="mt-4 rounded-card border border-line bg-surface p-5 shadow-soft">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        <History size={14} /> Revision history
      </div>
      {isLoading ? (
        <div className="py-4 text-center">
          <Spinner className="text-forest" />
        </div>
      ) : !data?.length ? (
        <p className="text-sm text-muted">No revisions recorded yet.</p>
      ) : (
        <ol className="space-y-2.5">
          {data.map((r) => (
            <li key={r.id} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold tabular-nums text-muted">
                {r.version}
              </span>
              <div className="min-w-0">
                <p className="font-medium text-ink">
                  {ACTION_LABEL[r.action] ?? r.action}
                </p>
                <p className="text-xs text-muted">
                  {fmt(r.created_at)}
                  {r.actor_email ? ` · ${r.actor_email}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
