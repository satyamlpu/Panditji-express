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
        // Raw brand palette
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
        accent: "var(--accent)",
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
        soft: "0 1px 2px rgba(26,46,34,0.04), 0 8px 24px rgba(26,46,34,0.06)",
        "soft-lg": "0 12px 40px rgba(26,46,34,0.10)",
      },
      maxWidth: {
        content: "1120px",
      },
    },
  },
  plugins: [],
};

export default config;
