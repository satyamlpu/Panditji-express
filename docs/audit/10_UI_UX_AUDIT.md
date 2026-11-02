# 10 — Frontend & UI/UX Audit

Three frontends: the Next.js admin+public site (`frontend/`) and two Expo apps (`customer-app/`, `pandit-app/`). The admin was recently redesigned (Cycle 1–2) to an enterprise standard; the public site and apps are solid MVP.

## Design system & tokens
- **Centralized tokens** — CSS variables in `frontend/src/app/globals.css` (brand: `--sunshine` yellow, `--burgundy`, `--forest` green, plus `--maroon`/`--gold`; semantic: `--bg`/`--surface`/`--ink`/`--muted`/`--line`) surfaced through `tailwind.config.ts`. Admin role tokens added (`--admin-active`=green, `--admin-accent`=burgundy, `--admin-cta`=yellow). **No scattered hex** — good. ✅
- **Brand colors preserved**: Yellow / Burgundy / Green, used with defined roles (green=active/success, burgundy=selected-nav, yellow=highlight). ✅
- **Typography**: Inter is the app font (`--font-sans`), Bricolage Grotesque for site display headings, Noto Sans Devanagari for Hindi. The admin uses Inter for headings via an `.admin-ui` scope; KPI figures use `tabular-nums`. The brief's "Sora for headings" is **not** used (Bricolage is the display face) — a deliberate, documented choice; swap is trivial if desired.

## Icon system
- **Centralized Lucide SVG registry** (`components/admin/icons.tsx`) with an `<Icon name>` helper; nav/kit reference icons by name. Consistent stroke/size (18/20/24). No emoji/AI/raster icons in the admin. ✅ (The mobile apps still use emoji glyphs in a few spots — acceptable for RN, but a shared RN icon set would improve polish.)

## Navigation & workspace separation
- **Admin Control Center** + two independent module shells (Website / App&CRM) with separate sidebars and route namespaces, module switcher, breadcrumbs. Matches the "separate workspaces" requirement. ✅ A third "Platform Governance" workspace is not yet present (see `03`).

## Component coverage (admin kit)
Present: `MetricCard` (with trend), `PageHeader`, `DataTable`+primitives (overflow-safe), `StatusBadge`, `EmptyState`, `LoadingSkeleton`, `Toast` (context), `AdminModal`, `AField`, inline-SVG `charts` (BarDistribution, Donut, ChartCard). Forms use react-hook-form + zod. Data via React Query (polling where live). ✅
Gaps: no shared DatePicker, no bulk-action/table-selection primitive, no dedicated Drawer (modals only), no Pagination component (lists are currently unpaginated — a correctness/scale issue once data grows: see below).

## Responsive
- Admin shell: collapsible sidebar (250/76), off-canvas mobile drawer, `min-w-0` content + `overflow-x-auto` tables → **no horizontal overflow**; verified at 1440/1024/768/390. ✅
- Public site: responsive (Tailwind). Apps: RN responsive by construction.

## States
- **Loading** (skeletons/spinners), **empty** (EmptyState), **error** (ApiError surfaced), **success** (toasts) are all present in the admin kit and used on the dashboards. Some existing list pages use spinners rather than skeletons — minor inconsistency.

## Accessibility (partial)
Positives: global **visible focus** outline (`globals.css`), `aria-current` on active nav, `aria-label`s on icon buttons, `prefers-reduced-motion` honored, semantic headings. Gaps / to verify: dropdown/menu keyboard traversal (module switcher, profile menu use click-outside but not full arrow-key/`Esc` roving focus), modal focus-trap (AdminModal closes on Esc but doesn't trap/restore focus), color-contrast not formally audited (WCAG AA check recommended, especially muted-on-cream and yellow chips), data-table header scopes. No automated a11y tests.

## Performance (frontend)
- Admin is a client-rendered SPA behind auth (fine). Public site is SSR/ISR with a revalidate hook. **Unpaginated admin lists** (services/partners/bookings fetch all) will degrade as data grows — add server-side pagination (the backend list endpoints should gain `limit/offset/cursor`).
- Images: public site uses `next/image` where applicable; admin uploads are local-disk (see `09`/`12`).

## Key recommendations
1. Add **server-side pagination + table selection/bulk actions + a shared DatePicker/Drawer** to the kit (needed for the CRM/bookings scale).
2. Formal **WCAG 2.1 AA pass**: contrast tokens, modal focus-trap, menu keyboard nav, table semantics; add axe/pa11y to CI.
3. Add the **Platform Governance** workspace shell (cheap; reuses the kit).
4. Consider a shared RN icon set + design tokens across the two apps for cross-app consistency.
5. Build the real **Media Library** and **SEO** editors (currently placeholders).
