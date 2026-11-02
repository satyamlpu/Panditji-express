"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MODULES,
  NAV_BY_MODULE,
  activeHref,
  type ModuleId,
  type NavItem,
} from "@/config/admin-nav";
import { cn } from "@/lib/utils";
import { Icon } from "../icons";
import { useSidebar } from "./SidebarContext";
import { useAdminLogout } from "./AdminAuthGate";

export function Sidebar({ module, email }: { module: ModuleId; email?: string }) {
  const { collapsed, drawerOpen, setDrawerOpen } = useSidebar();
  return (
    <>
      {/* Desktop / tablet — static, collapsible */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 border-r border-line bg-surface transition-[width] duration-200 md:flex md:flex-col",
          collapsed ? "md:w-[76px]" : "md:w-[250px]",
        )}
      >
        <SidebarInner module={module} collapsed={collapsed} email={email} />
      </aside>

      {/* Mobile — off-canvas drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[264px] flex-col bg-surface shadow-soft-lg">
            <SidebarInner module={module} collapsed={false} email={email} />
          </aside>
        </div>
      )}
    </>
  );
}

function SidebarInner({
  module,
  collapsed,
  email,
}: {
  module: ModuleId;
  collapsed: boolean;
  email?: string;
}) {
  const pathname = usePathname();
  const mod = MODULES[module];
  const nav = NAV_BY_MODULE[module];
  const active = activeHref(nav, pathname);
  const logout = useAdminLogout();
  const { toggleCollapsed } = useSidebar();

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <Link
        href={mod.home}
        className={cn("flex items-center gap-2.5 px-4 py-4", collapsed && "justify-center px-0")}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-forest font-display text-base font-bold text-sunshine">
          ॐ
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block font-display text-sm font-bold leading-tight text-forest">
              Pandit Ji Express
            </span>
            <span className="block truncate text-[11px] text-muted">{mod.label}</span>
          </span>
        )}
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label={mod.label}>
        <div className="flex flex-col gap-1">
          {nav.map((item) => (
            <SideLink key={item.href} item={item} active={active === item.href} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-line p-3">
        {!collapsed && email && (
          <>
            <p className="px-2 text-[11px] text-muted">Signed in as</p>
            <p className="truncate px-2 text-sm font-medium text-ink">{email}</p>
          </>
        )}
        <button
          onClick={logout}
          title="Sign out"
          className={cn(
            "mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-tomato hover:bg-tomato/10",
            collapsed && "justify-center px-0",
          )}
        >
          <Icon name="logout" size={16} />
          {!collapsed && "Sign out"}
        </button>
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand" : "Collapse"}
          className={cn(
            "mt-1 hidden w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-surface-2 md:flex",
            collapsed && "justify-center px-0",
          )}
        >
          <Icon name={collapsed ? "expand" : "collapse"} size={16} />
          {!collapsed && "Collapse"}
        </button>
      </div>
    </div>
  );
}

function SideLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-ink/80 hover:bg-surface-2",
        collapsed && "justify-center px-0",
        active && "bg-burgundy/10 font-semibold text-burgundy",
      )}
    >
      <Icon name={item.icon} size={19} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}
