"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AField, LoadingSkeleton, PageHeader } from "@/components/admin/kit";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { seoApi, type SeoSettings } from "@/features/seo/api";

export default function SeoPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["seo"], queryFn: seoApi.get });

  const [form, setForm] = useState<SeoSettings>({});
  const [sameAs, setSameAs] = useState("");

  useEffect(() => {
    if (data) {
      setForm(data);
      setSameAs((data.organization?.same_as ?? []).join(", "));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (value: SeoSettings) => seoApi.save(value),
    onSuccess: () => {
      toast.success("SEO settings saved");
      qc.invalidateQueries({ queryKey: ["seo"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed"),
  });

  const onSave = () => {
    const sameAsList = sameAs
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    save.mutate({
      title_suffix: form.title_suffix || undefined,
      default_description: form.default_description || undefined,
      default_og_image: form.default_og_image || undefined,
      noindex: form.noindex ?? false,
      organization: {
        name: form.organization?.name || undefined,
        logo_url: form.organization?.logo_url || undefined,
        phone: form.organization?.phone || undefined,
        same_as: sameAsList.length ? sameAsList : undefined,
      },
    });
  };

  const setOrg = (k: string, v: string) =>
    setForm((f) => ({ ...f, organization: { ...f.organization, [k]: v } }));

  return (
    <div>
      <PageHeader
        title="SEO"
        description="Site-wide search defaults, social preview image, Organization structured data, and a global no-index switch for pre-launch. Per-page titles and canonicals still override these."
      />
      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <div className="max-w-2xl space-y-4 rounded-card border border-line bg-surface p-5">
          <AField label="Title suffix (appended to page titles)">
            <Input
              value={form.title_suffix ?? ""}
              onChange={(e) => setForm({ ...form, title_suffix: e.target.value })}
              placeholder="· Pandit Ji Express"
            />
          </AField>
          <AField label="Default meta description">
            <Textarea
              value={form.default_description ?? ""}
              onChange={(e) => setForm({ ...form, default_description: e.target.value })}
            />
          </AField>
          <AField label="Default social (OG) image URL">
            <Input
              value={form.default_og_image ?? ""}
              onChange={(e) => setForm({ ...form, default_og_image: e.target.value })}
              placeholder="https://…/og.png"
            />
          </AField>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.noindex ?? false}
              onChange={(e) => setForm({ ...form, noindex: e.target.checked })}
            />
            Discourage search engines (no-index the whole site — use before launch)
          </label>

          <div className="border-t border-line pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Organization (structured data)
            </p>
            <div className="space-y-3">
              <AField label="Name">
                <Input
                  value={form.organization?.name ?? ""}
                  onChange={(e) => setOrg("name", e.target.value)}
                  placeholder="Pandit Ji Express"
                />
              </AField>
              <AField label="Logo URL">
                <Input
                  value={form.organization?.logo_url ?? ""}
                  onChange={(e) => setOrg("logo_url", e.target.value)}
                />
              </AField>
              <AField label="Phone">
                <Input
                  value={form.organization?.phone ?? ""}
                  onChange={(e) => setOrg("phone", e.target.value)}
                />
              </AField>
              <AField label="Social / sameAs URLs (comma-separated)">
                <Input
                  value={sameAs}
                  onChange={(e) => setSameAs(e.target.value)}
                  placeholder="https://facebook.com/…, https://instagram.com/…"
                />
              </AField>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={onSave} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save SEO settings"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
