"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  AField,
  AdminModal,
  DataTable,
  EmptyState,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
  Td,
  Th,
  selectClass,
} from "@/components/admin/kit";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import {
  releasesApi,
  type AppRelease,
  type AppReleaseInput,
} from "@/features/releases/api";

const EMPTY: AppReleaseInput = {
  app_type: "customer",
  platform: "android",
  channel: "beta",
  version: "",
  build_number: null,
  download_url: null,
  checksum_sha256: null,
  release_notes: null,
  min_supported_version: null,
  is_active: false,
};

export default function ReleasesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AppReleaseInput>(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ["releases"],
    queryFn: releasesApi.list,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["releases"] });

  const create = useMutation({
    mutationFn: (payload: AppReleaseInput) => releasesApi.create(payload),
    onSuccess: () => {
      toast.success("Release added");
      setOpen(false);
      setForm(EMPTY);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed"),
  });

  const toggle = useMutation({
    mutationFn: (r: AppRelease) => releasesApi.update(r.id, { is_active: !r.is_active }),
    onSuccess: () => {
      toast.success("Updated");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => releasesApi.remove(id),
    onSuccess: () => {
      toast.success("Deleted");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed"),
  });

  const set = <K extends keyof AppReleaseInput>(k: K, v: AppReleaseInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <PageHeader
        title="App Releases"
        description="Manage the builds shown on the public /download page. Leave the download URL empty until a real build exists — the site shows an accurate 'coming soon' state."
        actions={<Button onClick={() => setOpen(true)}>Add release</Button>}
      />

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : !data?.length ? (
        <EmptyState
          icon="app"
          title="No releases yet"
          description="Add a release for each app, platform and channel as builds become available."
        />
      ) : (
        <DataTable>
          <thead>
            <tr>
              <Th>App</Th>
              <Th>Platform</Th>
              <Th>Channel</Th>
              <Th>Version</Th>
              <Th>Download</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <Td className="capitalize">{r.app_type}</Td>
                <Td className="uppercase">{r.platform}</Td>
                <Td className="capitalize">{r.channel}</Td>
                <Td>
                  v{r.version}
                  {r.build_number != null ? ` (${r.build_number})` : ""}
                </Td>
                <Td>
                  {r.download_url ? (
                    <a
                      href={r.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-forest underline underline-offset-2"
                    >
                      link
                    </a>
                  ) : (
                    <span className="text-muted">— none</span>
                  )}
                </Td>
                <Td>
                  <StatusBadge status={r.is_active ? "active" : "inactive"} />
                </Td>
                <Td className="whitespace-nowrap text-right">
                  <button
                    onClick={() => toggle.mutate(r)}
                    disabled={toggle.isPending}
                    className="mr-3 text-sm font-medium text-forest underline underline-offset-2"
                  >
                    {r.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this release?")) remove.mutate(r.id);
                    }}
                    disabled={remove.isPending}
                    className="text-tomato"
                    aria-label="Delete release"
                  >
                    <Trash2 size={15} />
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}

      <AdminModal title="Add release" open={open} onClose={() => setOpen(false)}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AField label="App">
            <select
              className={selectClass}
              value={form.app_type}
              onChange={(e) => set("app_type", e.target.value as AppReleaseInput["app_type"])}
            >
              <option value="customer">Customer</option>
              <option value="partner">Partner</option>
            </select>
          </AField>
          <AField label="Platform">
            <select
              className={selectClass}
              value={form.platform}
              onChange={(e) => set("platform", e.target.value as AppReleaseInput["platform"])}
            >
              <option value="android">Android</option>
              <option value="ios">iOS</option>
            </select>
          </AField>
          <AField label="Channel">
            <select
              className={selectClass}
              value={form.channel}
              onChange={(e) => set("channel", e.target.value as AppReleaseInput["channel"])}
            >
              <option value="beta">Beta</option>
              <option value="production">Production</option>
            </select>
          </AField>
          <AField label="Version">
            <Input
              value={form.version}
              onChange={(e) => set("version", e.target.value)}
              placeholder="1.0.0"
            />
          </AField>
          <AField label="Build number">
            <Input
              type="number"
              value={form.build_number ?? ""}
              onChange={(e) =>
                set("build_number", e.target.value ? Number(e.target.value) : null)
              }
            />
          </AField>
          <AField label="Min supported version">
            <Input
              value={form.min_supported_version ?? ""}
              onChange={(e) => set("min_supported_version", e.target.value || null)}
              placeholder="optional"
            />
          </AField>
          <AField label="Download URL">
            <Input
              value={form.download_url ?? ""}
              onChange={(e) => set("download_url", e.target.value || null)}
              placeholder="Store / APK / TestFlight link (leave empty if not ready)"
            />
          </AField>
          <AField label="APK SHA-256 checksum">
            <Input
              value={form.checksum_sha256 ?? ""}
              onChange={(e) => set("checksum_sha256", e.target.value || null)}
              placeholder="optional"
            />
          </AField>
        </div>
        <AField label="Release notes">
          <Textarea
            value={form.release_notes ?? ""}
            onChange={(e) => set("release_notes", e.target.value || null)}
          />
        </AField>
        <label className="mt-1 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
          />
          Active (visible on the public /download page)
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate(form)}
            disabled={create.isPending || !form.version.trim()}
          >
            Save release
          </Button>
        </div>
      </AdminModal>
    </div>
  );
}
