# P6 — View-only Pages: Gallery + Calendar + Profile/Me

**Goal:** Ship the three remaining mobile-shell pages that P5 explicitly deferred and that the Tabbar still renders as `disabled`. After P6: `/gallery` shows ready media grouped by month with a baby Tab; `/calendar` shows a month grid with dots on days that have entries; `/profile/me` lets the signed-in user edit `name`, change their password, and (later) upload an avatar. P6 is **view-only / self-service** — no owner-only surfaces, no `baby_member_permissions` UI (those are P7+), no new tables.

## Scope IN (this plan)
- `app/gallery/page.tsx` — RSC, baby Tab via `?babyId=`, month-grouped grid of `media.status='ready'` for `baby.status='active'`
- `app/calendar/page.tsx` — RSC, baby Tab via `?babyId=`, month grid via `?ym=YYYY-MM`, dot on days where an active entry exists; tap a day → link to `/timeline?babyId=&date=YYYY-MM-DD` (the timeline date filter is also part of this plan, small additive change)
- `app/profile/me/page.tsx` — server page; `EditMeForm` client component for name + password change (better-auth `changePassword`)
- `components/mobile/Tabbar.tsx` — flip `gallery` and `calendar` from `disabled: true` to live routes
- `components/features/GalleryGrid.tsx`, `components/features/MonthCalendar.tsx`, `components/features/EditMeForm.tsx`
- `lib/db/queries/gallery.ts` and `lib/db/queries/calendar.ts` — single-purpose RSC queries
- Tests: unit for `groupMediaByMonth` + `buildMonthGrid`; RTL for `EditMeForm`; one Playwright smoke per page (tabbar nav → page renders → Tab switches baby)

## Scope OUT (deferred)
- Avatar upload UI (needs a single-purpose image endpoint reusing `lib/media`; defer to P6.5 if it grows beyond a `<input type="file">` + reuse of `UploadButton`). P6 ships the field placeholder + the name/password flows only.
- `/profile/data` (backup export, log viewer) — P7, owner-only
- `/profile/family/permissions` UI — P7+
- Calendar "agenda for tapped day" inline drawer — out; we just link to `/timeline?date=…`
- Gallery lightbox / swipe viewer — out; tap a tile links to `/entry/[id]` when the media is attached, otherwise opens the raw image URL in a new tab (裸照片 case from spec §1618)
- Infinite scroll / pagination for gallery — out; first cut shows last 12 months; "load older" is a future task
- Pull-to-refresh on these pages — P5's `PullToRefresh` exists but timeline doesn't use it either; defer

## Spec sections covered
- §8.1 routes table: `/gallery`, `/calendar`, `/profile/me`
- §1011–1012 permission flow rows (gallery + calendar RSC queries respect `baby.status='active'` + `media.status='ready'` / `entries.status='active'`)
- §1591 (#28) soft-delete invariant: trashed baby's media/entries vanish from gallery & calendar
- §1618 (#41) bare-photo case: media without `entry_media` still appears in gallery
- §1221 "首次登录后在 /profile/me 改密码"

## File Structure (new)
```
app/
├── gallery/
│   └── page.tsx
├── calendar/
│   └── page.tsx
└── profile/
    └── me/
        └── page.tsx
components/features/
├── GalleryGrid.tsx
├── MonthCalendar.tsx
└── EditMeForm.tsx
lib/db/queries/
├── gallery.ts
└── calendar.ts
```

## Coordination
- P5 must reach **Phase 7 (Mobile Shell)** before P6 starts — `AppShell` + `Tabbar` + design tokens are direct dependencies. As of plan-write the components exist on disk (`components/mobile/Tabbar.tsx`, `AppShell.tsx`); verify in Phase 0.
- No P4 dependency. No `baby_member_permissions` reads needed (covered by P5's gating — these pages only filter by `babies.familyId` + `babies.status='active'` + content status).

---

## Phase 0 — Reconnaissance

- [ ] **0.1** Confirm `components/mobile/{AppShell,Tabbar}.tsx` exist and accept `title` / current route highlighting. If P5's Tabbar API changed, update §Phase 1 task accordingly.
- [ ] **0.2** Confirm `media.takenAt` column exists (`lib/db/schema.ts:212`) and is populated by P3 uploads. If many rows have NULL `takenAt`, plan falls back to `createdAt` — note which one is used per query.
- [ ] **0.3** Confirm better-auth exposes a password-change API in the version pinned in `lib/auth/server.ts` (`auth.api.changePassword` or equivalent). If not, P6 ships name-only edit and pushes password change to P6.5.
- [ ] **0.4** Re-read spec §1011–1012 + §1591 + §1618 to lock the join shape (baby active + content not trashed; bare media OK).
- [ ] **0.5** Decide tap-target for gallery tile: if attached → `/entry/[id]`; if bare → open `media` URL. Verify via `entry_media` JOIN.

**Phase exit:** No new files; written notes in `_p6-recon.md` (optional, mirrors `_p5-recon.md`).

---

## Phase 1 — Tabbar: enable the two routes

- [ ] **1.1** In `components/mobile/Tabbar.tsx`, remove `disabled: true` from the `gallery` and `calendar` items. Keep icons as-is.
- [ ] **1.2** Verify Tabbar active-state highlighting works for the new routes (it already uses `pathname.startsWith`).
- [ ] **1.3** Tabbar test: extend `Tabbar.test.tsx` to assert gallery + calendar render as `<a>` not `<span aria-disabled>`.

**Phase exit:** Tapping gallery/calendar from any page navigates (will 404 until Phase 2/3). Commit `feat(P6): enable gallery + calendar tabs`.

---

## Phase 2 — Gallery

- [ ] **2.1** `lib/db/queries/gallery.ts`: export `listGalleryMedia({ db, babyId, limitMonths = 12 })` returning `{ id, type, mimeType, width, height, durationSec, takenAt, createdAt, entryId | null }[]` sorted desc by `coalesce(takenAt, createdAt)`. Join `entry_media` LEFT to get `entryId` (null for bare). Filter: `media.babyId = ?`, `media.status = 'ready'`, baby is active (enforced by RSC caller passing only active baby ids).
- [ ] **2.2** Pure helper `groupMediaByMonth(rows)` → `Array<{ ym: 'YYYY-MM', label: '2026 年 5 月', items: Media[] }>`. Test in `lib/db/queries/gallery.test.ts` with fixtures (boundary at month edges, null `takenAt`, empty list).
- [ ] **2.3** `app/gallery/page.tsx` (RSC): mirrors `app/timeline/page.tsx` shape — session → familyMember → active babies → 0-babies redirect to `/onboarding/baby` → resolve `selectedBabyId` from `?babyId=` → call `listGalleryMedia` → render `<AppShell title="画廊">` with baby Tab strip (reuse the same baby Tag/Chip pattern as timeline) and `<GalleryGrid groups={...} />`.
- [ ] **2.4** `components/features/GalleryGrid.tsx` (client OK, but prefer server — only `next/image`, no state needed): per month group render `<section>` with month label, then a CSS grid `grid-cols-3 gap-[var(--space-1)]`. Each tile = `<Link>` wrapping a square thumb (`object-cover aspect-square rounded-[var(--radius-md)]`). **Reuse `components/media/MediaImage`** for the tile thumb (it already wraps the `/api/media/[id]?size=thumb` URL). **Do NOT reuse `components/media/Gallery`** — that component is per-entry use and has a built-in lightbox that conflicts with our "tap → /entry/[id]" intent. Video tiles overlay a play glyph + `mm:ss` from `durationSec`. Tap target: `entryId ? '/entry/' + entryId : raw media url with target=_blank`.
- [ ] **2.5** Empty state: when `groups.length === 0`, render a Card with "还没有照片，去[新建记录](/entry/new)添加一条".
- [ ] **2.6** Smoke test: `tests/e2e/gallery.spec.ts` — log in, tap 画廊 tab, see month header + at least one tile (or empty state on fresh DB).

**Phase exit:** `/gallery` renders with month groups and baby Tab. Commit `feat(P6): gallery page (month groups + baby tab)`.

---

## Phase 3 — Calendar

- [ ] **3.1** `lib/db/queries/calendar.ts`: export `listEntryDays({ db, babyId, ym, timezone })` → `Set<string>` of `'YYYY-MM-DD'` strings (in **family timezone**, not UTC) for days where `entries.babyId = ? AND status='active' AND occurredAt BETWEEN <ym start> AND <ym end>`. Use **`date-fns-tz`** (`zonedTimeToUtc`) for the boundary conversion — `occurredAt` is a unix epoch (UTC), but month boundaries and day-of-week must be evaluated in the family's local timezone, otherwise a record created at 23:30 Asia/Shanghai will be misfiled as the next day on a UTC server. Read `config.app.timezone` from `loadConfig({ dataDir })` (the field **already exists** at `lib/config/schema.ts:19` with default `'Asia/Shanghai'`) — no schema change required.
- [ ] **3.2** Pure helper `buildMonthGrid(ym, timezone)` → 6-row × 7-col matrix of `{ date: Date, inMonth: boolean, iso: 'YYYY-MM-DD' }`. Sunday-first to match the spec's "7 列网格 + 星期标题行". Test boundaries (Feb in leap year, month starting Sunday, **23:30 entry on month-end in Asia/Shanghai while server clock is UTC**).
- [ ] **3.3** `app/calendar/page.tsx` (RSC): same prelude as gallery; reads `?ym=YYYY-MM` (default = current month). Renders `<AppShell title="日历">`, baby Tab, a header row with prev/next month links (preserve `babyId` in href), weekday header, then the 6×7 grid. For each cell: muted text when `!inMonth`; today gets `bg-[var(--color-accent)]/15 ring-1`; days in `daySet` get a small dot. Wrap each in-month cell with a `<Link>` to `/timeline?babyId=&date=YYYY-MM-DD`.
- [ ] **3.4** `components/features/MonthCalendar.tsx` — extract the grid render (no state, pure props in). Keeps the page file thin.
- [ ] **3.5** **Timeline date filter** (small additive change in `app/timeline/page.tsx`): accept `?date=YYYY-MM-DD`; when present, scope `entries.occurredAt` to that day boundary and show a "回到全部" chip at the top that clears the param. Keep all other behavior identical.
- [ ] **3.6** Smoke test: `tests/e2e/calendar.spec.ts` — log in, tap 日历, prev/next month works, today is highlighted; tap a dotted day → lands on `/timeline?date=…` showing only that day's entries (or empty state).

**Phase exit:** `/calendar` renders + timeline accepts `?date=`. Commit `feat(P6): calendar page + timeline date filter`.

---

## Phase 4 — Profile / Me

- [ ] **4.1** `app/profile/me/page.tsx`: session → load `users` row + `familyMembers` row → render `<AppShell title="我的资料">` with a `<Card>` summary (name, @username, role tag) and an `<EditMeForm initial={{ name, username }} />`.
- [ ] **4.2** `components/features/EditMeForm.tsx` (client): React Hook Form + zod resolver. Two sections in one Card each:
  - **基本资料**: editable `name` input, read-only `username` (spec: username is owner-assigned). Submit = server action `updateMyName(name)`.
  - **修改密码**: `currentPassword`, `newPassword`, `confirmNewPassword`. Submit = server action `changeMyPassword(...)`. Min length 8; client-side confirm-match check; show inline error from server.
  - Use P5's `Button`, `Input`, `Toast` (success: "已保存"; failure: server message).
- [ ] **4.3** Server actions in `app/profile/me/actions.ts`:
  - `updateMyName(formData)` — zod-validate, `db.update(users).set({ name }).where(eq(users.id, session.user.id))`, `revalidatePath('/profile')` + `revalidatePath('/profile/me')`.
  - `changeMyPassword({ currentPassword, newPassword })` — delegate to better-auth's `auth.api.changePassword` (verified in Phase 0.3). On failure, surface "当前密码不正确" (do not leak which field). On success, do not invalidate the current session (user stays logged in).
- [ ] **4.4** Link from `app/profile/page.tsx`: the existing `{ href: '/timeline', label: '回到时间线' }` list — insert a `{ href: '/profile/me', label: '我的资料' }` row at the top.
- [ ] **4.5** RTL test `EditMeForm.test.tsx`: submit name → expects action called with new name; password mismatch → expects inline error without action call; server returns error → toast shows the message.
- [ ] **4.6** Playwright smoke `tests/e2e/profile-me.spec.ts`: log in → /profile → tap 我的资料 → change name → reload → see new name → change password → log out → log in with new password.

**Phase exit:** `/profile/me` ships with name + password change. Commit `feat(P6): profile/me — edit name + change password`.

---

## Phase 5 — Verification & cleanup

- [ ] **5.1** Run full unit + RTL suite (`pnpm vitest run`) → green.
- [ ] **5.2** Run Playwright (`pnpm test:e2e` or project equivalent) → 3 new specs green plus all existing.
- [ ] **5.3** Manual pass on a seeded DB: switch between babies on gallery + calendar; verify a baby with zero media shows empty state; verify a trashed baby disappears from both Tab strips immediately (covers spec invariant #28).
- [ ] **5.4** Lighthouse / a11y spot-check on the three new pages: tab order works, calendar grid has `role="grid"` + cells have `aria-label="YYYY 年 M 月 D 日"`, gallery tiles have `alt` (filename fallback), form fields have visible labels.
- [ ] **5.4b** Visual regression baselines (per spec §11.4): Playwright screenshots for `/gallery`, `/calendar`, `/profile/me` at 375 / 768 / 1024. Commit baselines to `tests/visual/__snapshots__/`.
- [ ] **5.5** Update `docs/superpowers/specs/2026-05-15-babyloom-v2-rebuild-design.md` §8.1 routes table footnote (or a small "Implemented" column) noting these three routes are live as of P6.
- [ ] **5.6** Final commit `chore(P6): verification + spec status update`.

---

## Risks & open questions

| Risk | Mitigation |
|---|---|
| `media.takenAt` is mostly NULL because P3 doesn't extract EXIF reliably | Phase 0.2 audit; query falls back to `createdAt` so gallery still sorts sensibly. Real EXIF extraction is a P3 follow-up, not P6. |
| better-auth password-change API surface differs from the assumed `auth.api.changePassword` | Phase 0.3 verifies; if absent, ship Phase 4 without password section + open a P6.5 stub. |
| Timeline `?date=` filter is a scope creep into an existing page | Kept to ~10 lines of additive code (single `and(...)` clause + a chip). Reverting is trivial if it regresses. |
| Calendar's "tap day → /timeline?date=" needs the timeline filter to exist | Sequenced — Phase 3.5 ships the filter in the same commit as Phase 3 calendar work. |
| Avatar upload deferred but UI implies it | Profile/me page does **not** render an avatar slot in P6. Adding it now would pull in image cropping + endpoint design. |

## Out-of-band notes

- This plan deliberately omits a P5-style "design polish" pass on the three new pages — they should look correct because they consume P5's `AppShell` + tokens + primitives. If a page looks generic after Phase 4, that is feedback for P5's component library, not new P6 work.
- Total estimated diff: ~600 LOC across ~10 new files + 3 small edits. One engineer, ~1 focused day per phase.
