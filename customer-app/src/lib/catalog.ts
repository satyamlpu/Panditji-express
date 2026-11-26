// Static catalog assets for the puja grid. Metro needs literal require() paths,
// so photos are mapped per service slug. Slugs without a photo render a designed
// neutral placeholder (CatalogMedia), never an emoji.
import type { IconName } from "../design";

export const PUJA_IMAGES: Record<string, number> = {
  "ganesh-puja": require("../../assets/catalog/ganesh-puja.png"),
  "navagraha-shanti-puja": require("../../assets/catalog/navagraha-shanti-puja.png"),
  // Kalash-on-threshold is the classic Griha Pravesh image.
  "griha-pravesh-puja": require("../../assets/catalog/kalash.png"),
};

/** The bundled photo for a service slug, or undefined → designed placeholder. */
export function pujaImage(slug: string): number | undefined {
  return PUJA_IMAGES[slug];
}

export const HERO = require("../../assets/catalog/hero.png");
export const OM = require("../../assets/catalog/om.png");

// Optional samagri add-ons shown on the booking screen. These are arranged by
// the Panditji and settled directly with them — selection is a preference note,
// not a charge, so no price is billed through the app.
export interface Samagri {
  key: string;
  name: string;
  meta: string;
  img: number;
}
export const SAMAGRI: Samagri[] = [
  { key: "marigold", name: "Marigold Garland", meta: "Fresh flowers", img: require("../../assets/catalog/marigold.png") },
  { key: "agarbatti", name: "Agarbatti Pack", meta: "Incense sticks", img: require("../../assets/catalog/agarbatti.png") },
  { key: "kalash", name: "Brass Kalash", meta: "With coconut", img: require("../../assets/catalog/kalash.png") },
];

// Home category chips (visual entry points; they filter the grid).
export interface Category {
  key: string;
  label: string;
  icon: IconName;
}
export const CATEGORIES: Category[] = [
  { key: "all", label: "All Pujas", icon: "blessing" },
  { key: "havan", label: "Havan", icon: "havan" },
  { key: "samagri", label: "Samagri", icon: "samagri" },
  { key: "astro", label: "Astrology", icon: "night" },
];

// Seasonal highlights (cosmetic, festival-themed marketing — not user data).
export interface Highlight {
  key: string;
  title: string;
  sub: string;
  icon: IconName;
}
export const HIGHLIGHTS: Highlight[] = [
  { key: "festive", title: "Festive season is here", sub: "Book Lakshmi & Diwali pujas early", icon: "blessing" },
  { key: "griha", title: "Moving to a new home?", sub: "Griha Pravesh Panditjis near you", icon: "home" },
  { key: "astro", title: "Navagraha Shanti", sub: "Peace & prosperity havans", icon: "havan" },
];
