"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  testimonialsApi,
  type TestimonialAdmin,
} from "@/features/content/api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { AField, AdminModal, selectClass, StatusDot } from "@/components/admin/kit";

type Draft = Partial<TestimonialAdmin>;

export default function AdminTestimonialsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "testimonials"],
    queryFn: () => testimonialsApi.list(),
  });
  const [editing, setEditing] = useState<Draft | null>(null);
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin", "testimonials"] });

  const save = useMutation({
    mutationFn: (d: Draft) =>
      d.id ? testimonialsApi.update(d.id, d) : testimonialsApi.create(d),
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Save failed"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => testimonialsApi.remove(id),
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
          <h1 className="font-display text-2xl font-bold text-ink">Testimonials</h1>
          <p className="mt-1 text-sm text-muted">
            Publish only genuine, authorised customer feedback.
          </p>
        </div>
        <Button onClick={() => setEditing({ status: "draft", sort_order: 0 })}>
          <Plus size={16} /> New testimonial
        </Button>
      </div>

      <div className="mt-5 overflow-hidden rounded-card border border-line bg-surface">
        {isLoading ? (
          <div className="py-16 text-center">
            <Spinner className="text-forest" />
          </div>
        ) : !data?.length ? (
          <p className="py-16 text-center text-sm text-muted">
            No testimonials yet.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {data.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {t.author_name}
                    {t.author_location ? ` · ${t.author_location}` : ""}
                  </p>
                  <p className="line-clamp-2 text-sm text-muted">“{t.quote}”</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusDot status={t.status} />
                  <button
                    onClick={() => setEditing(t)}
                    className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-forest"
                    aria-label="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => confirm("Delete this testimonial?") && remove.mutate(t.id)}
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
        title={editing?.id ? "Edit testimonial" : "New testimonial"}
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
              <AField label="Author name" required>
                <Input
                  value={editing.author_name ?? ""}
                  onChange={(e) =>
                    setEditing((d) => ({ ...d!, author_name: e.target.value }))
                  }
                />
              </AField>
              <AField label="Location">
                <Input
                  value={editing.author_location ?? ""}
                  onChange={(e) =>
                    setEditing((d) => ({ ...d!, author_location: e.target.value }))
                  }
                />
              </AField>
            </div>
            <AField label="Service (label)">
              <Input
                value={editing.service_label ?? ""}
                onChange={(e) =>
                  setEditing((d) => ({ ...d!, service_label: e.target.value }))
                }
              />
            </AField>
            <AField label="Quote" required>
              <Textarea
                value={editing.quote ?? ""}
                onChange={(e) => setEditing((d) => ({ ...d!, quote: e.target.value }))}
              />
            </AField>
            <div className="grid grid-cols-3 gap-4">
              <AField label="Rating (1–5)">
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={editing.rating ?? ""}
                  onChange={(e) =>
                    setEditing((d) => ({
                      ...d!,
                      rating: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                />
              </AField>
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
                      status: e.target.value as TestimonialAdmin["status"],
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
