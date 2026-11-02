"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api";
import { categoriesApi, servicesApi } from "@/features/services/api";
import type { ServiceAdmin } from "@/lib/types";

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const schema = z.object({
  title: z.string().min(2, "Title is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(slugRe, "Use lowercase letters, numbers and hyphens only"),
  summary: z.string().max(400).optional(),
  description: z.string().optional(),
  price_rupees: z
    .union([z.coerce.number().int().min(0), z.literal("")])
    .optional(),
  duration_label: z.string().max(60).optional(),
  inclusions: z.string().optional(),
  samagri: z.string().optional(),
  category_id: z.string().optional(),
  is_featured: z.boolean().optional(),
  status: z.enum(["draft", "published", "unpublished"]),
  seo_title: z.string().max(70).optional(),
  seo_description: z.string().max(320).optional(),
});

type Values = z.infer<typeof schema>;

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function linesToArray(text?: string): string[] {
  return (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function ServiceForm({ initial }: { initial?: ServiceAdmin }) {
  const router = useRouter();
  const qc = useQueryClient();
  const isEdit = Boolean(initial);
  const [slugTouched, setSlugTouched] = useState(isEdit);

  const categories = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => categoriesApi.list(),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initial?.title ?? "",
      slug: initial?.slug ?? "",
      summary: initial?.summary ?? "",
      description: initial?.description ?? "",
      price_rupees: initial?.price_rupees ?? "",
      duration_label: initial?.duration_label ?? "",
      inclusions: (initial?.inclusions ?? []).join("\n"),
      samagri: (initial?.samagri ?? []).join("\n"),
      category_id: initial?.category?.id ?? "",
      is_featured: initial?.is_featured ?? false,
      status: (initial?.status as Values["status"]) ?? "draft",
      seo_title: initial?.seo_title ?? "",
      seo_description: initial?.seo_description ?? "",
    },
  });

  const values = watch();

  // Auto-derive slug from title until the editor edits the slug themselves.
  useEffect(() => {
    if (!slugTouched && values.title) {
      setValue("slug", slugify(values.title));
    }
  }, [values.title, slugTouched, setValue]);

  async function onSubmit(v: Values) {
    const payload = {
      title: v.title,
      slug: v.slug,
      summary: v.summary || null,
      description: v.description || null,
      price_rupees: v.price_rupees === "" || v.price_rupees == null ? null : Number(v.price_rupees),
      duration_label: v.duration_label || null,
      inclusions: linesToArray(v.inclusions),
      samagri: linesToArray(v.samagri),
      category_id: v.category_id || null,
      is_featured: Boolean(v.is_featured),
      status: v.status,
      seo_title: v.seo_title || null,
      seo_description: v.seo_description || null,
    };

    try {
      if (isEdit && initial) {
        await servicesApi.update(initial.id, payload);
        toast.success("Service saved");
      } else {
        await servicesApi.create(payload);
        toast.success("Service created");
      }
      await qc.invalidateQueries({ queryKey: ["admin", "services"] });
      router.push("/admin/services");
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        toast.error(e.message);
      } else {
        toast.error("Save failed");
      }
    }
  }

  const priceDisplay =
    values.price_rupees === "" || values.price_rupees == null
      ? "On request"
      : `₹${Number(values.price_rupees).toLocaleString("en-IN")}`;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <Section title="Basics">
          <L label="Title" error={errors.title?.message} required>
            <Input {...register("title")} placeholder="e.g. Satyanarayan Katha" />
          </L>
          <L
            label="Slug"
            error={errors.slug?.message}
            required
            hint="The URL: /puja-services/<slug>"
          >
            <Input
              {...register("slug")}
              onChange={(e) => {
                setSlugTouched(true);
                register("slug").onChange(e);
              }}
              placeholder="satyanarayan-katha"
            />
          </L>
          <L label="Summary" error={errors.summary?.message} hint="One line shown on cards and search results">
            <Input {...register("summary")} placeholder="Short one-line description" />
          </L>
          <L label="Full description" error={errors.description?.message}>
            <Textarea {...register("description")} className="min-h-32" placeholder="Describe the puja…" />
          </L>
        </Section>

        <Section title="Pricing & details">
          <div className="grid gap-4 sm:grid-cols-2">
            <L label="Price (₹)" error={typeof errors.price_rupees?.message === "string" ? errors.price_rupees?.message : undefined} hint="Leave blank for ‘On request’">
              <Input {...register("price_rupees")} type="number" min={0} placeholder="2100" />
            </L>
            <L label="Duration" error={errors.duration_label?.message}>
              <Input {...register("duration_label")} placeholder="2–3 hours" />
            </L>
          </div>
          <L label="Inclusions" hint="One item per line">
            <Textarea {...register("inclusions")} placeholder={"Experienced pandit\nFull vidhi & katha\nAarti & prasad"} />
          </L>
          <L label="Samagri" hint="One item per line">
            <Textarea {...register("samagri")} placeholder={"Complete samagri kit\nFlowers & fruits"} />
          </L>
        </Section>

        <Section title="Organise & publish">
          <div className="grid gap-4 sm:grid-cols-2">
            <L label="Category">
              <select
                {...register("category_id")}
                className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm"
              >
                <option value="">— None —</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </L>
            <L label="Status">
              <select
                {...register("status")}
                className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="unpublished">Unpublished</option>
              </select>
            </L>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" {...register("is_featured")} className="h-4 w-4 accent-[color:var(--forest)]" />
            Feature on the homepage
          </label>
        </Section>

        <Section title="SEO">
          <L label="SEO title" error={errors.seo_title?.message} hint="Falls back to the title if blank">
            <Input {...register("seo_title")} placeholder="Leave blank to auto-generate" />
          </L>
          <L label="Meta description" error={errors.seo_description?.message} hint="~150–160 characters">
            <Textarea {...register("seo_description")} placeholder="Falls back to the summary if blank" />
          </L>
        </Section>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : isEdit ? "Save changes" : "Create service"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/services")}
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Live preview */}
      <aside className="lg:sticky lg:top-8">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <Eye size={14} /> Live preview
        </div>
        <div className="rounded-card border border-line bg-surface p-5 shadow-soft">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-lg font-semibold text-ink">
              {values.title || "Service title"}
            </h3>
            {values.is_featured && <Badge tone="sun">Popular</Badge>}
          </div>
          {values.summary && <p className="mt-2 text-sm text-muted">{values.summary}</p>}
          <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
            <div>
              <p className="font-display text-xl font-bold text-forest">{priceDisplay}</p>
              {values.duration_label && (
                <p className="text-xs text-muted">{values.duration_label}</p>
              )}
            </div>
            <Badge tone={values.status === "published" ? "forest" : "draft"}>
              {values.status}
            </Badge>
          </div>
        </div>

        <div className="mt-4 rounded-card border border-line bg-surface p-5 shadow-soft">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Search result preview
          </p>
          <p className="truncate text-xs text-kiwi">
            panditjiexpress.in › puja-services › {values.slug || "slug"}
          </p>
          <p className="mt-0.5 font-display text-base font-medium text-[#1a0dab]">
            {values.seo_title || values.title || "Service title"} | Pandit Ji Express
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted">
            {values.seo_description || values.summary || "Add a summary or meta description."}
          </p>
        </div>
      </aside>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-soft">
      <h2 className="mb-4 font-display text-base font-semibold text-ink">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function L({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-ink">
          {label}
          {required && <span className="text-tomato"> *</span>}
        </span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-tomato">{error}</span>}
    </label>
  );
}
