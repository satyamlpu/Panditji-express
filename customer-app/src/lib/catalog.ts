// Static catalog assets for the puja grid. Metro needs literal require() paths,
// so photos are mapped per service slug. Slugs without a photo fall back to a
// tasteful tinted "glyph tile" (see PUJA_GLYPH) so the grid stays consistent.
import { colors } from "../theme";

export const PUJA_IMAGES: Record<string, number> = {
  "ganesh-puja": require("../../assets/catalog/ganesh-puja.png"),
  "navagraha-shanti-puja": require("../../assets/catalog/navagraha-shanti-puja.png"),
  // Kalash-on-threshold is the classic Griha Pravesh image.
  "griha-pravesh-puja": require("../../assets/catalog/kalash.png"),
};

export const PUJA_GLYPH: Record<string, { glyph: string; tint: string }> = {
  rudrabhishek: { glyph: "🔱", tint: colors.tintBlue },
  "satyanarayan-katha": { glyph: "🪔", tint: colors.tintSaffron },
};

export const DEFAULT_GLYPH = { glyph: "🕉️", tint: colors.tintSaffron };

export const HERO = require("../../assets/catalog/hero.png");
export const OM = require("../../assets/catalog/om.png");

// Optional samagri add-ons shown on the booking screen. These are arranged by
// the pandit and settled directly with them — selection is a preference note,
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

// Home category chips (visual entry points; they scroll/filter the grid).
export interface Category {
  key: string;
  label: string;
  glyph: string;
  tint: string;
}
export const CATEGORIES: Category[] = [
  { key: "all", label: "All Pujas", glyph: "🕉️", tint: colors.tintSaffron },
  { key: "havan", label: "Havan", glyph: "🔥", tint: colors.tintRose },
  { key: "samagri", label: "Samagri", glyph: "🪔", tint: colors.tintGreen },
  { key: "astro", label: "Astrology", glyph: "🪐", tint: colors.tintBlue },
];

// Promo banners (cosmetic, festival-themed).
export interface Banner {
  key: string;
  title: string;
  sub: string;
  bg: string;
  fg: string;
}
export const BANNERS: Banner[] = [
  { key: "diwali", title: "Festive season is here", sub: "Book Lakshmi & Diwali pujas early", bg: colors.maroon, fg: colors.sunshine },
  { key: "griha", title: "New home?", sub: "Griha Pravesh pandits in minutes", bg: colors.forest, fg: colors.sunshine },
  { key: "astro", title: "Navagraha Shanti", sub: "Peace & prosperity havans", bg: colors.carrot, fg: colors.white },
];
