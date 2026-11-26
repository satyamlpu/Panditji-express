"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImageOff, Pencil, Plus, Trash2 } from "lucide-react";
import { categoriesApi, type CategoryAdmin } from "@/features/content/api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  AField,
  AdminModal,
  selectClass,
  StatusBadge,
} from "@/components/admin/kit";
import { MediaPicker, type ThumbnailValue } from "@/components/admin/MediaPicker";

type Draft = Partial<CategoryAdmin>;

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function AdminCategoriesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => categoriesApi.list(),
  });
  const [editing, setEditing] = useState<Draft | null>(null);
  const [q, setQ] = useState("");

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin", "categories"] });

  const save = useMutation({
    mutationFn: (d: Draft) =>
      d.id
        ? categoriesApi.update(d.id, d)
        : categoriesApi.create({ ...d, slug: d.slug || slugify(d.name ?? "") }),
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Save failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => categoriesApi.remove(id),
    onSuccess: () => {
      toast.success("Deleted");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Delete failed"),
  });

  const rows = useMemo(() => {
    const list = data ?? [];
    const term = q.trim().toLowerCase();
    const filtered = term
      ? list.filter(
          (c) =>
            c.name.toLowerCase().includes(term) ||
            c.slug.toLowerCase().includes(term),
        )
      : list;
    return [...filtered].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }, [data, q]);

  const thumbValue: ThumbnailValue = {
    mediaId: editing?.thumbnail_media_id ?? null,
    previewUrl: editing?.thumbnail?.url ?? null,
    alt: editing?.thumbnail_alt ?? editing?.thumbnail?.alt ?? "",
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Categories</h1>
          <p className="mt-1 text-sm text-muted">
            Groupings for your pujas — with thumbnails shown across the site and apps.
          </p>
        </div>
        <Button onClick={() => setEditing({ status: "draft", sort_order: 0 })}>
          <Plus size={16} /> New category
        </Button>
      </div>

      <div className="mt-5">
        <Input
          type="search"
          placeholder="Search name or slug…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-64"
        />
      </div>

      <div className="mt-5 overflow-x-auto rounded-card border border-line bg-surface shadow-soft">
        {isLoading ? (
          <div className="py-16 text-center">
            <Spinner className="text-forest" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">No categories found.</p>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-semibold">Thumbnail</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 font-semibold">Services</th>
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 align-middle">
                  <td className="px-4 py-3">
                    <div className="h-12 w-20 overflow-hidden rounded-lg border border-line bg-surface-2">
                      {c.thumbnail?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.thumbnail.thumb_url || c.thumbnail.url}
                          alt={c.thumbnail.alt || c.name}
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
                    <div className="font-medium text-ink">{c.name}</div>
                    <div className="text-xs text-muted/80">/{c.slug}</div>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-muted">
                    <span className="line-clamp-2">{c.description || "—"}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted">{c.service_count ?? 0}</td>
                  <td className="px-4 py-3 tabular-nums text-muted">{c.sort_order}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditing(c)}
                        className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-forest"
                        aria-label="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete “${c.name}”?`)) remove.mutate(c.id);
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

      <AdminModal
        title={editing?.id ? "Edit category" : "New category"}
        open={editing !== null}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(editing);
            }}
          >
            <AField label="Name" required>
              <Input
                value={editing.name ?? ""}
                onChange={(e) =>
                  setEditing((d) => ({
                    ...d!,
                    name: e.target.value,
                    slug: d!.id ? d!.slug : slugify(e.target.value),
                  }))
                }
              />
            </AField>
            <AField label="Slug" required hint="/puja-categories/<slug>">
              <Input
                value={editing.slug ?? ""}
                onChange={(e) => setEditing((d) => ({ ...d!, slug: e.target.value }))}
              />
            </AField>
            <AField label="Description">
              <Textarea
                value={editing.description ?? ""}
                onChange={(e) =>
                  setEditing((d) => ({ ...d!, description: e.target.value }))
                }
              />
            </AField>

            <MediaPicker
              value={thumbValue}
              onChange={(next) =>
                setEditing((d) => ({
                  ...d!,
                  thumbnail_media_id: next.mediaId,
                  thumbnail_alt: next.alt,
                  thumbnail: next.previewUrl
                    ? { url: next.previewUrl, thumb_url: null, alt: next.alt }
                    : null,
                }))
              }
              label="Category thumbnail"
            />

            <div className="grid grid-cols-2 gap-4">
              <AField label="Sort order">
                <Input
                  type="number"
                  value={editing.sort_order ?? 0}
                  onChange={(e) =>
                    setEditing((d) => ({ ...d!, sort_order: Number(e.target.value) }))
                  }
                />
              </AField>
              <AField label="Status">
                <select
                  className={selectClass}
                  value={editing.status ?? "draft"}
                  onChange={(e) =>
                    setEditing((d) => ({
                      ...d!,
                      status: e.target.value as CategoryAdmin["status"],
                    }))
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="unpublished">Unpublished</option>
                </select>
              </AField>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? <Spinner /> : "Save"}
              </Button>
            </div>
          </form>
        )}
      </AdminModal>
    </div>
  );
}
