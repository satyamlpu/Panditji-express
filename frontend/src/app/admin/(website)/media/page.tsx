"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Trash2, Upload } from "lucide-react";
import {
  EmptyState,
  LoadingSkeleton,
  PageHeader,
} from "@/components/admin/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api";
import { mediaApi, type MediaAsset } from "@/features/media/api";

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaLibraryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["media", query],
    queryFn: () => mediaApi.list(query || undefined),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["media"] });

  async function handleFiles(files: FileList) {
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      try {
        await mediaApi.upload(file);
        ok += 1;
      } catch (e) {
        toast.error(
          `${file.name}: ${e instanceof ApiError ? e.message : "Upload failed"}`,
        );
      }
    }
    setUploading(false);
    if (ok) {
      toast.success(`${ok} image${ok > 1 ? "s" : ""} uploaded`);
      invalidate();
    }
  }

  const remove = useMutation({
    mutationFn: (id: string) => mediaApi.remove(id),
    onSuccess: () => {
      toast.success("Image deleted");
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Could not delete image"),
  });

  const items = data ?? [];

  return (
    <div>
      <PageHeader
        title="Media Library"
        description="Centralized website images, served through a cache-friendly public URL. Set alt text for accessibility and SEO; images still in use are protected from deletion."
        actions={
          <Button
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Spinner className="text-forest" /> : <Upload size={15} />}
            Upload images
          </Button>
        }
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <form
        className="mb-4 flex max-w-sm items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
        }}
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search filename or alt text…"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="media"
          title={query ? "No matching images" : "No images yet"}
          description={
            query
              ? "Try a different search term, or clear the search."
              : "Upload PNG, JPEG, WEBP or GIF images (max 3 MB each). They'll be available to use across the website."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((m) => (
            <MediaCard
              key={m.id}
              asset={m}
              onDelete={() => {
                if (
                  window.confirm(
                    `Delete "${m.filename}"? This cannot be undone.`,
                  )
                ) {
                  remove.mutate(m.id);
                }
              }}
              onSavedAlt={invalidate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MediaCard({
  asset,
  onDelete,
  onSavedAlt,
}: {
  asset: MediaAsset;
  onDelete: () => void;
  onSavedAlt: () => void;
}) {
  const [alt, setAlt] = useState(asset.alt_text ?? "");

  const saveAlt = useMutation({
    mutationFn: (value: string) => mediaApi.updateAlt(asset.id, value || null),
    onSuccess: () => {
      toast.success("Alt text saved");
      onSavedAlt();
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Could not save alt text"),
  });

  const dirty = (asset.alt_text ?? "") !== alt;

  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
      <div className="aspect-[4/3] w-full overflow-hidden bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.url}
          alt={asset.alt_text ?? asset.filename}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink" title={asset.filename}>
            {asset.filename}
          </p>
          <p className="text-xs text-muted">
            {prettySize(asset.size_bytes)} ·{" "}
            {new Date(asset.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-end gap-1.5">
          <Input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Alt text…"
            className="text-xs"
          />
          {dirty && (
            <Button
              variant="outline"
              onClick={() => saveAlt.mutate(alt)}
              disabled={saveAlt.isPending}
              className="shrink-0"
            >
              Save
            </Button>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard
                .writeText(asset.url)
                .then(() => toast.success("URL copied"))
                .catch(() => toast.error("Could not copy"));
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-ink"
          >
            <Copy size={13} /> Copy URL
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-tomato hover:bg-tomato/10"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}
