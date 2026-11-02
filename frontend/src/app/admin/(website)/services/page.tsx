"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { servicesApi } from "@/features/services/api";
import { ApiError } from "@/lib/api";
import { buttonClasses, Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { ServiceAdmin } from "@/lib/types";

const STATUSES = ["all", "published", "draft", "unpublished"] as const;

function statusTone(s: string) {
  if (s === "published") return "forest" as const;
  if (s === "draft") return "draft" as const;
  return "unpublished" as const;
}

export default function AdminServicesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "services", status, q],
    queryFn: () =>
      servicesApi.list({ status: status === "all" ? undefined : status, q: q || undefined }),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin", "services"] });

  const toggle = useMutation({
    mutationFn: ({ s }: { s: ServiceAdmin }) =>
      servicesApi.update(s.id, {
        status: s.status === "published" ? "unpublished" : "published",
      }),
    onSuccess: (updated) => {
      toast.success(
        updated.status === "published" ? "Published" : "Unpublished",
      );
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Update failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => servicesApi.remove(id),
    onSuccess: () => {
      toast.success("Service deleted");
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Delete failed"),
  });

  const items = data?.items ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Services</h1>
          <p className="mt-1 text-sm text-muted">
            Manage pujas — price, inclusions, SEO and publication.
          </p>
        </div>
        <Link href="/admin/services/new" className={buttonClasses("primary", "md")}>
          <Plus size={16} /> New service
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
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
        <Input
          type="search"
          placeholder="Search title or slug…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-64"
        />
      </div>

      <div className="mt-5 overflow-hidden rounded-card border border-line bg-surface">
        {isLoading ? (
          <div className="py-16 text-center">
            <Spinner className="text-forest" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">
            No services found. Create your first one.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{s.title}</div>
                    <div className="text-xs text-muted">/{s.slug}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-forest">
                    {s.price_display}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {s.status === "published" && (
                        <a
                          href={`/puja-services/${s.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-forest"
                          aria-label="View live page"
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                      <Link
                        href={`/admin/services/${s.id}/edit`}
                        className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-forest"
                        aria-label="Edit"
                      >
                        <Pencil size={16} />
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggle.mutate({ s })}
                        disabled={toggle.isPending}
                      >
                        {s.status === "published" ? "Unpublish" : "Publish"}
                      </Button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete “${s.title}”? This cannot be undone.`))
                            remove.mutate(s.id);
                        }}
                        className="rounded-lg p-2 text-muted hover:bg-tomato/10 hover:text-tomato"
                        aria-label="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
