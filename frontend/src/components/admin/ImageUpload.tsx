"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

/** Uploads an image to the backend (via the BFF) and returns its URL.
 * Accepts PNG/JPEG/WEBP/GIF up to 3 MB (enforced server-side too). */
export function ImageUpload({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/backend/api/v1/admin/media", {
        method: "POST",
        body: fd, // let the browser set the multipart boundary
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "Upload failed");
      }
      onChange(data.url as string);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-2">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Preview" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted">
            <ImagePlus size={18} />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-2 disabled:opacity-50"
          >
            {busy ? <Spinner className="text-forest" /> : <ImagePlus size={15} />}
            {value ? "Replace" : "Upload image"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-tomato hover:bg-tomato/10"
            >
              <X size={14} /> Remove
            </button>
          )}
        </div>
        <p className="text-xs text-muted">PNG, JPEG, WEBP or GIF · max 3 MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
