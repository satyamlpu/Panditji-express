"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { bannersApi, type BannerAdmin } from "@/features/content/api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { AField, AdminModal, selectClass, StatusDot } from "@/components/admin/kit";
import { ImageUpload } from "@/components/admin/ImageUpload";

type Draft = Partial<BannerAdmin>;
const KINDS = ["hero", "promo", "trust", "cta"];

export default function AdminHomepagePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "homepage"],
    queryFn: () => bannersApi.list(),
  });
  const [editing, setEditing] = useState<Draft | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "homepage"] });

  const save = useMutation({
    mutationFn: (d: Draft) => (d.id ? bannersApi.update(d.id, d) : bannersApi.create(d)),
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Save failed"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => bannersApi.remove(id),
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
          <h1 className="font-display text-2xl font-bold text-ink">
            Homepage sections
          </h1>
          <p className="mt-1 text-sm text-muted">
            Promotional banners and sections shown on the homepage.
          </p>
        </div>
        <Button onClick={() => setEditing({ kind: "promo", status: "draft", sort_order: 0 })}>
          <Plus size={16} /> New section
        </Button>
      </div>

      <div className="mt-5 overflow-hidden rounded-card border border-line bg-surface">
        {isLoading ? (
          <div className="py-16 text-center">
            <Spinner className="text-forest" />
          </div>
        ) : !data?.length ? (
          <p className="py-16 text-center text-sm text-muted">No sections yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.map((b) => (
              <li key={b.id} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {b.heading ?? "(no heading)"}{" "}
                    <span className="text-xs uppercase text-kiwi">{b.kind}</span>
                  </p>
                  {b.subheading && (
                    <p className="line-clamp-1 text-sm text-muted">{b.subheading}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusDot status={b.status} />
                  <button
                    onClick={() => setEditing(b)}
                    className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-forest"
                    aria-label="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => confirm("Delete this section?") && remove.mutate(b.id)}
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
        title={editing?.id ? "Edit section" : "New section"}
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
              <AField label="Kind">
                <select
                  className={selectClass}
                  value={editing.kind ?? "promo"}
                  onChange={(e) => setEditing((d) => ({ ...d!, kind: e.target.value }))}
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </AField>
              <AField label="Status">
                <select
                  className={selectClass}
                  value={editing.status ?? "draft"}
                  onChange={(e) =>
                    setEditing((d) => ({
                      ...d!,
                      status: e.target.value as BannerAdmin["status"],
                    }))
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="unpublished">Unpublished</option>
                </select>
              </AField>
            </div>
            <AField label="Heading">
              <Input
                value={editing.heading ?? ""}
                onChange={(e) => setEditing((d) => ({ ...d!, heading: e.target.value }))}
              />
            </AField>
            <AField label="Subheading">
              <Textarea
                value={editing.subheading ?? ""}
                onChange={(e) =>
                  setEditing((d) => ({ ...d!, subheading: e.target.value }))
                }
              />
            </AField>
            <AField label="Image" hint="Shown on the homepage for this section">
              <ImageUpload
                value={editing.image_url}
                onChange={(url) => setEditing((d) => ({ ...d!, image_url: url }))}
              />
            </AField>
            <div className="grid grid-cols-2 gap-4">
              <AField label="CTA label">
                <Input
                  value={editing.cta_label ?? ""}
                  onChange={(e) =>
                    setEditing((d) => ({ ...d!, cta_label: e.target.value }))
                  }
                />
              </AField>
              <AField label="CTA link">
                <Input
                  value={editing.cta_href ?? ""}
                  onChange={(e) =>
                    setEditing((d) => ({ ...d!, cta_href: e.target.value }))
                  }
                  placeholder="/puja-services"
                />
              </AField>
            </div>
            <AField label="Sort order">
              <Input
                type="number"
                value={editing.sort_order ?? 0}
                onChange={(e) =>
                  setEditing((d) => ({ ...d!, sort_order: Number(e.target.value) }))
                }
              />
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
