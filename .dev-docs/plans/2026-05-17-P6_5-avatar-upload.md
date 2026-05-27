# P6.5 — Avatar Upload (`users.image` + baby `avatarUrl`)

**Goal:** Close the spec §1189 promise for `/profile/me`: let users upload their own avatar, and let owner upload an avatar for any baby on `/profile/babies`. P6 punted this; P6.5 finishes it before P7 ships. Self-contained, ~250 LOC.

Why a separate plan, not folded into P6: avatar storage reuses the media subsystem in a non-trivial way (single image, square crop, no `entry_media` link, fixed path) and adding it to P6 would have bloated the page-sweep scope. Keeping it isolated also makes the squash/revert clean if the cropping UX needs rework.

## Scope IN
- Single shared client component `components/features/AvatarUploader.tsx` used in two places:
  - `/profile/me` — uploads own avatar → updates `users.image`
  - `/profile/babies/[id]` (or whatever the per-baby edit surface is) — owner-only, updates `babies.avatarUrl`
- API route `app/api/avatar/route.ts` — single endpoint, `POST` multipart, returns `{ url }`. Permission gate selects target:
  - `target: 'me'` → updates current user's `image`
  - `target: 'baby', babyId` → requires `baby:write` via `assertPermission`, updates `babies.avatarUrl`
- Storage: `data/avatars/users/<userId>.webp` and `data/avatars/babies/<babyId>.webp` — **outside** the `data/media/` tree on purpose (different lifecycle: not part of timeline, not in `media` table, not in trash flow, not in backup sanitize SQL).
- Pipeline (server, Sharp):
  - read multipart → validate mime (image/* only, magic-byte sniff reuses P3's helper)
  - center-crop to square at max(width, height) of source
  - resize to 256×256
  - encode WebP quality 80
  - write to final path **atomically** (write to `<path>.tmp` → `rename`)
  - file size cap 5MB on input; output is always <30KB
- Render in places that show user/baby identity: `app/profile/page.tsx` (user Card), `app/profile/me/page.tsx`, `TimelineCard` (author avatar), baby Tab strips (baby avatar circle). Use `next/image` with the stored URL; fallback to a generated initials circle when null.
- Backup integration: extend P7 `runBackup` Phase 2.3 staging step to also hardlink `data/avatars/` into the zip. Add a manifest section `avatars: [{ kind: 'user'|'baby', id, sha256 }]`. Sanitize SQL doesn't touch `users.image` / `babies.avatarUrl` since those reference paths, not media rows; but the backup runner must skip avatars for **purged** babies (re-check the snapshot DB).
- Tests:
  - unit: `processAvatar(buffer)` returns 256×256 WebP, rejects non-image, rejects > 5MB
  - integration: POST own avatar → file appears on disk, `users.image` updated to `/api/avatar/users/<userId>.webp?v=<mtime>`; POST baby avatar as editor → 404
  - Playwright: profile/me → pick file → preview → submit → avatar shows immediately + after reload
- Cache-busting: store URL with `?v=<mtime>` so swap is visible without long stale-thumbnail issues

## Scope OUT
- In-browser cropping UI (drag-to-position) — v1 just center-crops server-side. If users complain, add `react-easy-crop` later.
- Animated avatars (GIF/APNG) — no, single static frame
- EXIF orientation handling beyond Sharp's default `.rotate()` — Sharp handles it; no extra code
- Avatar history / restore previous — overwrite is fine
- CDN / remote storage — local disk only, family scale
- Reuse `MediaUploader` from P5 — wrong primitive (multi-file, attaches to entry, goes through full media pipeline). Avatar is a different shape; keep them separate.

## Spec sections covered
- §1189 routes table footnote for `/profile/me` ("改 nickname/密码/**头像**")
- §3 schema: `users.image` (line 17, already exists) and `babies.avatarUrl` (line 107, already exists) — no schema change
- §10.4 backup invariants — extended to cover avatar files

## File Structure (new)
```
app/api/avatar/
├── route.ts                         # POST upload
└── [kind]/[id]/route.ts             # GET serve
components/features/
└── AvatarUploader.tsx               # ONLY this — reuses existing components/ui/Avatar
lib/avatar/
├── process.ts                       # Sharp pipeline
├── process.test.ts
└── paths.ts                         # path/url helpers (single source of truth)
```
**Reuse, don't duplicate**: `components/ui/Avatar.tsx` already ships with `{ src, name, size }` props, fallback initials circle, and AvatarGroup. P6.5 adds only the upload interaction layer (`AvatarUploader`) and swaps caller render sites to pass `src={user.image}` / `src={baby.avatarUrl}` to the existing `<Avatar>`.

## Dependencies
- P3 media: file-type magic-byte sniffer helper (extract to `lib/media/sniff.ts` if not already shared); Sharp dep
- P5 design: Button, Spinner, Toast
- P6 profile/me: hosts the uploader
- P7 backup: must merge avatar staging step before P7 ships, or as a P7-followup PR

---

## Phase 0 — Recon

- [ ] **0.1** Confirm `users.image` and `babies.avatarUrl` columns exist and are nullable. (Schema already shows both — verify they have not been removed.)
- [ ] **0.2** Confirm `lib/media/sniff.ts` already exports a magic-byte sniffer (verified during plan-write — it does). Note the exported function name for use in Phase 1.2.
- [ ] **0.3** Decide URL format. Recommended: serve via a tiny route `app/api/avatar/[kind]/[id]/route.ts` (`GET`) that reads from disk and returns with `Cache-Control: public, max-age=31536000, immutable` + `?v=<mtime>` busting. Direct static serving from `public/` is wrong (those files aren't part of the build).
- [ ] **0.4** Confirm baby owner gate `baby:write` matches the per-baby edit page's existing gate (P2b). Don't invent a new action.

**Phase exit:** Notes in `_p6_5-recon.md`.

---

## Phase 1 — Server pipeline

- [ ] **1.1** `lib/avatar/paths.ts`:
  - `avatarFilePath(kind, id, dataDir)` → absolute file path
  - `avatarPublicUrl(kind, id, mtime)` → `/api/avatar/${kind}/${id}.webp?v=${mtime}`
- [ ] **1.2** `lib/avatar/process.ts` `processAvatar(buffer): Promise<Buffer>`:
  - validate input size ≤ 5MB
  - magic-byte sniff (reuse from Phase 0.2)
  - Sharp: `.rotate()` (EXIF) → `.resize(256, 256, { fit: 'cover', position: 'center' })` → `.webp({ quality: 80 })` → buffer
  - throws typed errors for "not image" / "too big" / "decode failed"
- [ ] **1.3** Unit tests: 1×1 PNG, large JPEG, SVG (rejected), HEVC poster as JPEG (accepted), zero-byte file (rejected), 10MB image (rejected).

**Phase exit:** Pure pipeline shippable. Commit `feat(P6.5): avatar processing pipeline`.

---

## Phase 2 — Upload + serve endpoints

- [ ] **2.1** `app/api/avatar/route.ts` `POST`:
  - read multipart `file` + `target` field (`'me'` | `'baby:<babyId>'`)
  - session check → if `target === 'me'`, no extra gate; if baby, `assertPermission(userId, 'baby:write', { babyId })`
  - `processAvatar` → write `<path>.tmp` → `rename` to final
  - update DB: for `me`, `db.update(users).set({ image: avatarPublicUrl('users', userId, mtime) })`; for baby, `db.update(babies).set({ avatarUrl: avatarPublicUrl('babies', babyId, mtime) })`
  - return `{ url }`
- [ ] **2.2** `app/api/avatar/[kind]/[id]/route.ts` `GET`:
  - validate `kind ∈ {'users','babies'}` and `id` is a uuid
  - read file from `avatarFilePath` → return with `Content-Type: image/webp` + long-lived cache headers
  - 404 (unified) if file missing
- [ ] **2.3** Wire `assertWritesAllowed()` (P7) on `POST` — backups should block avatar writes too. Avatar writes are small but still mutate disk.

**Phase exit:** Endpoints functional. Commit `feat(P6.5): avatar upload + serve endpoints`.

---

## Phase 3 — UI

- [ ] **3.1** `components/features/AvatarUploader.tsx` (client):
  - shows current avatar via existing `<Avatar src={currentUrl} name={fallbackName} size="lg" />`
  - `<input type="file" accept="image/*">` hidden behind a Button "更换头像"
  - on file pick: read into `URL.createObjectURL` for instant preview (pass as `src` to `<Avatar>`); on submit, POST to `/api/avatar` with `target`
  - shows Spinner while uploading; toast success/failure; on success, swap to the returned `url` immediately (already cache-busted by mtime)
- [ ] **3.2** Mount in `app/profile/me/page.tsx` (`target='me'`).
- [ ] **3.3** Mount in `app/profile/babies/BabiesAdminClient.tsx` (P2b's existing per-baby admin surface) with `target='baby:<id>'`. Owner-only — page is already gated.
- [ ] **3.4** Sweep callers that render user/baby identity to pass `src` to the existing `<Avatar>`:
  - `components/features/TimelineCard.tsx` (entry author — pass `user.image`)
  - `app/profile/page.tsx` user Card (currently no avatar — add `<Avatar src={me.image} name={me.name} size="lg">`)
  - `app/profile/me/page.tsx` header (same)
  - baby Tab strip on timeline / gallery / calendar (pass `baby.avatarUrl`)

**Phase exit:** Avatars round-trip end-to-end. Commit `feat(P6.5): avatar UI + display sweep`.

---

## Phase 4 — Backup integration

- [ ] **4.1** Coordinate with P7 status: if P7 is shipped, this is a follow-up PR; if P7 is in flight, fold into P7 Phase 2.3.
- [ ] **4.2** Extend `runBackup`:
  - after the snapshot+sanitize step, enumerate surviving `users` (always — all family members are kept) and `babies` (status='active' only)
  - hardlink `data/avatars/users/<userId>.webp` and `data/avatars/babies/<babyId>.webp` into staging when present
  - extend manifest with `avatars: Array<{ kind, id, relativePath, sha256 }>`
- [ ] **4.3** Manifest invariant test: backup of a fixture with 1 user avatar + 2 baby avatars (1 active, 1 trashed) produces a zip with 2 avatar files (user + active baby only).

**Phase exit:** Backup includes avatars. Commit `feat(P6.5): backup avatar integration` (or fold into P7 commit).

---

## Phase 5 — Verify

- [ ] **5.1** Full test suite green.
- [ ] **5.2** Manual: upload own avatar; reload `/timeline`; author chip on every card shows the new avatar. Owner uploads avatar for baby A; baby Tab on `/gallery` shows it.
- [ ] **5.3** Visual regression: re-baseline screenshots for `/timeline`, `/profile`, `/profile/me`, `/gallery` since the avatar swap changes pixels.
- [ ] **5.4** Commit `chore(P6.5): verification`.

---

## Risks

| Risk | Mitigation |
|---|---|
| Avatars served via `/api/avatar/...` bypass CDN; large family timeline = many requests | All requests hit a tiny route returning a ~20KB WebP with `max-age=31536000, immutable`. Browser cache + SW cache (P10) absorb it. Re-evaluate only if it shows up in profiling. |
| User uploads a malicious image that exploits Sharp | Sharp is the same dep P3 already trusts; magic-byte sniff + WebP re-encode strips any container-level payload. SVG explicitly rejected (no path for inline script). |
| Avatar file orphaned after user deletion | **Not actually a concern.** Code review of `app/api/family-members/[id]/route.ts:77-94` confirms member DELETE removes only `sessions` + `family_members` rows; the `users` row is intentionally preserved (FK target for `entries.authorId`, `media.uploadedBy`, `entries.deletedBy`). `users.image` stays valid, the avatar continues to display on historical entries by that author — desired behavior. No cleanup hook needed. |
| `users.image` URL stored with `?v=<mtime>` becomes stale if file is replaced out-of-band | Only the upload endpoint writes the file; mtime updates atomically with the DB update. No out-of-band writes expected on a NAS family deploy. |

## Estimated diff
~280 LOC across ~5 new files + 4 small edits (reduced from 350 after dropping the duplicate `AvatarDisplay` component — reusing existing `components/ui/Avatar`). ~0.5 focused day.
