"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { settingsApi } from "@/features/content/api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { AField } from "@/components/admin/kit";

type Dict = Record<string, unknown>;

export default function AdminSettingsPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => settingsApi.all(),
  });

  const [site, setSite] = useState<Dict>({});
  const [contact, setContact] = useState<Dict>({});
  const [social, setSocial] = useState<Dict>({});
  const [seo, setSeo] = useState<Dict>({});
  const [navJson, setNavJson] = useState("[]");
  const [footerJson, setFooterJson] = useState("{}");

  useEffect(() => {
    if (!data) return;
    setSite((data.site as Dict) ?? {});
    setContact((data.contact as Dict) ?? {});
    setSocial((data.social as Dict) ?? {});
    setSeo((data.seo_defaults as Dict) ?? {});
    setNavJson(JSON.stringify(data.nav ?? [], null, 2));
    setFooterJson(JSON.stringify(data.footer ?? {}, null, 2));
  }, [data]);

  async function save(key: string, value: unknown) {
    try {
      await settingsApi.set(key, value);
      toast.success("Saved");
      refetch();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Save failed");
    }
  }

  async function saveJson(key: string, raw: string) {
    try {
      const parsed = JSON.parse(raw);
      await save(key, parsed);
    } catch {
      toast.error("Invalid JSON — please check the formatting.");
    }
  }

  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <Spinner className="text-forest" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-ink">Settings</h1>
      <p className="mt-1 text-sm text-muted">
        Site identity, contact details, social links, SEO defaults, navigation
        and footer.
      </p>

      <Section title="Site">
        <AField label="Site name">
          <Input
            value={(site.name as string) ?? ""}
            onChange={(e) => setSite((s) => ({ ...s, name: e.target.value }))}
          />
        </AField>
        <AField label="Tagline">
          <Input
            value={(site.tagline as string) ?? ""}
            onChange={(e) => setSite((s) => ({ ...s, tagline: e.target.value }))}
          />
        </AField>
        <SaveBtn onClick={() => save("site", site)} />
      </Section>

      <Section title="Contact">
        {["phone", "whatsapp", "email", "hours"].map((k) => (
          <AField key={k} label={k[0].toUpperCase() + k.slice(1)}>
            <Input
              value={(contact[k] as string) ?? ""}
              onChange={(e) => setContact((c) => ({ ...c, [k]: e.target.value }))}
            />
          </AField>
        ))}
        <SaveBtn onClick={() => save("contact", contact)} />
      </Section>

      <Section title="Social links">
        {["facebook", "instagram", "youtube"].map((k) => (
          <AField key={k} label={k[0].toUpperCase() + k.slice(1)}>
            <Input
              value={(social[k] as string) ?? ""}
              onChange={(e) => setSocial((s) => ({ ...s, [k]: e.target.value }))}
            />
          </AField>
        ))}
        <SaveBtn onClick={() => save("social", social)} />
      </Section>

      <Section title="SEO defaults">
        <AField label="Title suffix" hint="e.g. | Pandit Ji Express">
          <Input
            value={(seo.title_suffix as string) ?? ""}
            onChange={(e) => setSeo((s) => ({ ...s, title_suffix: e.target.value }))}
          />
        </AField>
        <AField label="Default description">
          <Textarea
            value={(seo.default_description as string) ?? ""}
            onChange={(e) =>
              setSeo((s) => ({ ...s, default_description: e.target.value }))
            }
          />
        </AField>
        <SaveBtn onClick={() => save("seo_defaults", seo)} />
      </Section>

      <Section title="Navigation (JSON)">
        <AField label="Primary nav" hint='[{"label":"Pujas","href":"/puja-services"}]'>
          <Textarea
            className="min-h-40 font-mono text-xs"
            value={navJson}
            onChange={(e) => setNavJson(e.target.value)}
          />
        </AField>
        <SaveBtn onClick={() => saveJson("nav", navJson)} />
      </Section>

      <Section title="Footer (JSON)">
        <AField label="Footer columns" hint='{"columns":[{"title":"…","links":[…]}]}'>
          <Textarea
            className="min-h-40 font-mono text-xs"
            value={footerJson}
            onChange={(e) => setFooterJson(e.target.value)}
          />
        </AField>
        <SaveBtn onClick={() => saveJson("footer", footerJson)} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 rounded-card border border-line bg-surface p-5 shadow-soft">
      <h2 className="mb-4 font-display text-base font-semibold text-ink">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SaveBtn({ onClick }: { onClick: () => void }) {
  return (
    <div className="pt-1">
      <Button type="button" size="sm" onClick={onClick}>
        Save
      </Button>
    </div>
  );
}
