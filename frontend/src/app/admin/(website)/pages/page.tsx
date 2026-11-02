"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { pagesApi, type PageAdmin } from "@/features/content/api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { AField, AdminModal, selectClass, StatusDot } from "@/components/admin/kit";

type Draft = Partial<PageAdmin>;

export default function AdminPagesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "pages"],
    queryFn: () => pagesApi.list(),
  });
  const [editing, setEditing] = useState<Draft | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "pages"] });

  const save = useMutation({
    mutationFn: (d: Draft) => (d.id ? pagesApi.update(d.id, d) : pagesApi.create(d)),
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Save failed"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => pagesApi.remove(id),
    onSuccess: () => {
      toast.success("Deleted");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Delete failed"),
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Pages</h1>
          <p className="mt-1 text-sm text-muted">
            About, contact and policy pages. Body supports Markdown.
          </p>
        </div>
        <Button onClick={() => setEditing({ status: "draft" })}>
          <Plus size={16} /> New page
        </Button>
      </div>

      <div className="mt-5 overflow-hidden rounded-card border border-line bg-surface">
        {isLoading ? (
          <div className="py-16 text-center">
            <Spinner className="text-forest" />
          </div>
        ) : !data?.length ? (
          <p className="py-16 text-center text-sm text-muted">No pages yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-ink">{p.title}</p>
                  <p className="text-xs text-muted">/{p.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusDot status={p.status} />
                  {p.status === "published" && (
                    <a
                      href={`/${p.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-forest"
                      aria-label="View live"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                  <button
                    onClick={() => setEditing(p)}
                    className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-forest"
                    aria-label="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => confirm(`Delete “${p.title}”?`) && remove.mutate(p.id)}
                    className="rounded-lg p-2 text-muted hover:bg-tomato/10 hover:text-tomato"
                    aria-label="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AdminModal
        title={editing?.id ? "Edit page" : "New page"}
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
            <div className="grid grid-cols-2 gap-4">
              <AField label="Title" required>
                <Input
                  value={editing.title ?? ""}
                  onChange={(e) => setEditing((d) => ({ ...d!, title: e.target.value }))}
                />
              </AField>
              <AField label="Slug" required={!editing.id} hint="/<slug>">
                <Input
                  value={editing.slug ?? ""}
                  disabled={Boolean(editing.id)}
                  onChange={(e) => setEditing((d) => ({ ...d!, slug: e.target.value }))}
                  placeholder="about-us"
                />
              </AField>
            </div>
            <AField label="Body (Markdown)">
              <Textarea
                className="min-h-48 font-mono text-xs"
                value={editing.body ?? ""}
                onChange={(e) => setEditing((d) => ({ ...d!, body: e.target.value }))}
              />
            </AField>
            <AField label="SEO title">
              <Input
                value={editing.seo_title ?? ""}
                onChange={(e) =>
                  setEditing((d) => ({ ...d!, seo_title: e.target.value }))
                }
              />
            </AField>
            <AField label="Meta description">
              <Textarea
                value={editing.seo_description ?? ""}
                onChange={(e) =>
                  setEditing((d) => ({ ...d!, seo_description: e.target.value }))
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
                    status: e.target.value as PageAdmin["status"],
                  }))
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="unpublished">Unpublished</option>
              </select>
            </AField>
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
