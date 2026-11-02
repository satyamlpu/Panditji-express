/**
 * Admin navigation model. The two modules (Website Management and App & CRM)
 * have completely independent nav — their menus never mix. Icons are referenced
 * by name through the centralized registry in components/admin/icons.tsx.
 */
import type { IconName } from "@/components/admin/icons";

export type ModuleId = "website" | "app";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Home items match the URL exactly; sections match by prefix. */
  exact?: boolean;
}

export interface ModuleMeta {
  id: ModuleId;
  /** Full name shown on cards and the topbar. */
  label: string;
  /** Short name shown in the switcher. */
  short: string;
  /** Landing route for the module. */
  home: string;
  icon: IconName;
  description: string;
}

export const MODULES: Record<ModuleId, ModuleMeta> = {
  website: {
    id: "website",
    label: "Website Management",
    short: "Website",
    home: "/admin/website",
    icon: "website",
    description:
      "Control the public Pandit Ji Express website — pages, content, services, media and SEO.",
  },
  app: {
    id: "app",
    label: "App & CRM",
    short: "App & CRM",
    home: "/admin/marketplace",
    icon: "app",
    description:
      "Run the marketplace — customers, pandit partners, bookings, finance and support.",
  },
};

export const WEBSITE_NAV: NavItem[] = [
  { href: "/admin/website", label: "Dashboard", icon: "dashboard", exact: true },
  { href: "/admin/services", label: "Services", icon: "services" },
  { href: "/admin/categories", label: "Categories", icon: "categories" },
  { href: "/admin/locations", label: "Locations", icon: "locations" },
  { href: "/admin/testimonials", label: "Testimonials", icon: "testimonials" },
  { href: "/admin/faqs", label: "FAQs", icon: "faqs" },
  { href: "/admin/pages", label: "Pages", icon: "pages" },
  { href: "/admin/homepage", label: "Homepage", icon: "homepage" },
  { href: "/admin/media", label: "Media Library", icon: "media" },
  { href: "/admin/seo", label: "SEO", icon: "seo" },
  { href: "/admin/enquiries", label: "Enquiries", icon: "enquiries" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
];

export const APP_NAV: NavItem[] = [
  { href: "/admin/marketplace", label: "Operations", icon: "operations", exact: true },
  { href: "/admin/marketplace/customers", label: "Customers", icon: "customers" },
  { href: "/admin/marketplace/partners", label: "Partners", icon: "partners" },
  { href: "/admin/marketplace/bookings", label: "Bookings", icon: "bookings" },
  { href: "/admin/marketplace/finance", label: "Finance", icon: "finance" },
  { href: "/admin/marketplace/reviews", label: "Reviews", icon: "reviews" },
  { href: "/admin/marketplace/support", label: "Support", icon: "support" },
];

export const NAV_BY_MODULE: Record<ModuleId, NavItem[]> = {
  website: WEBSITE_NAV,
  app: APP_NAV,
};

/** Pick the active nav item for a pathname: exact for home items, longest
 *  matching prefix otherwise. Returns the item href or null. */
export function activeHref(items: NavItem[], pathname: string): string | null {
  let best: { href: string; len: number } | null = null;
  for (const it of items) {
    const match = it.exact
      ? pathname === it.href
      : pathname === it.href || pathname.startsWith(it.href + "/");
    if (match && (!best || it.href.length > best.len)) {
      best = { href: it.href, len: it.href.length };
    }
  }
  return best?.href ?? null;
}
