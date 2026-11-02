"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { locationsApi, type LocationAdmin } from "@/features/content/api";
import { servicesApi } from "@/features/services/api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { AField, AdminModal, selectClass, StatusDot } from "@/components/admin/kit";

type Draft = Partial<LocationAdmin>;

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function AdminLocationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "locations"],
    queryFn: () => locationsApi.list(),
  });
  const services = useQuery({
    queryKey: ["admin", "services", "all"],
    queryFn: () => servicesApi.list({}),
  });
  const [editing, setEditing] = useState<Draft | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "locations"] });

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const serviceIds = d.service_ids ?? [];
      const payload = { ...d, slug: d.slug || slugify(d.city ?? "") };
      const saved = d.id
        ? await locationsApi.update(d.id, payload)
        : await locationsApi.create(payload);
      await locationsApi.setServices(saved.id, serviceIds);
      return saved;
    },
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Save failed"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => locationsApi.remove(id),
    onSuccess: () => {
      toast.success("Deleted");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Delete failed"),
  });

  function toggleService(id: string) {
    setEditing((d) => {
      const set = new Set(d!.service_ids ?? []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...d!, service_ids: [...set] };
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Locations</h1>
          <p className="mt-1 text-sm text-muted">
            Verified service areas and which pujas are available in each.
          </p>
        </div>
        <Button
          onClick={() =>
            setEditing({ status: "draft", sort_order: 0, service_ids: [] })
          }
        >
          <Plus size={16} /> New location
        </Button>
      </div>

      <div className="mt-5 overflow-hidden rounded-card border border-line bg-surface">
        {isLoading ? (
          <div className="py-16 text-center">
            <Spinner className="text-forest" />
          </div>
        ) : !data?.length ? (
          <p className="py-16 text-center text-sm text-muted">No locations yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-ink">
                    {l.city}{" "}
                    <span className="text-xs text-muted">
                      · {l.service_ids.length} pujas
                    </span>
                  </p>
                  <p className="text-xs text-muted">
                    {l.region ? `${l.region} · ` : ""}/{l.slug}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusDot status={l.status} />
                  <button
                    onClick={() => setEditing(l)}
                    className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-forest"
                    aria-label="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => confirm(`Delete “${l.city}”?`) && remove.mutate(l.id)}
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
        title={editing?.id ? "Edit location" : "New location"}
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
              <AField label="City" required>
                <Input
                  value={editing.city ?? ""}
                  onChange={(e) =>
                    setEditing((d) => ({
                      ...d!,
                      city: e.target.value,
                      slug: d!.id ? d!.slug : slugify(e.target.value),
                    }))
                  }
                />
              </AField>
              <AField label="Region">
                <Input
                  value={editing.region ?? ""}
                  onChange={(e) => setEditing((d) => ({ ...d!, region: e.target.value }))}
                />
              </AField>
            </div>
            <AField label="Slug" required hint="/locations/<slug>">
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

            <AField label="Available pujas">
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-line p-3">
                {services.data?.items.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 text-sm text-ink"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[color:var(--forest)]"
                      checked={(editing.service_ids ?? []).includes(s.id)}
                      onChange={() => toggleService(s.id)}
                    />
                    {s.title}
                  </label>
                ))}
                {!services.data?.items.length && (
                  <p className="text-sm text-muted">No services to assign.</p>
                )}
              </div>
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
                      status: e.target.value as LocationAdmin["status"],
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
