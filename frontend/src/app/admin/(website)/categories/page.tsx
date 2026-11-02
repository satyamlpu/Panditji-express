"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  categoriesApi,
  type CategoryAdmin,
} from "@/features/content/api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { AField, AdminModal, selectClass, StatusDot } from "@/components/admin/kit";

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

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Categories</h1>
          <p className="mt-1 text-sm text-muted">
            Optional groupings for your pujas.
          </p>
        </div>
        <Button onClick={() => setEditing({ status: "draft", sort_order: 0 })}>
          <Plus size={16} /> New category
        </Button>
      </div>

      <div className="mt-5 overflow-hidden rounded-card border border-line bg-surface">
        {isLoading ? (
          <div className="py-16 text-center">
            <Spinner className="text-forest" />
          </div>
        ) : !data?.length ? (
          <p className="py-16 text-center text-sm text-muted">No categories yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-ink">
                    {c.name}{" "}
                    <span className="text-xs text-muted">
                      · {c.service_count ?? 0} pujas
                    </span>
                  </p>
                  <p className="text-xs text-muted">/{c.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusDot status={c.status} />
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
              </li>
            ))}
          </ul>
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
