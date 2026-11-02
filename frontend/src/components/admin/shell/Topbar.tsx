"use client";

import { useState } from "react";
import { type ModuleId } from "@/config/admin-nav";
import { Icon, type IconName } from "../icons";
import { Breadcrumbs } from "./Breadcrumbs";
import { ModuleSwitcher } from "./ModuleSwitcher";
import { useSidebar } from "./SidebarContext";
import { useAdminLogout } from "./AdminAuthGate";

export function Topbar({ module, email }: { module: ModuleId; email?: string }) {
  const { setDrawerOpen } = useSidebar();
  const [menu, setMenu] = useState(false);
  const logout = useAdminLogout();

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur md:px-6">
      <button
        onClick={() => setDrawerOpen(true)}
        className="rounded-lg p-1.5 text-ink hover:bg-surface-2 md:hidden"
        aria-label="Open menu"
      >
        <Icon name="menu" size={20} />
      </button>

      <ModuleSwitcher current={module} />

      <div className="hidden min-w-0 lg:block">
        <Breadcrumbs module={module} />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="relative hidden sm:block">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            placeholder="Search…"
            aria-label="Global search"
            className="w-40 rounded-lg border border-line bg-surface-2 py-1.5 pl-8 pr-3 text-sm text-ink transition-[width] placeholder:text-muted focus-visible:w-56 focus-visible:border-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/20"
          />
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          <IconButton name="bell" label="Notifications" />
          <IconButton name="help" label="Help" />
        </div>

        <div className="relative">
          <button
            onClick={() => setMenu((m) => !m)}
            className="grid h-9 w-9 place-items-center rounded-full bg-forest text-sm font-bold text-sunshine"
            aria-label="Account menu"
            aria-haspopup="menu"
          >
            {email ? email[0]?.toUpperCase() : "A"}
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1.5 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-soft-lg"
              >
                <div className="px-3 py-2">
                  <p className="text-[11px] text-muted">Signed in as</p>
                  <p className="truncate text-sm font-medium text-ink">{email}</p>
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
      </div>
    </header>
  );
}

function IconButton({ name, label }: { name: IconName; label: string }) {
  return (
    <button
      className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink"
      aria-label={label}
      title={label}
    >
      <Icon name={name} size={18} />
    </button>
  );
}
