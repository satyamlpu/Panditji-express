# 16 — UI/UX & Accessibility Audit

Scope: public website + admin. Brand v2.0 design system (Kumkum Crimson / Agni Saffron / Swarna Gold / Parchment Ivory / Kohl Charcoal / Ash; Archivo + Inter + Noto Sans Devanagari).

## Design system (verified)
- Tokens defined as CSS vars in `globals.css`, exposed through `tailwind.config.ts`; legacy aliases remapped; `--brand=kumkum`, `--accent=saffron`.
- Fonts via `next/font` (Archivo display, Inter body, Noto Devanagari for Hindi).
- Semantic button variants (`primary`=crimson, `accent`=saffron).

## Accessibility — known results
| Item | State | Evidence |
|---|---|---|
| Header a11y | ✅ | aria labels, `aria-expanded`, mobile drawer, visible focus | `SiteHeader.tsx` |
| **Contrast** | 🟡 | QA found white-on-saffron ≈3.9:1 and saffron-on-ivory ≈3.6:1 (**below AA 4.5**) → resolved by using **crimson** for primary CTAs, saffron only as small accents | redesign QA |
| Keyboard nav | 🟡 | global focus styles present; full keyboard sweep not re-run this pass |
| Reduced motion | 🟡 | honored in admin shell per plan; not re-verified site-wide |
| Hindi/Devanagari | ✅ | Noto Sans Devanagari wired |

## Findings
| # | Severity | Finding | Evidence |
|---|---|---|---|
| U-1 | MEDIUM | **No formal WCAG 2.1 AA audit** run on the current build (contrast handled ad hoc during redesign) | this pass |
| U-2 | MEDIUM | Saffron remains below AA for text/large fills — ensure it never carries text contrast-critically | tokens |
| U-3 | LOW | Logo uses `<img>` not `next/image` (eslint-disabled) | `SiteHeader.tsx:40` |
| U-4 | LOW | Token drift between legacy (forest/gold) and Brand v2.0 in some admin/site spots | 04 W-6, 07 A-6 |
| U-5 | LOW | No dark mode (brand is warm/light by design — acceptable, note as decision) | globals.css |
| U-6 | INFO | Honest content (no fake profiles/ratings) is a UX-trust strength | 04 |

## Strengths
Cohesive, premium, culturally-appropriate visual system; accessible header pattern; contrast risk already identified and mitigated by CTA color choice; Hindi script support built in.

## Not verified
No automated a11y scan (axe/Lighthouse) or screen-reader pass this read-only round — see U-1.

## Classification
UI/UX: **STRONG & on-brand.** Accessibility: **PARTIAL** — good instincts and one contrast issue already mitigated, but **no formal AA audit yet**.
