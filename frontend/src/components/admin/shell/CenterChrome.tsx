"use client";

import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Icon } from "../icons";
import { useAdminLogout } from "./AdminAuthGate";

/** Light top chrome for the Admin Control Center (no module sidebar). */
export function CenterChrome({ children }: { children: ReactNode }) {
  const { data: me } = useAuth();
  const [menu, setMenu] = useState(false);
  const logout = useAdminLogout();

  return (
    <div className="admin-ui min-h-screen bg-surface-2">
      <header className="flex items-center justify-between border-b border-line bg-surface px-5 py-3 md:px-8">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-forest font-display text-base font-bold text-sunshine">
            ॐ
          </span>
          <span className="font-display text-sm font-bold text-forest">
            Pandit Ji Express
            <span className="ml-1.5 font-sans text-xs font-medium text-muted">
              Admin Control Center
            </span>
          </span>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenu((m) => !m)}
            className="grid h-9 w-9 place-items-center rounded-full bg-forest text-sm font-bold text-sunshine"
            aria-label="Account menu"
          >
            {me?.email?.[0]?.toUpperCase() ?? "A"}
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-20 mt-1.5 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-soft-lg">
                <div className="px-3 py-2">
                  <p className="text-[11px] text-muted">Signed in as</p>
                  <p className="truncate text-sm font-medium text-ink">{me?.email}</p>
                </div>
                <div className="my-1 border-t border-line" />
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-tomato hover:bg-tomato/10"
                >
                  <Icon name="logout" size={16} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
