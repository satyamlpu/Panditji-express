"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpDown,
  CheckCircle2,
  Circle,
  ExternalLink,
  ImageOff,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { servicesApi } from "@/features/services/api";
import { ApiError } from "@/lib/api";
import { buttonClasses, Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/kit";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { ServiceAdmin } from "@/lib/types";

const STATUSES = ["all", "published", "draft", "unpublished"] as const;
const PAGE_SIZE = 12;

type SortKey = "sort_order" | "title" | "price" | "updated";

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function AdminServicesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("sort_order");
  const [asc, setAsc] = useState(true);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "services", status, q],
    queryFn: () =>
      servicesApi.list({ status: status === "all" ? undefined : status, q: q || undefined }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "services"] });

  const toggle = useMutation({
    mutationFn: ({ s }: { s: ServiceAdmin }) =>
      servicesApi.update(s.id, {
        status: s.status === "published" ? "unpublished" : "published",
      }),
    onSuccess: (updated) => {
      toast.success(updated.status === "published" ? "Published" : "Unpublished");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Update failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => servicesApi.remove(id),
    onSuccess: () => {
      toast.success("Service deleted");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Delete failed"),
  });

  const items = useMemo(() => {
    const list = [...(data?.items ?? [])];
    list.sort((a, b) => {
      let cmp = 0;
      if (sort === "title") cmp = a.title.localeCompare(b.title);
      else if (sort === "price") cmp = (a.price_rupees ?? -1) - (b.price_rupees ?? -1);
      else if (sort === "updated") cmp = a.updated_at.localeCompare(b.updated_at);
      else cmp = a.sort_order - b.sort_order || a.title.localeCompare(b.title);
      return asc ? cmp : -cmp;
    });
    return list;
  }, [data?.items, sort, asc]);

  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function setSortKey(key: SortKey) {
    if (sort === key) setAsc((v) => !v);
    else {
      setSort(key);
      setAsc(true);
    }
    setPage(1);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Services</h1>
          <p className="mt-1 text-sm text-muted">
            Manage pujas — thumbnail, pricing, inclusions, SEO and publication.
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
        <Input
          type="search"
          placeholder="Search title or slug…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-64"
        />
      </div>

      <div className="mt-5 overflow-x-auto rounded-card border border-line bg-surface shadow-soft">
        {isLoading ? (
          <div className="py-16 text-center">
            <Spinner className="text-forest" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">
            No services found. Create your first one.
          </p>
        ) : (
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-semibold">Thumbnail</th>
                <SortTh label="Service" active={sort === "title"} asc={asc} onClick={() => setSortKey("title")} />
                <th className="px-4 py-3 font-semibold">Category</th>
                <SortTh label="Price" active={sort === "price"} asc={asc} onClick={() => setSortKey("price")} />
                <th className="px-4 py-3 font-semibold">Duration</th>
                <th className="px-4 py-3 font-semibold">Samagri</th>
                <SortTh label="Order" active={sort === "sort_order"} asc={asc} onClick={() => setSortKey("sort_order")} />
                <th className="px-4 py-3 font-semibold">Status</th>
                <SortTh label="Updated" active={sort === "updated"} asc={asc} onClick={() => setSortKey("updated")} />
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0 align-middle">
                  <td className="px-4 py-3">
                    <div className="h-12 w-20 overflow-hidden rounded-lg border border-line bg-surface-2">
                      {s.thumbnail?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.thumbnail.thumb_url || s.thumbnail.url}
                          alt={s.thumbnail.alt || s.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-muted">
                          <ImageOff size={16} />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{s.title}</div>
                    {s.title_hi && <div className="text-xs text-muted">{s.title_hi}</div>}
                    <div className="text-xs text-muted/80">/{s.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-muted">{s.category?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-forest">{s.price_display}</td>
                  <td className="px-4 py-3 text-muted">{s.duration_label ?? "—"}</td>
                  <td className="px-4 py-3">
                    {s.samagri?.length ? (
                      <span className="inline-flex items-center gap-1 text-forest" title={`${s.samagri.length} items`}>
                        <CheckCircle2 size={15} /> Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted">
                        <Circle size={15} /> No
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted">{s.sort_order}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{fmtDate(s.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {s.status === "published" && (
                        <a
                          href={`/puja-services/${s.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-forest"
                          aria-label="Preview live page"
                          title="Preview live page"
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                      <Link
                        href={`/admin/services/${s.id}/edit`}
                        className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-forest"
                        aria-label="Edit"
                        title="Edit"
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
                        title="Delete"
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

      {pages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-3 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-muted">
            Page {page} of {pages} · {items.length} services
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function SortTh({
  label,
  active,
  asc,
  onClick,
}: {
  label: string;
  active: boolean;
  asc: boolean;
  onClick: () => void;
}) {
  return (
    <th className="px-4 py-3 font-semibold">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 hover:text-ink",
          active && "text-forest",
        )}
      >
        {label}
        <ArrowUpDown size={12} className={cn(active && asc && "rotate-180")} />
      </button>
    </th>
  );
}
