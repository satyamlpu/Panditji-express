# Pandit Ji Express

A professional, multi-page, SEO-first **service-commerce** site for booking pujas,
with a **secure admin panel** for managing all business content without touching
code or redeploying.

Built as a **new project** reusing the proven technical foundation of the
FlowDesk codebase in this repo (auth, RBAC, BFF, security posture, Next.js +
FastAPI stack). FlowDesk itself is untouched.

> **Status:** Phases 0–6 complete and verified — the full multi-page site, the
> complete content admin, SEO/structured data, and security hardening. Every
> required route exists, all content is admin-managed, and published edits appear
> on the public site without a redeploy.

> **Content is placeholder.** Every service, price, testimonial and policy shipped
> by the seed script is clearly-labelled **sample data**, not verified business
> information. Replace it through the admin panel (or re-seed) before launch —
> `python seed.py --wipe-content` clears placeholder content but keeps the admin.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 15 (App Router) · TypeScript (strict) · Tailwind · TanStack Query · RHF + Zod | SSR/SSG + **ISR** for SEO; a BFF keeps JWTs out of the browser |
| Backend | FastAPI · SQLAlchemy 2 (async) · Alembic | REST + Swagger + Pydantic validation; async |
| Database | SQLite (dev) · PostgreSQL (prod) | Zero-setup local; portable column types for Postgres |
| Auth | JWT access + rotating refresh · Argon2id · httpOnly cookies (BFF) | Strong hashing; tokens never exposed to browser scripts |

## Architecture

```
Panditji Express/
├── backend/   FastAPI — content model, admin CRUD, public read API, auth, Alembic, tests, seed
└── frontend/  Next.js — public SSR/ISR pages, admin panel, BFF proxy, design system
```

- **Public pages** are Server Components that fetch the backend directly
  (server-to-server) with tagged, cached `fetch`es → crawlable HTML + ISR.
- **Admin** is a protected SPA-like area; every data call goes through the Next
  **BFF proxy** (`/api/backend/*`), which attaches the access token from an
  httpOnly cookie and transparently refreshes it.
- When an admin publishes a change, the backend calls the frontend's
  `/api/revalidate` webhook (shared secret) → the affected pages re-render on the
  next request. **Routine content edits never require a redeploy.**

### Routes

Public (indexable): `/`, `/puja-services`, `/puja-services/[slug]`,
`/puja-categories/[slug]`, `/locations`, `/locations/[slug]`, `/how-it-works`,
`/about-us`, `/testimonials`, `/faqs`, `/contact-us`, `/privacy-policy`,
`/terms-and-conditions`, `/cancellation-refund-policy`, plus `/sitemap.xml`,
`/robots.txt` and a custom 404. Transactional: `/book/[slug]` (noindex).
Admin: `/admin/login`, `/admin`, `/admin/services`, `/admin/categories`,
`/admin/locations`, `/admin/testimonials`, `/admin/faqs`, `/admin/pages`,
`/admin/homepage`, `/admin/enquiries`, `/admin/settings`.

### Data model

`admin_user`, `refresh_token`, `audit_log`, `category`, `service`, `location` +
`service_location`, `testimonial`, `faq`, `homepage_section`, `page`, `setting`,
`booking_enquiry`, `redirect`. Public content has **draft / published /
unpublished** states, slugs and per-page SEO fields.

---

## Local setup

Requires Python 3.12+ and Node 20+.

### 1. Backend → http://localhost:8099

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # defaults work out of the box (SQLite)
alembic upgrade head            # create tables
python seed.py                  # admin + placeholder content
uvicorn app.main:app --port 8099 --reload
```

Swagger: http://localhost:8099/docs · Tests: `pytest` · Lint: `ruff check .`

Default admin (change it): `admin@panditjiexpress.in` / `Admin!Pandit123`

> Port note: 8099 is used so it does not clash with FlowDesk (8077). Keep the
> frontend's `BACKEND_URL` in sync.

### 2. Frontend → http://localhost:3000

```bash
cd frontend
npm install
cp .env.example .env.local      # BACKEND_URL + REVALIDATE_SECRET
npm run dev                     # or: npm run build && npm run start
```

Typecheck: `npm run typecheck` · Build: `npm run build`

**Using Postgres:** set `DATABASE_URL=postgresql+psycopg://user:pass@host:5432/db`
in `backend/.env`, uncomment `psycopg[binary]` in `requirements.txt`, then re-run
`alembic upgrade head` and `python seed.py`. No code changes — portable types.

---

## Environment configuration

**Backend (`backend/.env`)** — key values:

| Var | Purpose |
|---|---|
| `DATABASE_URL` | SQLite (dev) or Postgres (prod) |
| `JWT_SECRET` | **Required** real secret in production (≥32 bytes); app refuses to start otherwise |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `RATE_LIMIT_LOGIN_PER_MIN`, `RATE_LIMIT_ENQUIRY_PER_HOUR` | Abuse limits |
| `FRONTEND_REVALIDATE_URL`, `REVALIDATE_SECRET` | On-demand ISR webhook (secret must match the frontend) |
| `SITE_URL` | Base URL for sitemap/canonicals/JSON-LD |

**Frontend (`frontend/.env.local`)**: `BACKEND_URL` (server-only),
`NEXT_PUBLIC_SITE_URL`, `REVALIDATE_SECRET` (must match the backend).

---

## Content management (for non-technical editors)

Sign in at `/admin`. The panel manages every piece of public content:

- **Services** — title, slug, summary, description, price, duration, inclusions,
  samagri, category, featured flag, SEO. A **live preview** and a
  **search-result preview** update as you type.
- **Homepage sections** — the landing page's hero, feature and CTA blocks: edit
  the heading/sub-heading/CTA **and upload the photo** for each (the site uses
  bundled fallback images until one is uploaded). Changing a photo or the copy
  updates the live homepage with no redeploy.
- **Categories**, **Locations** (with per-location service availability),
  **Testimonials**, **FAQs** (grouped by topic).
- **Pages** — about, contact and the policy pages, written in **Markdown** with
  SEO fields.
- **Settings** — site name/tagline, contact details, social links, SEO defaults,
  and the navigation/footer (JSON).
- **Enquiries** — review booking requests and move them through
  new → contacted → confirmed / cancelled.

Workflow for any content: save as **Draft** (invisible to the public), then
**Publish** when ready, or **Unpublish** to pull it without deleting. Changing a
service or location slug keeps the old URL working via an automatic 301 redirect.
Published changes appear on the public site automatically — **no redeploy**.
Optional images can be uploaded (PNG/JPEG/WEBP/GIF, ≤3 MB); the site is designed
to look complete without any.

---

## SEO

- Per-page `<title>` + meta description (brand suffix via a title template);
  self-referencing canonicals; Open Graph tags.
- **Structured data** from real content only: `Organization` + `WebSite`
  (homepage), `BreadcrumbList` (breadcrumbs), `Service` with an `Offer` when a
  price exists, and `FAQPage` only when genuine FAQs are shown. No fabricated
  ratings/reviews.
- Dynamic `sitemap.xml` of **published, canonical** URLs only — static pages plus
  services, categories and locations from the DB (drafts and `/book/*` excluded);
  `robots.txt` disallows `/admin`, `/api/`, `/book/`.
- Breadcrumbs with `BreadcrumbList` JSON-LD on every content page.
- Correct HTTP status codes (published `200`, missing/draft `404`); custom 404.

## Security

- Argon2id password hashing; JWT access + **rotating, revocable** refresh tokens
  in httpOnly cookies (BFF — tokens never reach browser scripts).
- Deny-by-default admin authorization, re-resolved from the DB on every request.
- Input validation on both client (Zod) and server (Pydantic).
- Rate limiting on login and the public enquiry form; **honeypot** anti-spam.
- Security headers on API and page responses; append-only audit log of admin
  actions; errors never leak internals in production.

## Testing

- **Backend:** `pytest` — 21 tests covering auth, admin RBAC (every router),
  published-only visibility, draft exclusion (API + sitemap), price-edit
  propagation, slug-change redirects, duplicate-slug conflict, enquiry
  validation/honeypot, page publish flow, location↔service associations,
  testimonial visibility, and media type restriction. All pass. `ruff check .`
  clean.
- **Frontend:** `npm run typecheck` (clean) and `npm run build` (clean, 31
  routes). Lint via `npm run lint`.
- Verified end-to-end in a browser, including the acceptance criterion: **editing
  a price in admin updates the public page with no redeploy** (via ISR
  revalidation).

## Deployment & rollback (outline)

- **Backend:** set a real `JWT_SECRET` and a Postgres `DATABASE_URL`; run
  `alembic upgrade head`; serve `uvicorn app.main:app` behind a process manager.
  **Rollback:** `alembic downgrade -1` (migrations are reversible) and redeploy
  the previous image.
- **Frontend:** `npm run build && npm run start` (or Vercel). Set `BACKEND_URL`,
  `NEXT_PUBLIC_SITE_URL`, `REVALIDATE_SECRET`. **Rollback:** redeploy the previous
  build; content changes are data, independent of deploys.
- **Content rollback:** unpublish or edit via the admin — no deploy needed.

## Future enhancements (not required for launch)

- Image uploads are wired (endpoint + validation); admin forms expose image
  fields but a drag-and-drop media library UI could be added.
- `LocalBusiness` structured data per location once a verified address exists
  (intentionally omitted now to avoid fabricating an address).
- Draft **preview** links for editors (drafts are currently visible only via the
  admin edit view).
- Optional: full-text search, pagination on very large catalogues, and a
  dedicated media-manager page.
