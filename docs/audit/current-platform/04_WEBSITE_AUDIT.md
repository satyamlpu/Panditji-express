# 04 — Public Website Audit

Next.js 15 App Router, route group `(site)`. LIVE at `frontend-umber-six-66.vercel.app`. Data via BFF proxy → backend `/api/*`.

## Pages present
| Route | Purpose | State |
|---|---|---|
| `/` | Marketplace homepage (redesigned, Brand v2.0) | ✅ |
| `/puja-services` | Service catalogue | ✅ |
| `/book/[slug]` | Booking entry for a service | ✅ |
| `/locations`, `/locations/[slug]` | City pages | ✅ |
| `/how-it-works`, `/about-us`, `/contact-us` | Marketing | ✅ |
| Policy pages (terms/privacy/refund…) | CMS-driven | ✅ |
| `/admin/login` | Staff login (linked from header) | ✅ |

## Homepage composition (verified in `(site)/page.tsx`)
Hero + `HeroSearch` (service/location/date → `/book/<slug>` or `/puja-services`) · service discovery grid (real services, `SERVICE_IMAGES` cycle) · 4-step booking explainer · verified-pandits panel (**honest** — no fabricated profiles/ratings; "Verified before joining") · why-choose editorial + testimonial (guarded: sample testimonial auto-hidden) · crimson stat band · samagri-included · app promo ("Coming soon") · FAQ (real data + `FALLBACK_FAQS`) · final CTA. Data from `fetchServices/fetchLocations/fetchTestimonials/fetchFaqs`.

## Strengths
- **Honest content**: no fake pandit profiles, ratings, or counts; sample testimonial suppressed — avoids the classic marketplace-trust anti-pattern.
- Brand v2.0 design system applied via CSS-var tokens (`globals.css`) + Tailwind; Archivo/Inter/Noto Devanagari via `next/font`.
- Server components + React Query; `next/image` usage; BFF proxy hides backend origin.
- Accessible header (aria labels, mobile drawer, visible focus).

## Findings
| # | Severity | Finding | Evidence |
|---|---|---|---|
| W-1 | HIGH | `HeroSearch` is client-select only; location/date are passed as query params but **no backend search** validates/filters — a non-matching service still routes to catalogue | `HeroSearch.tsx:30-38` |
| W-2 | HIGH | "Book now" (header) and booking flow terminate at a flow that needs **customer OTP login**, which is blocked (no SMS) → end-to-end booking cannot complete on prod | `SiteHeader.tsx:73`, 03/05 |
| W-3 | MEDIUM | `<img>` used for logo (eslint-disabled) instead of `next/image` — minor LCP/caching | `SiteHeader.tsx:40-44` |
| W-4 | MEDIUM | Custom domain `panditjiexpress.com` serves empty 200 — public entry point effectively dead | infra; see 14 |
| W-5 | LOW | Testimonial fallback / FAQ fallback are static constants — fine, but ensure they're clearly generic (they are) | `page.tsx` FALLBACK_* |
| W-6 | LOW | Nav hover uses `text-forest` (legacy token) in `SiteHeader` while Brand v2.0 primary is kumkum — minor token drift | `SiteHeader.tsx:56,58` |
| W-7 | INFO | Preview branch URL returns 302 (Vercel Deployment Protection) — expected for preview; not a site defect | 14 |

## Not verified
- Full responsive sweep on the **current** build at all 6 breakpoints was done during redesign, not re-run in this read-only pass.
- Lighthouse/Core-Web-Vitals numbers **NOT MEASURED** this pass (see 17).

## Classification
Website: **IMPLEMENTED** and live, **PARTIALLY** usable end-to-end (booking blocked at OTP). Content integrity is a genuine strength.
