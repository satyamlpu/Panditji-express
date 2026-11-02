"use client";

import { type ReactNode, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icons";

/** A simple centered modal for admin create/edit forms. */
export function AdminModal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-card border border-line bg-surface shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted hover:bg-surface-2"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/** Labelled form field wrapper. */
export function AField({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
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

export const selectClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink focus-visible:outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-forest/20";

/* ── Status pills ──────────────────────────────────────────────────────── */

/** Legacy content status pill (published/draft/…) — kept for existing pages. */
export function StatusDot({ status }: { status: string }) {
  const tone =
    status === "published"
      ? "bg-forest/10 text-forest"
      : status === "draft"
        ? "bg-sunshine/25 text-[#7a5a00]"
        : "bg-surface-2 text-muted";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium capitalize",
        tone,
      )}
    >
      {status}
    </span>
  );
}

type BadgeTone = "forest" | "gold" | "tomato" | "neutral" | "blue";
const TONE_CLASS: Record<BadgeTone, string> = {
  forest: "bg-forest/10 text-forest",
  gold: "bg-sunshine/25 text-[#7a5a00]",
  tomato: "bg-tomato/10 text-tomato",
  neutral: "bg-surface-2 text-muted",
  blue: "bg-[#e9f1ff] text-[#1f4f8b]",
};

/** General status badge; infers a tone from common status strings. */
export function StatusBadge({
  status,
  tone,
  label,
}: {
  status: string;
  tone?: BadgeTone;
  label?: string;
}) {
  const resolved: BadgeTone = tone ?? inferTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold capitalize",
        TONE_CLASS[resolved],
      )}
    >
      {(label ?? status).replace(/_/g, " ")}
    </span>
  );
}

function inferTone(status: string): BadgeTone {
  const s = status.toLowerCase();
  if (["published", "approved", "completed", "paid", "active", "resolved", "verified"].includes(s))
    return "forest";
  if (["draft", "submitted", "under_review", "pending", "en_route", "arrived", "in_progress", "awaiting_acceptance"].includes(s))
    return "gold";
  if (s.startsWith("cancelled") || ["rejected", "suspended", "failed", "no_partner_available", "escalated"].includes(s))
    return "tomato";
  if (["confirmed", "assigned", "open"].includes(s)) return "blue";
  return "neutral";
}

/* ── Page header ───────────────────────────────────────────────────────── */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── Metric card ───────────────────────────────────────────────────────── */

export function MetricCard({
  label,
  value,
  loading,
  icon,
  tone = "ink",
  hint,
  sub,
  trend,
}: {
  label: string;
  value: ReactNode;
  loading?: boolean;
  icon?: IconName;
  tone?: "ink" | "forest" | "tomato" | "gold";
  hint?: string;
  sub?: string;
  trend?: { dir: "up" | "down"; value: string };
}) {
  const valueTone =
    tone === "forest"
      ? "text-forest"
      : tone === "tomato"
        ? "text-tomato"
        : tone === "gold"
          ? "text-[#7a5a00]"
          : "text-ink";
  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {icon && (
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface-2 text-forest">
            <Icon name={icon} size={17} />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <p className={cn("text-[28px] font-semibold leading-none tabular-nums", valueTone)}>
          {loading ? "—" : value}
        </p>
        {trend && !loading && (
          <span
            className={cn(
              "mb-0.5 inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
              trend.dir === "up" ? "bg-forest/10 text-forest" : "bg-tomato/10 text-tomato",
            )}
          >
            {trend.dir === "up" ? "▲" : "▼"} {trend.value}
          </span>
        )}
      </div>
      {sub && <p className="mt-1.5 text-xs text-muted">{sub}</p>}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/* ── Data table primitives (overflow-safe) ─────────────────────────────── */

export function DataTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-soft">
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "border-b border-line px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("border-b border-line px-4 py-3 text-ink", className)}>{children}</td>;
}

/* ── Empty / loading states ────────────────────────────────────────────── */

export function EmptyState({
  icon = "search",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-muted">
        <Icon name={icon} size={24} />
      </span>
      <p className="mt-4 font-display text-base font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-2", className)} />;
}

/** A few stacked skeleton rows for list/table loading. */
export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
