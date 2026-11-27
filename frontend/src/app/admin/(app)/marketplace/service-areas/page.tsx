"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Plus, Trash2, Pencil, Navigation } from "lucide-react";
import { mpApi, type ServiceArea } from "@/features/marketplace/api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  AField,
  AdminModal,
  DataTable,
  EmptyState,
  LoadingSkeleton,
  PageHeader,
  Td,
  Th,
} from "@/components/admin/kit";
import { cn } from "@/lib/utils";

interface FormState {
  id?: string;
  name: string;
  city: string;
  center_lat: string;
  center_lng: string;
  radius_km: string;
  pincodes: string;
  notes: string;
  active: boolean;
}
const EMPTY: FormState = {
  name: "", city: "", center_lat: "", center_lng: "", radius_km: "10",
  pincodes: "", notes: "", active: true,
};

export default function ServiceAreasPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [cov, setCov] = useState({ lat: "", lng: "" });

  const list = useQuery({
    queryKey: ["mp", "service-areas"],
    queryFn: () => mpApi.serviceAreas(),
  });
  const coverage = useQuery({
    queryKey: ["mp", "coverage", cov.lat, cov.lng],
    queryFn: () => mpApi.serviceAreaCoverage(Number(cov.lat), Number(cov.lng)),
    enabled: cov.lat !== "" && cov.lng !== "" && !Number.isNaN(Number(cov.lat)) && !Number.isNaN(Number(cov.lng)),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["mp", "service-areas"] });
  const onErr = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Failed");

  const save = useMutation({
    mutationFn: () => {
      const f = form!;
      const body = {
        name: f.name.trim(),
        city: f.city.trim() || null,
        center_lat: Number(f.center_lat),
        center_lng: Number(f.center_lng),
        radius_km: Number(f.radius_km),
        pincodes: f.pincodes.split(",").map((p) => p.trim()).filter(Boolean),
        notes: f.notes.trim() || null,
        active: f.active,
      };
      return f.id ? mpApi.updateServiceArea(f.id, body) : mpApi.createServiceArea(body);
    },
    onSuccess: () => { toast.success(form?.id ? "Area updated" : "Area created"); setForm(null); invalidate(); },
    onError: onErr,
  });
  const toggle = useMutation({
    mutationFn: (a: ServiceArea) => mpApi.updateServiceArea(a.id, { active: !a.active }),
    onSuccess: () => invalidate(),
    onError: onErr,
  });
  const remove = useMutation({
    mutationFn: (id: string) => mpApi.deleteServiceArea(id),
    onSuccess: () => { toast.success("Area deleted"); invalidate(); },
    onError: onErr,
  });

  const editFrom = (a: ServiceArea): FormState => ({
    id: a.id, name: a.name, city: a.city ?? "", center_lat: String(a.center_lat),
    center_lng: String(a.center_lng), radius_km: String(a.radius_km),
    pincodes: a.pincodes.join(", "), notes: a.notes ?? "", active: a.active,
  });

  return (
    <div>
      <PageHeader
        title="Service Areas"
        description="Managed operational areas (centre + radius). A catalogue on top of per-partner radius — not yet wired into booking serviceability."
      />
      <div className="mt-4 flex justify-end">
        <Button size="sm" onClick={() => setForm({ ...EMPTY })}><Plus size={15} /> New area</Button>
      </div>

      {/* Coverage checker */}
      <div className="mt-4 rounded-card border border-line bg-surface-2 p-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <Navigation size={13} /> Coverage check
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input value={cov.lat} onChange={(e) => setCov((c) => ({ ...c, lat: e.target.value }))} placeholder="latitude" className="w-32" />
          <Input value={cov.lng} onChange={(e) => setCov((c) => ({ ...c, lng: e.target.value }))} placeholder="longitude" className="w-32" />
          {coverage.data ? (
            coverage.data.covered ? (
              <span className="text-sm text-forest">
                ✓ Covered by {coverage.data.areas.map((a) => a.name).join(", ")}
              </span>
            ) : (
              <span className="text-sm text-tomato">✗ No active area covers this point</span>
            )
          ) : (
            <span className="text-sm text-muted">Enter a point to check coverage.</span>
          )}
        </div>
      </div>

      <div className="mt-5">
        {list.isLoading ? (
          <LoadingSkeleton rows={4} />
        ) : !list.data?.length ? (
          <EmptyState icon="locations" title="No service areas yet" description="Create the first operational area to start mapping coverage." />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <Th>Area</Th>
                <Th>City</Th>
                <Th className="text-right">Radius</Th>
                <Th>Pincodes</Th>
                <Th>Active</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {list.data.map((a) => (
                <tr key={a.id} className="hover:bg-surface-2">
                  <Td>
                    <p className="font-medium text-ink">{a.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted">
                      <MapPin size={11} /> {a.center_lat.toFixed(3)}, {a.center_lng.toFixed(3)}
                    </p>
                  </Td>
                  <Td className="text-muted">{a.city ?? "—"}</Td>
                  <Td className="text-right tabular-nums">{a.radius_km} km</Td>
                  <Td className="text-muted">{a.pincodes.length ? a.pincodes.join(", ") : "—"}</Td>
                  <Td>
                    <button
                      onClick={() => toggle.mutate(a)}
                      className={cn(
                        "rounded-pill px-2.5 py-0.5 text-xs font-medium",
                        a.active ? "bg-forest/10 text-forest" : "bg-surface-2 text-muted",
                      )}
                    >
                      {a.active ? "active" : "inactive"}
                    </button>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setForm(editFrom(a))}><Pencil size={14} /></Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-tomato/40 text-tomato"
                        onClick={() => { if (confirm(`Delete "${a.name}"?`)) remove.mutate(a.id); }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </div>

      <AdminModal title={form?.id ? "Edit service area" : "New service area"} open={form !== null} onClose={() => setForm(null)}>
        {form && (
          <div className="space-y-3">
            <AField label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Kanpur Central" /></AField>
            <AField label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Kanpur" /></AField>
            <div className="grid grid-cols-3 gap-2">
              <AField label="Centre lat"><Input value={form.center_lat} onChange={(e) => setForm({ ...form, center_lat: e.target.value })} placeholder="26.45" /></AField>
              <AField label="Centre lng"><Input value={form.center_lng} onChange={(e) => setForm({ ...form, center_lng: e.target.value })} placeholder="80.33" /></AField>
              <AField label="Radius (km)"><Input value={form.radius_km} onChange={(e) => setForm({ ...form, radius_km: e.target.value })} placeholder="15" /></AField>
            </div>
            <AField label="Pincodes (comma-separated)"><Input value={form.pincodes} onChange={(e) => setForm({ ...form, pincodes: e.target.value })} placeholder="208001, 208002" /></AField>
            <AField label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></AField>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
            </label>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => save.mutate()}
                disabled={save.isPending || form.name.trim().length < 2 || !form.center_lat || !form.center_lng || Number(form.radius_km) <= 0}
              >
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}
