import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "neutral" | "sun" | "forest" | "draft" | "unpublished";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink border-line",
  sun: "bg-sunshine/25 text-[#7a5a00] border-sunshine/40",
  forest: "bg-forest/10 text-forest border-forest/20",
  draft: "bg-sunshine/25 text-[#7a5a00] border-sunshine/40",
  unpublished: "bg-surface-2 text-muted border-line",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
