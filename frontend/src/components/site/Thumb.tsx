import { Mandala } from "@/components/site/Ornaments";
import type { Thumbnail } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Public thumbnail renderer with a professionally designed neutral placeholder.
 * When a service/category has no image we show a subtle brand-tinted panel with
 * a mandala ornament — never an emoji, never a broken image.
 */
export function Thumb({
  thumbnail,
  alt,
  className,
  rounded = "rounded-card",
}: {
  thumbnail: Thumbnail | null | undefined;
  alt: string;
  className?: string;
  rounded?: string;
}) {
  const url = thumbnail?.url;
  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden bg-surface-2",
        rounded,
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={thumbnail?.alt || alt}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--kumkum)]/10 via-surface-2 to-[var(--gold)]/15"
        >
          <Mandala className="h-20 w-20 text-[var(--kumkum)] opacity-20" />
        </div>
      )}
    </div>
  );
}
