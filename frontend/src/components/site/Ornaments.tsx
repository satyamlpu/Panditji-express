import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Decorative line-art mandala, drawn from concentric rings of petals. Uses
 * `currentColor`, so set the colour and opacity via Tailwind text utilities on
 * the wrapper (e.g. `text-gold opacity-10`). Purely decorative → aria-hidden.
 */
export function Mandala({
  className,
  petals = 16,
  inner = 12,
}: {
  className?: string;
  petals?: number;
  inner?: number;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="0.6"
      aria-hidden
    >
      <circle cx="100" cy="100" r="96" />
      <circle cx="100" cy="100" r="80" />
      <circle cx="100" cy="100" r="58" />
      <circle cx="100" cy="100" r="36" />
      {Array.from({ length: petals }).map((_, i) => {
        const a = (360 / petals) * i;
        return (
          <g key={`o${i}`} transform={`rotate(${a} 100 100)`}>
            <path d="M100 4 C114 34 114 56 100 80 C86 56 86 34 100 4 Z" />
            <circle cx="100" cy="16" r="2.4" />
          </g>
        );
      })}
      {Array.from({ length: inner }).map((_, i) => {
        const a = (360 / inner) * i + 360 / inner / 2;
        return (
          <g key={`i${i}`} transform={`rotate(${a} 100 100)`}>
            <path d="M100 40 C108 52 108 66 100 80 C92 66 92 52 100 40 Z" />
          </g>
        );
      })}
      <circle cx="100" cy="100" r="16" />
      <circle cx="100" cy="100" r="7" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** A small lotus-diamond motif used as the centre of dividers and accents. */
function Lotus({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      aria-hidden
    >
      <path d="M24 6 C30 16 30 24 24 34 C18 24 18 16 24 6 Z" />
      <path d="M8 20 C18 20 22 26 24 34 C16 34 10 30 8 20 Z" />
      <path d="M40 20 C30 20 26 26 24 34 C32 34 38 30 40 20 Z" />
      <circle cx="24" cy="26" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Gold ornamental divider: a fading rule with a central lotus motif. */
export function OrnamentDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center justify-center gap-3 text-gold", className)}
      aria-hidden
    >
      <span className="h-px w-16 bg-gradient-to-l from-current to-transparent sm:w-24" />
      <span className="h-1.5 w-1.5 rotate-45 bg-gold/70" />
      <Lotus className="h-6 w-6" />
      <span className="h-1.5 w-1.5 rotate-45 bg-gold/70" />
      <span className="h-px w-16 bg-gradient-to-r from-current to-transparent sm:w-24" />
    </div>
  );
}

/** Centered section heading with ornamental eyebrow. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  tone = "dark",
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  tone?: "dark" | "light";
  className?: string;
}) {
  const titleColor = tone === "light" ? "text-white" : "text-ink";
  const subColor = tone === "light" ? "text-white/80" : "text-muted";
  return (
    <div className={cn("text-center", className)}>
      {eyebrow && (
        <p className="mb-3 flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-gold">
          <span className="h-px w-8 bg-gold/60" aria-hidden />
          {eyebrow}
          <span className="h-px w-8 bg-gold/60" aria-hidden />
        </p>
      )}
      <h2 className={cn("font-display text-3xl font-bold md:text-4xl", titleColor)}>
        {title}
      </h2>
      {subtitle && (
        <p className={cn("mx-auto mt-3 max-w-xl", subColor)}>{subtitle}</p>
      )}
    </div>
  );
}

/** A thin decorative gold corner used on premium image frames. */
export function GoldCorner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("text-gold", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M2 14 V2 H14" />
      <path d="M7 20 C7 12 12 7 20 7" strokeWidth="1" />
    </svg>
  );
}

/** Wraps an image in a premium gold frame with a subtle arch top option. */
export function OrnateFrame({
  children,
  arch = false,
  className,
}: {
  children: ReactNode;
  arch?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-[26px] border border-gold/40 bg-surface p-1.5 shadow-soft-lg",
        arch && "rounded-t-full",
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-[20px]",
          arch && "rounded-t-full",
        )}
      >
        {children}
      </div>
    </div>
  );
}
