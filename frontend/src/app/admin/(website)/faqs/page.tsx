"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { faqsApi, type FaqAdmin } from "@/features/content/api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { AField, AdminModal, selectClass, StatusDot } from "@/components/admin/kit";

type Draft = Partial<FaqAdmin>;

export default function AdminFaqsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "faqs"],
    queryFn: () => faqsApi.list(),
  });
  const [editing, setEditing] = useState<Draft | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "faqs"] });

  const save = useMutation({
    mutationFn: (d: Draft) => (d.id ? faqsApi.update(d.id, d) : faqsApi.create(d)),
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Save failed"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => faqsApi.remove(id),
    onSuccess: () => {
      toast.success("Deleted");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Delete failed"),
  });

  // Only global FAQs (not attached to a service) are managed on this page.
  const globalFaqs = (data ?? []).filter((f) => !f.service_id);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">FAQs</h1>
          <p className="mt-1 text-sm text-muted">
            Site-wide questions shown on the FAQs page, grouped by topic.
          </p>
        </div>
        <Button onClick={() => setEditing({ status: "published", sort_order: 0 })}>
          <Plus size={16} /> New FAQ
        </Button>
      </div>

      <div className="mt-5 overflow-hidden rounded-card border border-line bg-surface">
        {isLoading ? (
          <div className="py-16 text-center">
            <Spinner className="text-forest" />
          </div>
        ) : !globalFaqs.length ? (
          <p className="py-16 text-center text-sm text-muted">No FAQs yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {globalFaqs.map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{f.question}</p>
                  <p className="line-clamp-1 text-sm text-muted">{f.answer}</p>
                  {f.topic && (
                    <p className="mt-0.5 text-xs text-kiwi">{f.topic}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusDot status={f.status} />
                  <button
                    onClick={() => setEditing(f)}
                    className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-forest"
                    aria-label="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => confirm("Delete this FAQ?") && remove.mutate(f.id)}
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
        title={editing?.id ? "Edit FAQ" : "New FAQ"}
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
            <AField label="Question" required>
              <Input
                value={editing.question ?? ""}
                onChange={(e) =>
                  setEditing((d) => ({ ...d!, question: e.target.value }))
                }
              />
            </AField>
            <AField label="Answer" required>
              <Textarea
                value={editing.answer ?? ""}
                onChange={(e) => setEditing((d) => ({ ...d!, answer: e.target.value }))}
              />
            </AField>
            <div className="grid grid-cols-3 gap-4">
              <AField label="Topic" hint="Groups FAQs">
                <Input
                  value={editing.topic ?? ""}
                  onChange={(e) => setEditing((d) => ({ ...d!, topic: e.target.value }))}
                  placeholder="Booking"
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
                  value={editing.status ?? "published"}
                  onChange={(e) =>
                    setEditing((d) => ({
                      ...d!,
                      status: e.target.value as FaqAdmin["status"],
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
