"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MODULES, type ModuleId } from "@/config/admin-nav";
import { cn } from "@/lib/utils";
import { Icon } from "../icons";

export function ModuleSwitcher({ current }: { current: ModuleId }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const mod = MODULES[current];

  function go(id: ModuleId) {
    try {
      localStorage.setItem("admin:lastModule", id);
    } catch {
      /* ignore */
    }
    setOpen(false);
    router.push(MODULES[id].home);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-semibold text-ink hover:bg-surface-2"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name={mod.icon} size={16} className="text-forest" />
        <span className="hidden sm:inline">{mod.label}</span>
        <Icon name="switcher" size={14} className="text-muted" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute left-0 z-20 mt-1.5 w-72 rounded-xl border border-line bg-surface p-1.5 shadow-soft-lg"
          >
            <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Switch module
            </p>
            {Object.values(MODULES).map((m) => (
              <button
                key={m.id}
                onClick={() => go(m.id)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left hover:bg-surface-2",
                  m.id === current && "bg-burgundy/5",
                )}
              >
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-forest">
                  <Icon name={m.icon} size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{m.label}</span>
                  <span className="block text-xs text-muted">{m.description}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
