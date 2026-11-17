# 05 — Website Integration

**Current state:** `frontend/` Next.js App Router (React 19, Tailwind 3.4), live at
**panditjiexpress.com**. Public `(site)` routes + admin `(admin)` routes in one app.
BFF proxy (`/api/backend/[...path]`) forwards to the FastAPI backend. **[IMPLEMENTED]**

## Role in the ecosystem
The website is the **discovery + SEO + lead + booking-entry** surface, and the **admin
console host**. It is preserved and integrated, not replaced. The homepage redesign
(hero + HeroSearch + discovery + trust + FAQ) is live.

## Public routes [IMPLEMENTED]
`/` (home), `/puja-services` (+ `/[slug]`), `/puja-categories/[slug]`,
`/locations` (+ `/[slug]`), `/book/[slug]`, `/how-it-works`, `/about-us`,
`/contact-us`, `/faqs`, `/testimonials`, `/privacy-policy`,
`/terms-and-conditions`, `/cancellation-refund-policy`, plus `robots.txt`,
`sitemap.xml`, `/icon.svg`.

## Shared contracts (website ⇄ backend)
- **Content API:** `/api/v1/public/*` (services, categories, locations, pages, FAQs,
  testimonials, enquiry submit) feeds SSG/ISR pages. **[IMPLEMENTED]**
- **Revalidation:** backend POSTs `FRONTEND_REVALIDATE_URL` on content edits so pages
  refresh without redeploy (`services/revalidate.py`). **[IMPLEMENTED]**
- **Booking entry:** website `book/[slug]` captures intent; full pay/track lives in the
  app (web checkout depth is **[PARTIAL]**).
- **Enquiry/lead:** `/public` enquiry → `booking_enquiry`, rate-limited. **[IMPLEMENTED]**

## Integration principles
1. **One identity, one backend, one contract** — website, apps and admin all speak the
   same versioned API (`/api/v1`). No separate CMS backend.
2. **Website is cache-friendly** — SSG/ISR + CDN; mutating actions go through the app /
   authenticated endpoints.
3. **SEO is first-class** — sitemap/robots present; structured data, canonical, OG,
   per-page meta engine is **[PARTIAL]** (SEO admin page is a placeholder).
4. **Shared design tokens** — brand tokens (CSS vars) shared across web + (target) apps
   for visual consistency.

## Caching & revalidation note
Homepage is `public, max-age=0, must-revalidate` at the browser with a Vercel edge
cache (`x-vercel-cache: HIT`). Content edits trigger on-demand revalidate. A recent
"old UI" report was a **client browser cache**, not a server issue (server served the
new build) — documented for ops.

## Gaps vs target
| Area | Status |
|---|---|
| Blog/content marketing | [MISSING] |
| SEO engine (structured data, auto-sitemap per entity, canonical rules) | [PARTIAL] |
| Media via object storage (WebP/AVIF, usage checks) | [MISSING] |
| Web checkout/payment parity with app | [PARTIAL] |
| Localization (Hindi/English site toggle) | [PARTIAL] |
| Accessibility audit (WCAG AA) | [NEEDS-VALIDATION] |

## Acceptance criteria
- Public pages render without auth, cache correctly, and revalidate on edit.
- No PII in URLs/query; enquiry endpoints rate-limited; forms validated server-side.
- Admin routes gated (unauth → redirect to `/admin/login`).
