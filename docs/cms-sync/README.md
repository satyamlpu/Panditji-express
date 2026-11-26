# Website CMS Sync Fix + Thumbnail Management

This change delivers two things end to end, verified locally against the real
backend + a production build of the website:

1. A **root-cause fix** for "Website Management (admin CRM) changes don't reflect
   on the live public website."
2. A professional **thumbnail upload / management system** for Services &
   Categories, centrally managed across the website and the mobile apps.

Screenshots referenced below are in [`./screenshots/`](./screenshots).

---

## 1. The actual root cause of the sync bug

The sync *code path* in this repo is complete and correct — this was **not** a
missing endpoint or a key mismatch:

- A public settings endpoint already exists (`backend/app/api/routers/public.py`
  → `public_settings()`), returning the whole `contact` / `nav` / `footer` / … blobs.
- The admin Contact form writes the entire `contact` object
  (`frontend/src/app/admin/(website)/settings/page.tsx`), the public footer reads
  `contact.phone/email/hours` from that same object
  (`frontend/src/components/site/SiteFooter.tsx`), and **every** admin content
  router already fires on-demand revalidation (`queue_revalidate` / `_revalidate`)
  with cache tags that exactly match the `fetch(..., { next: { tags }})` tags in
  `frontend/src/lib/serverApi.ts`.

So why did the live footer show `Call: +91 00000 00000` /
`hello@panditjiexpress.in` while Hours looked correct?

**Root cause: the public site was serving the original *seed placeholder*
contact values, because the admin's edits were not reaching the data/cache the
public site actually reads.** Concretely:

- `backend/seed.py` seeds `contact = { phone: "+91 00000 00000", whatsapp:
  "+91 00000 00000", email: "hello@panditjiexpress.in", hours: "Mon–Sun, 7am–9pm" }`.
  The live placeholders are *exactly* these seed values. "Hours" only *looked*
  synced because the seed's hours string is byte-identical to what the admin shows.
- The break is at the **cache / environment boundary**, in order of likelihood:
  1. **On-demand revalidation never lands in production.** The backend posts to
     `FRONTEND_REVALIDATE_URL` with `REVALIDATE_SECRET`; this is best-effort and
     was **failing silently** (`backend/app/services/revalidate.py` swallowed all
     errors). If those env vars aren't set to the deployed Vercel frontend with a
     matching secret, published edits only surface on the slow time-based ISR
     window (1 hour) — i.e. "my changes don't show up."
  2. **A stale frontend deployment** (the live footer still rendered the pre-#13
     "experienced pandit" string even though #13 is merged) — a deploy-pipeline
     issue, not a content issue.
  3. If the admin CRM and the public site are ever pointed at **different
     databases**, the admin writes to one and the public reads the (seed-era) other.

The fix therefore makes the pipeline **correct, observable, and self-diagnosing**
rather than silently failing, and verifies the full publish→reflect flow works
when the environment is right (see §8).

> ⚠️ **Data note (not changed):** the admin-entered email `panditjiiexpress@gmail.com`
> has a double "ii" and looks like a typo. We did **not** silently edit user
> data — please review it in admin → Settings.

---

## 2. The complete sync fix

- **Observability (the core gap).** `revalidate.py` now records the outcome of
  every revalidation attempt (`LAST_RESULT`), logs success/failure explicitly,
  and distinguishes "not configured" / "secret rejected (403)" / "unreachable".
- **A live diagnostic:** `GET /api/v1/admin/system/sync-status` actively probes
  the frontend webhook and reports whether publish→reflect is wired, the DB
  target (credentials redacted), the media backend, and the last publish result.
- **Admin UI:** a new **Sync & Activity** page
  (`frontend/src/app/admin/(website)/activity/page.tsx`) surfaces this in plain
  language — "Published changes appear on the website instantly" vs. a warning
  with the exact env vars to fix. The silent failure is now visible to an operator.
- **Startup warnings** (`backend/app/core/config.py`): production boot now warns
  when `FRONTEND_REVALIDATE_URL` is unset or `MEDIA_STORAGE_BACKEND=local`.
- **Coverage confirmed** across every Website Management module (homepage,
  banners, services, categories, pages, pricing, testimonials, FAQs, SEO, footer,
  contact): each admin write already queues the correct tags; we verified the
  tag↔fetch mapping is complete and added revision/audit recording on top.
- **Draft / Published / Unpublished** lifecycle was already honoured (only
  `published` is returned publicly); services & categories expose publish /
  unpublish controls, now with audit + revision records on each transition.

No "temporary frontend patches" (nothing was forced to `no-store`); the design
stays tag-based ISR + on-demand revalidation, which is the correct mechanism.

---

## 3. Thumbnail management (Services & Categories)

- **Media Library** (`frontend/src/app/admin/(website)/media/page.tsx`): upload
  (click or **drag-and-drop**, multi-file), upload **progress**, grid with
  **search + pagination**, inline **alt-text** editing, and **usage-checked
  delete** (refused while attached to a published item).
- **MediaPicker** (`frontend/src/components/admin/MediaPicker.tsx`) on the
  Service & Category editors: upload from device, drag-and-drop, **crop &
  reposition** to 16:9 (drag + zoom, exported via canvas), **pick from the Media
  Library**, **preview**, **replace**, **remove**, **alt text**, progress, and
  client-side **type + size validation** (JPG/PNG/WebP, ≤ 8 MB).
- **Optimisation** (`backend/app/services/media_storage.py`, Pillow): every
  upload is decoded + validated (a renamed non-image is rejected), the **original
  is preserved**, and optimised **WebP** `display` (≤ 1600px) and `thumb` (≤ 480px)
  variants are generated. Recommended 16:9 / min 1280×720 is a *warning*, not a
  hard block. (Demo: a 1600×900 PNG → a 6 KB WebP.)

## 4. Media Library integration

The thumbnail system **reuses the existing media upload infra** rather than
building a parallel one: the previous `admin_media` endpoint is extended into a
full library backed by a new `media_asset` table, and a new `PublicMediaStore`
(local `/uploads` in dev, **public Supabase bucket** in prod) that mirrors the
proven KYC storage pattern — but kept **separate** from the private KYC store
(different bucket, public vs. authenticated-proxy access).

## 5. Website + mobile integration

- **Single source of truth:** service/category thumbnails live once in the Media
  Library; `service.thumbnail` / `category.thumbnail` are served by the public
  API **and** the marketplace discovery API (`/api/v1/mp/discovery/services`),
  which the apps already consume — so web and apps read the same asset.
- **Public site:** a `Thumb` component with a **professionally designed neutral
  placeholder** (brand-tinted panel + mandala ornament, never an emoji, never a
  broken image) renders thumbnails on service cards, the catalog, category /
  location mini-cards, the homepage grid, and the puja detail hero (+ the new
  Hindi title).
- **Customer app:** service grid and booking screen use the CMS thumbnail when
  set, falling back to the bundled catalog photo / designed placeholder. Edits
  are **data-only** (no theme/colour files) to avoid conflicting with the open
  mobile-palette PR.

## 6. Storage & security

- Admin-only uploads (router dependency). Validation is **MIME + extension +
  size + a real Pillow decode**, so a script renamed `.png` never survives.
- Object keys are **server-generated** (`secrets` + extension); the client
  filename never builds a path.
- **Public marketing images are kept separate from private KYC documents**
  (different store/bucket/access model). Existing RLS and DB security are
  untouched.
- **Deletion is blocked** while an image is attached to a *published* service or
  category; draft references are detached first.

## 7. DB & API change report

**New tables** (migration `backend/alembic/versions/d4f7b1a9c2e8_*.py`,
Postgres + SQLite safe, fully additive / backward-compatible):

- `media_asset` — the Media Library (storage keys, URLs, dimensions, alt text).
- `content_revision` — per-entity content snapshots (revision history).

**Altered tables** (all new columns nullable; existing rows need no backfill):

- `service`: `title_hi`, `thumbnail_media_id` (FK → `media_asset`,
  `ON DELETE SET NULL` on Postgres), `thumbnail_url`, `thumbnail_alt`.
- `category`: `thumbnail_media_id`, `thumbnail_url`, `thumbnail_alt`.

The thumbnail URL/alt are denormalised onto the entity for fast public reads
(no join); `thumbnail_media_id` links back to the library for usage checks.

**New / changed API** (all existing endpoints, auth, and booking logic
preserved):

- `POST/GET/PATCH/DELETE /api/v1/admin/media` (+ `/{id}/usage`) — Media Library.
- `GET /api/v1/admin/system/sync-status`, `/system/audit`, `/revisions` — sync
  health, audit log, revision history.
- `thumbnail` + `title_hi` added to public service/category payloads, admin
  service/category payloads, and the mobile discovery `/services` response.

Reviewed against PR #11 (prod migration, head `e7a1b2c3d4f5`) and PR #12 (mobile
EAS) — this migration descends from current `main`'s head (`e1a2b3c4d5f6`) and
touches only new tables + additive columns, so it does not conflict with #11's
file and can be applied independently.

## 8. E2E test results (all local, real data)

- **Backend:** `pytest` — **72 passed, 6 skipped** (11 new tests covering upload/
  optimise, thumbnail roundtrip, public exposure, usage-checked delete, revisions,
  sync-status, audit). `ruff` clean.
- **Frontend:** `next build` ✓, `tsc --noEmit` ✓, `next lint` ✓.
- **Apps:** `tsc --noEmit` ✓ (customer-app).
- **Browser E2E** (prod build of the site on `:3100` against the backend on
  `:8110`):
  - **Sync:** footer contact changed from the seed placeholder
    (`+91 00000 00000` / `hello@panditjiexpress.in`) to admin-saved values
    (`+91 7703 999 469` / `care@panditjiexpress.com`) **after an admin publish,
    with no rebuild** — screenshot `01`, and §Sync panel reports *"Published
    changes appear on the website instantly"* (`05`).
  - **Thumbnail:** uploaded an image → optimised to a 6 KB WebP → attached to the
    published *Ganesh Puja* service → it renders on the public puja detail page
    live (`02`), in the redesigned admin services table (`03`), and in the Media
    Library (`04`); the same asset is returned by the mobile discovery API.
  - **Security:** deleting an in-use image returns `409`; a non-image upload is
    rejected (`400`); an unsupported type is rejected (`415`).

## 9. Production deployment requirements (for you to execute — NOT done here)

> Nothing below was run against production. No prod migration, no prod DB
> permission change, no deploy was performed.

1. **Run the migration** on the production database:
   ```bash
   cd backend && alembic upgrade head   # applies d4f7b1a9c2e8
   ```
   It is additive (new tables + nullable columns); existing rows are unaffected.
2. **Set backend env vars** (this is the core of the sync fix):
   - `FRONTEND_REVALIDATE_URL=https://<your-vercel-domain>/api/revalidate`
   - `REVALIDATE_SECRET=<a strong secret>` — **must match** the frontend's
     `REVALIDATE_SECRET`.
   - `MEDIA_STORAGE_BACKEND=supabase`, `SUPABASE_MEDIA_BUCKET=<public bucket>`
     (reuse `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`). Create the bucket as
     **public**. Optionally `MEDIA_PUBLIC_BASE_URL=<cdn or public base>`.
3. **Confirm admin CRM and the public site use the same backend/DB.** After
   deploy, open admin → **Sync & Activity**; it should read *"Published changes
   appear on the website instantly."* If not, it names the exact misconfig.
4. **Cache/CDN:** no extra step — on-demand revalidation + time-based ISR handle
   freshness. If a CDN sits in front of Vercel, ensure it honours Next.js cache
   headers (don't force a long immutable TTL on HTML).
5. Optionally re-run the website build so the stale pre-#13 bundle is replaced.

## 10. The PR

Branch `fix/website-cms-sync-thumbnail-management` → `main`. **Not merged** (per
instructions). Checks: backend pytest + ruff, `next build` + `tsc` + lint, and
`tsc` on the customer app all pass locally.
