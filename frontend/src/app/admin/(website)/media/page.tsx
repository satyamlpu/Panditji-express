"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";
import { mediaApi } from "@/features/media/api";
import { ApiError } from "@/lib/api";
import type { MediaAsset } from "@/lib/types";
import { EmptyState, PageHeader } from "@/components/admin/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaLibraryPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "media", q, page],
    queryFn: () => mediaApi.list({ q: q || undefined, page, page_size: 24 }),
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.page_size ?? 24;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "media"] });

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      if (!ACCEPT.includes(file.type)) {
        toast.error(`${file.name}: use JPG, PNG or WebP.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: must be 8 MB or smaller.`);
        continue;
      }
      setUploading(true);
      setProgress(0);
      try {
        const asset = await mediaApi.upload(file, { onProgress: setProgress });
        if (asset.warnings?.length) toast.message(asset.warnings[0]);
        toast.success(`Uploaded ${asset.filename}`);
        invalidate();
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    }
  }

  const updateAlt = useMutation({
    mutationFn: ({ id, alt }: { id: string; alt: string }) =>
      mediaApi.updateAlt(id, alt),
    onSuccess: () => {
      toast.success("Alt text saved");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Save failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => mediaApi.remove(id),
    onSuccess: () => {
      toast.success("Image deleted");
      invalidate();
    },
    onError: (e) =>
      toast.error(
        e instanceof ApiError ? e.message : "Delete failed — image may be in use.",
      ),
  });

  async function confirmDelete(asset: MediaAsset) {
    try {
      const usage = await mediaApi.usage(asset.id);
      const refs = [...usage.services, ...usage.categories];
      if (refs.length) {
        toast.error(
          `In use by: ${refs.slice(0, 3).join(", ")}${refs.length > 3 ? "…" : ""}. Replace it there first.`,
        );
        return;
      }
    } catch {
      /* fall through to attempt delete */
    }
    if (confirm(`Delete “${asset.filename}”? This cannot be undone.`)) {
      remove.mutate(asset.id);
    }
  }

  return (
    <div>
      <PageHeader
        title="Media Library"
        description="Centralised images for the website and apps — uploaded once, optimised to WebP, reused everywhere."
        actions={
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Spinner className="text-white" /> : <Upload size={16} />}
            Upload
          </Button>
        }
      />

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "mb-5 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragOver ? "border-forest bg-forest/5" : "border-line bg-surface hover:bg-surface-2",
        )}
      >
        <Upload size={22} className="text-muted" />
        <p className="text-sm font-medium text-ink">Drag &amp; drop images here, or click to browse</p>
        <p className="text-xs text-muted">JPG, PNG or WebP · up to 8 MB · auto-optimised to WebP</p>
        {uploading && (
          <div className="mt-3 w-full max-w-xs">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-forest transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="mb-4">
        <Input
          type="search"
          placeholder="Search by filename or alt text…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-80"
        />
      </div>

      {isLoading ? (
        <div className="py-16 text-center">
          <Spinner className="text-forest" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="media"
          title="No images yet"
          description="Upload your first image above. Images added here can be picked as service and category thumbnails."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((a) => (
              <MediaCard
                key={a.id}
                asset={a}
                onSaveAlt={(alt) => updateAlt.mutate({ id: a.id, alt })}
                onDelete={() => confirmDelete(a)}
              />
            ))}
          </div>
          {pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3 text-sm">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-muted">
                Page {page} of {pages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function MediaCard({
  asset,
  onSaveAlt,
  onDelete,
}: {
  asset: MediaAsset;
  onSaveAlt: (alt: string) => void;
  onDelete: () => void;
}) {
  const [alt, setAlt] = useState(asset.alt_text ?? "");
  const dirty = alt !== (asset.alt_text ?? "");
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-soft">
      <div className="aspect-video w-full overflow-hidden bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.thumb_url || asset.url}
          alt={asset.alt_text || asset.filename}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-ink" title={asset.filename}>
            {asset.filename}
          </p>
          <button
            type="button"
            onClick={onDelete}
            className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-tomato/10 hover:text-tomato"
            aria-label="Delete image"
          >
            <Trash2 size={15} />
          </button>
        </div>
        <p className="text-xs text-muted">
          {asset.width}×{asset.height} · {formatBytes(asset.byte_size)}
        </p>
        <div className="flex items-end gap-2">
          <label className="flex-1">
            <span className="mb-1 block text-[11px] font-medium text-muted">Alt text</span>
            <Input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Describe the image…"
              maxLength={300}
              className="text-sm"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!dirty}
            onClick={() => onSaveAlt(alt)}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
