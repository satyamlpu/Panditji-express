"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ImagePlus,
  Library,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { mediaApi } from "@/features/media/api";
import { ApiError } from "@/lib/api";
import type { MediaAsset } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;
const TARGET_W = 1280;
const TARGET_H = 720; // 16:9

export interface ThumbnailValue {
  mediaId: string | null;
  previewUrl: string | null;
  alt: string;
}

/**
 * Professional thumbnail manager for services & categories. Supports:
 * upload from device, drag-and-drop, pick-from-Media-Library, crop & reposition
 * to 16:9, preview, replace, remove, alt text, upload progress, and client-side
 * type/size validation. The cropped image is sent to the Media Library, which
 * re-optimises it to WebP display/thumb variants (originals preserved there).
 */
export function MediaPicker({
  value,
  onChange,
  label = "Thumbnail",
}: {
  value: ThumbnailValue;
  onChange: (next: ThumbnailValue) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function validate(file: File): string | null {
    if (!ACCEPT.includes(file.type)) return "Use a JPG, PNG or WebP image.";
    if (file.size > MAX_BYTES) return "Image must be 8 MB or smaller.";
    return null;
  }

  function pickFile(file: File | undefined) {
    if (!file) return;
    const err = validate(file);
    if (err) {
      toast.error(err);
      return;
    }
    setCropFile(file);
  }

  function selectAsset(asset: MediaAsset) {
    onChange({
      mediaId: asset.id,
      previewUrl: asset.url,
      alt: value.alt || asset.alt_text || "",
    });
    setLibraryOpen(false);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="text-xs text-muted">16:9 · min 1280×720 · JPG/PNG/WebP</span>
      </div>

      {/* Preview + dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pickFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "relative overflow-hidden rounded-card border bg-surface-2 transition-colors",
          dragOver ? "border-forest ring-2 ring-forest/20" : "border-line",
        )}
      >
        <div className="aspect-video w-full">
          {value.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value.previewUrl}
              alt={value.alt || "Thumbnail preview"}
              className="h-full w-full object-cover"
            />
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted hover:text-forest"
            >
              <ImagePlus size={28} />
              <span className="text-sm font-medium">
                Drag an image here, or click to upload
              </span>
              <span className="text-xs text-muted/80">
                A neutral placeholder shows on the site until you add one
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={15} /> {value.previewUrl ? "Replace" : "Upload"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLibraryOpen(true)}
        >
          <Library size={15} /> Choose from library
        </Button>
        {value.previewUrl && (
          <button
            type="button"
            onClick={() => onChange({ mediaId: null, previewUrl: null, alt: "" })}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-tomato hover:bg-tomato/10"
          >
            <Trash2 size={14} /> Remove
          </button>
        )}
      </div>

      {/* Alt text */}
      {value.previewUrl && (
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-muted">
            Alt text (for accessibility &amp; SEO)
          </span>
          <Input
            value={value.alt}
            onChange={(e) => onChange({ ...value, alt: e.target.value })}
            placeholder="e.g. Priest performing Ganesh puja with brass thali"
            maxLength={300}
          />
        </label>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        className="hidden"
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {cropFile && (
        <CropModal
          file={cropFile}
          onClose={() => setCropFile(null)}
          onDone={(asset) => {
            setCropFile(null);
            onChange({
              mediaId: asset.id,
              previewUrl: asset.url,
              alt: value.alt || asset.alt_text || "",
            });
          }}
        />
      )}

      {libraryOpen && (
        <LibraryModal
          onClose={() => setLibraryOpen(false)}
          onSelect={selectAsset}
        />
      )}
    </div>
  );
}

/* ── Crop & reposition modal ──────────────────────────────────────────────── */

function CropModal({
  file,
  onClose,
  onDone,
}: {
  file: File;
  onClose: () => void;
  onDone: (asset: MediaAsset) => void;
}) {
  const [imgUrl, setImgUrl] = useState<string>("");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Base (cover) scale so the image fills the 16:9 frame at scale=1.
  const frameW = 480;
  const frameH = 270;
  const baseScale = img
    ? Math.max(frameW / img.width, frameH / img.height)
    : 1;

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setOffset({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  async function confirm() {
    if (!img) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = TARGET_W;
      canvas.height = TARGET_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unsupported");
      ctx.imageSmoothingQuality = "high";
      // Map the on-screen frame transform to the target canvas.
      const eff = baseScale * scale;
      const drawW = img.width * eff;
      const drawH = img.height * eff;
      // Top-left of the image within the frame, then scale frame→canvas.
      const fx = (frameW - drawW) / 2 + offset.x;
      const fy = (frameH - drawH) / 2 + offset.y;
      const k = TARGET_W / frameW;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, TARGET_W, TARGET_H);
      ctx.drawImage(img, fx * k, fy * k, drawW * k, drawH * k);
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob(
          (b) => (b ? res(b) : rej(new Error("Export failed"))),
          "image/webp",
          0.9,
        ),
      );
      const cropped = new File([blob], file.name.replace(/\.\w+$/, ".webp"), {
        type: "image/webp",
      });
      const asset = await mediaApi.upload(cropped, {
        onProgress: setProgress,
      });
      if (asset.warnings?.length) toast.message(asset.warnings[0]);
      toast.success("Image uploaded");
      onDone(asset);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Crop image"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-card border border-line bg-surface shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-display text-lg font-semibold text-ink">
            Crop &amp; reposition
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted hover:bg-surface-2"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">
          <p className="mb-3 text-xs text-muted">
            Drag to reposition, use the slider to zoom. The image is cropped to a
            16:9 frame.
          </p>
          <div
            ref={frameRef}
            className="relative mx-auto touch-none overflow-hidden rounded-xl border border-line bg-surface-2"
            style={{ width: frameW, height: frameH, cursor: "grab" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgUrl}
                alt="To crop"
                draggable={false}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: img.width * baseScale * scale,
                  height: img.height * baseScale * scale,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  maxWidth: "none",
                }}
              />
            )}
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/10" />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs text-muted">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="flex-1 accent-[var(--kumkum)]"
            />
            <button
              type="button"
              onClick={() => {
                setScale(1);
                setOffset({ x: 0, y: 0 });
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:text-ink"
            >
              <RotateCcw size={13} /> Reset
            </button>
          </div>
          {busy && (
            <div className="mt-4">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full bg-forest transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted">Uploading… {progress}%</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={confirm} disabled={busy || !img}>
            {busy ? <Spinner className="text-white" /> : <Check size={15} />}
            Use image
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Media Library picker modal ───────────────────────────────────────────── */

function LibraryModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
}) {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "media", "picker", q],
    queryFn: () => mediaApi.list({ q: q || undefined, page_size: 36 }),
  });
  const items = data?.items ?? [];

  const onKey = useCallback(
    (e: KeyboardEvent) => e.key === "Escape" && onClose(),
    [onClose],
  );
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink/50 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Media Library"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-card border border-line bg-surface shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="font-display text-lg font-semibold text-ink">
            Choose from Media Library
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted hover:bg-surface-2"
          >
            <X size={18} />
          </button>
        </div>
        <div className="border-b border-line px-5 py-3">
          <Input
            type="search"
            placeholder="Search by filename or alt text…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-5">
          {isLoading ? (
            <div className="py-12 text-center">
              <Spinner className="text-forest" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted">
              No images yet. Upload one with the Upload button.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelect(a)}
                  className="group overflow-hidden rounded-xl border border-line bg-surface-2 text-left hover:border-forest hover:ring-2 hover:ring-forest/20"
                >
                  <div className="aspect-video w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.thumb_url || a.url}
                      alt={a.alt_text || a.filename}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  <p className="truncate px-2 py-1.5 text-xs text-muted" title={a.filename}>
                    {a.filename}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
