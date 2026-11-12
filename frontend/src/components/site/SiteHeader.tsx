"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
}

const FALLBACK_NAV: NavItem[] = [
  { label: "Pujas", href: "/puja-services" },
  { label: "Locations", href: "/locations" },
  { label: "How it works", href: "/how-it-works" },
  { label: "About", href: "/about-us" },
  { label: "Contact", href: "/contact-us" },
];

export function SiteHeader({
  siteName,
  nav,
}: {
  siteName: string;
  nav?: NavItem[];
}) {
  const items = nav && nav.length ? nav : FALLBACK_NAV;
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="brand-rule" aria-hidden />
      <div className="container-pad flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center" aria-label={`${siteName} home`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-full.svg"
            alt={siteName}
            className="h-9 w-auto md:h-10"
          />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-pill px-3 py-2 text-sm font-medium text-ink/80 hover:bg-surface-2 hover:text-forest",
                  active && "bg-surface-2 text-forest",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:block">
          <Link href="/puja-services" className={buttonClasses("accent", "sm")}>
            Book a puja
          </Link>
        </div>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-xl border border-line md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-bg md:hidden">
          <nav className="container-pad flex flex-col py-2" aria-label="Mobile">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-3 text-sm font-medium text-ink hover:bg-surface-2"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/puja-services"
              className={buttonClasses("accent", "md", "mt-2")}
              onClick={() => setOpen(false)}
            >
              Book a puja
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
