"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES, NAV_BY_MODULE, activeHref, type ModuleId } from "@/config/admin-nav";
import { Icon } from "../icons";

export function Breadcrumbs({ module }: { module: ModuleId }) {
  const pathname = usePathname();
  const mod = MODULES[module];
  const nav = NAV_BY_MODULE[module];
  const active = activeHref(nav, pathname);
  const section = nav.find((n) => n.href === active);

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      <span className="text-muted">Admin</span>
      <Icon name="chevronRight" size={14} className="shrink-0 text-muted" />
      <Link href={mod.home} className="font-medium text-ink hover:text-forest">
        {mod.label}
      </Link>
      {section && section.href !== mod.home && (
        <>
          <Icon name="chevronRight" size={14} className="shrink-0 text-muted" />
          <span className="truncate font-medium text-ink">{section.label}</span>
        </>
      )}
    </nav>
  );
}
