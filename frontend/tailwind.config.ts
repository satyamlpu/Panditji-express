import type { Config } from "tailwindcss";

/**
 * Pandit Ji Express design system. Brand colours are declared once as CSS
 * variables in globals.css and referenced here, so no hex codes are scattered
 * through components.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand v2.0 palette (preferred names)
        kumkum: "var(--kumkum)",
        "kumkum-dark": "var(--kumkum-dark)",
        saffron: "var(--saffron)",
        "saffron-dark": "var(--saffron-dark)",
        swarna: "var(--swarna)",
        ivory: "var(--ivory)",
        charcoal: "var(--charcoal)",
        ash: "var(--ash)",
        success: "var(--success)",
        // Legacy palette names (remapped to v2.0 in globals.css)
        sunshine: "var(--sunshine)",
        cream: "var(--cream)",
        carrot: "var(--carrot)",
        tomato: "var(--tomato)",
        forest: "var(--forest)",
        kiwi: "var(--kiwi)",
        burgundy: "var(--burgundy)",
        // Semantic tokens
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        brand: "var(--brand)",
        "brand-hover": "var(--brand-hover)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        ring: "var(--ring)",
        gold: "var(--gold)",
        "gold-soft": "var(--gold-soft)",
        maroon: "var(--maroon)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        deva: ["var(--font-deva)", "var(--font-sans)", "sans-serif"],
      },
      borderRadius: {
        card: "18px",
        pill: "999px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(27,21,18,0.04), 0 8px 24px rgba(27,21,18,0.07)",
        "soft-lg": "0 14px 44px rgba(27,21,18,0.12)",
      },
      maxWidth: {
        content: "1120px",
      },
    },
  },
  plugins: [],
};

export default config;
