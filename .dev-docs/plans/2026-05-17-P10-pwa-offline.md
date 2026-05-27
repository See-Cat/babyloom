# P10 — PWA + Offline Fallback

**Goal:** Ship installable PWA (manifest + service worker via Serwist) with **read-only offline fallback** for the two most-used pages (`/timeline` recent 50 entries, `/gallery` last seen month). No offline writes, no background sync, no push notifications. This is the last planned P — after P10 the app is fully deployed, installable, and survives the NAS being briefly unreachable.

## Scope IN
- `next.config.ts`: integrate Serwist plugin (`@serwist/next`)
- `app/sw.ts` — service worker entrypoint:
  - precache the app shell (HTML + tokens.css + critical JS chunks emitted by Next.js)
  - runtime cache for `/timeline` and `/gallery` HTML responses → `NetworkFirst` with 3s timeout, 7-day max age, max 5 entries
  - runtime cache for `/api/media/*?size=thumb` → `CacheFirst`, 30-day max age, max 500 entries (~LRU-evicts when full)
  - exclude all `POST`/`PUT`/`DELETE` from caching
  - exclude `/api/auth/*`, `/api/backup`, `/api/log/client`
- `public/manifest.webmanifest`:
  - `name: '小日子 BabyLoom'`, `short_name: '小日子'`
  - `display: 'standalone'`, `start_url: '/timeline'`, `theme_color` and `background_color` from `tokens.css`
  - icon set (192, 512, maskable 512) — placeholder SVG → PNG export pipeline in `scripts/build-icons.ts`
- `<link rel="manifest">` + `<meta name="theme-color">` in `app/layout.tsx`
- Offline fallback page `app/offline/page.tsx` — static, no data, shown when SW has no cache for the requested URL
- `OfflineBanner.tsx` (client) — fixed top banner with "离线模式 · 显示缓存内容" when `navigator.onLine === false`; auto-hides when back online
- `useNetworkStatus()` hook in `lib/hooks/`
- Install prompt: small chip "添加到主屏幕" in `/profile` shown only when `beforeinstallprompt` fires; tap → `prompt()`; respect dismissal in `localStorage`
- Tests:
  - unit: `useNetworkStatus` reflects `online`/`offline` events
  - Playwright: install manifest is reachable & valid (`curl /manifest.webmanifest` → 200, valid JSON)
  - Playwright: load `/timeline` online → go offline (Playwright route abort) → reload → cached HTML renders + offline banner shows
  - Playwright: navigate to a not-yet-visited route while offline → offline fallback page renders, not a browser error

## Scope OUT
- **Offline writes / background sync** — explicitly out. The app must refuse new entries when offline (show toast "离线状态,无法保存") rather than queue them. Queueing is a hard problem (conflict resolution, media upload state) and not in spec.
- Push notifications — out, no use case in spec
- Periodic background sync — out (browser support is thin)
- Pre-caching every page — too aggressive for a media-heavy app; only the two scoped pages
- Custom install UI flow beyond the chip — `beforeinstallprompt` only fires on Chrome/Edge; Safari uses iOS "Add to Home Screen" manually. We document this rather than emulate it.
- Workbox migration — Serwist is the spec choice (§2.1 "Serwist (next-pwa 继任者)")
- Offline mode for `/calendar` and `/profile/*` — leave them as "needs network"; the offline fallback page covers them

## Spec sections covered
- §2.1 row "PWA → Serwist"
- The general "NAS may be momentarily unreachable; PWA preserves the most-recent timeline view" implicit requirement (家用网络偶发不稳定)

## File Structure (new)
```
app/
├── sw.ts
├── offline/
│   └── page.tsx
public/
├── manifest.webmanifest
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── icon-maskable-512.png
components/ui/
└── OfflineBanner.tsx
lib/hooks/
└── useNetworkStatus.ts
scripts/
└── build-icons.ts              # generates PNGs from one SVG source
```

## Dependencies
- P5 design tokens for `theme_color` / `background_color`
- P9 deployment: production headers from nginx must allow SW registration (no `Service-Worker-Allowed` issues — default OK when served from same origin)
- All prior P's must be shipped — PWA is the closing layer

---

## Phase 0 — Recon

- [ ] **0.1** Check current `next.config.ts` for any existing PWA config (almost certainly none). Confirm no conflict with `@serwist/next`.
- [ ] **0.2** Confirm we have access to one master SVG icon (or commission one). If only emoji-style placeholder exists, document it and proceed — icons can be swapped later without re-architecting.
- [ ] **0.3** Confirm `app/layout.tsx` is the right place for the manifest `<link>` (it is, in App Router).
- [ ] **0.4** Identify the `theme_color` and `background_color` token values from `styles/tokens.css` (P5) so the manifest matches the app shell visually.
- [ ] **0.5** Decide caching strategy per URL class (table in scope above). Confirm with a quick read of Serwist docs — strategy names match Workbox (`NetworkFirst`, `CacheFirst`, `StaleWhileRevalidate`).

**Phase exit:** Notes in `_p10-recon.md`.

---

## Phase 1 — Serwist setup + manifest

- [ ] **1.1** Install `@serwist/next` + `serwist`.
- [ ] **1.2** Update `next.config.ts` to wrap default config with `withSerwist({ swSrc: 'app/sw.ts', swDest: 'public/sw.js' })`.
- [ ] **1.3** Create `app/sw.ts` with the precache + runtime cache setup. Start with the **minimum** that compiles — no caching rules yet, just `installSerwist({ precacheEntries: self.__SW_MANIFEST })`.
- [ ] **1.4** `public/manifest.webmanifest` with all required fields. Validate at https://manifest-validator.appspot.com (manual check, not in CI).
- [ ] **1.5** `app/layout.tsx`: add
  ```html
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content="<token value>" />
  ```
- [ ] **1.6** Generate icons (Phase 1 placeholder set is fine; production swap can be a separate one-line PR).
- [ ] **1.7** Smoke: build the app → `curl http://localhost:3000/sw.js` → see a SW file. Install in Chrome via "Install app". Verify offline → app shell still loads (only the shell — no data yet).

**Phase exit:** App is installable. Commit `feat(P10): serwist PWA setup + manifest`.

---

## Phase 2 — Runtime cache strategies

- [ ] **2.1** Extend `app/sw.ts` with the runtime route handlers:
  ```ts
  registerRoute(
    ({ url }) => url.pathname === '/timeline' || url.pathname === '/gallery',
    new NetworkFirst({ cacheName: 'pages', networkTimeoutSeconds: 3, plugins: [new ExpirationPlugin({ maxEntries: 5, maxAgeSeconds: 7 * 24 * 60 * 60 })] })
  );
  registerRoute(
    ({ url }) => url.pathname.startsWith('/api/media/') && url.searchParams.get('size') === 'thumb',
    new CacheFirst({ cacheName: 'thumbs', plugins: [new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60 })] })
  );
  ```
- [ ] **2.2** Explicit deny list (don't cache anything else from `/api/`):
  ```ts
  registerRoute(({ url }) => url.pathname.startsWith('/api/') && !(url.pathname.startsWith('/api/media/')), new NetworkOnly());
  ```
- [ ] **2.3** Method guard: only `GET` ever enters a cache. Serwist defaults to this; double-check no rule overrides.
- [ ] **2.4** Manual test: visit `/timeline` online → take Chrome devtools "Offline" → reload → see the timeline render from cache. Take offline → visit `/profile` (uncached) → see the offline fallback page (Phase 3 ships the fallback; until then, browser error is acceptable).

**Phase exit:** Cached pages load offline. Commit `feat(P10): runtime cache for timeline/gallery + thumbs`.

---

## Phase 3 — Offline fallback page + banner + hook

- [ ] **3.1** `app/offline/page.tsx`: static, no data deps. A Card with "无法连接到家庭服务器" + retry button (`location.reload()`).
- [ ] **3.2** Add to `app/sw.ts` a navigate-fallback to `/offline` for uncached navigation requests when the network fails:
  ```ts
  setDefaultHandler(new NetworkOnly());
  setCatchHandler(async ({ event }) => {
    if (event.request.mode === 'navigate') {
      return (await caches.match('/offline')) ?? Response.error();
    }
    return Response.error();
  });
  ```
  Precache `/offline` by adding it to Serwist's precacheEntries.
- [ ] **3.3** `lib/hooks/useNetworkStatus.ts`: subscribes to `online` / `offline` events; returns boolean. SSR-safe (defaults to true).
- [ ] **3.4** `components/ui/OfflineBanner.tsx`: client, reads `useNetworkStatus()`, renders a fixed top banner when offline. Uses `--color-warn` background.
- [ ] **3.5** Mount `<OfflineBanner />` in `components/mobile/AppShell.tsx` so all main pages show it.
- [ ] **3.6** RTL test: simulate `offline` event → banner appears; `online` event → disappears.

**Phase exit:** Offline UX in place. Commit `feat(P10): offline fallback page + banner`.

---

## Phase 4 — Install prompt

- [ ] **4.1** `components/features/InstallChip.tsx` (client):
  - capture `beforeinstallprompt` into state (preventDefault'd)
  - if captured + not dismissed in `localStorage` → render a small chip in `/profile` "添加到主屏幕 →"
  - on tap → `event.prompt()` → on user accept/decline, set `localStorage.babyloom_install_dismissed = '1'`
- [ ] **4.2** Mount in `app/profile/page.tsx` between the user Card and the link list.
- [ ] **4.3** Manual test: Chrome → fresh profile → chip appears → tap → native prompt → install → chip disappears on next visit.

**Phase exit:** Install prompt shipped. Commit `feat(P10): install-to-home chip`.

---

## Phase 5 — Refuse-write-when-offline + verification

- [ ] **5.1** Gate **business-data mutations** behind `requireOnline()` — **not** every server action. Explicit allow-list of pages/components to patch:
  - `components/features/EntryComposer.tsx` (entry create + edit)
  - `components/media/UploadButton.tsx` (media upload)
  - `components/features/EditMeForm.tsx` (P6 — name + password)
  - `components/features/AvatarUploader.tsx` (P6.5)
  - `components/features/PermissionCell.tsx` (P8)
  - `components/features/BackupPanel.tsx` (P7 backup trigger)
  - Trash actions (restore/purge/empty)
  - **Allow offline (do not gate):** `/api/auth/*` (login attempts must reach the server to fail cleanly), `/api/log/client` (silently drop on `navigator.onLine === false` from the reporter itself — already handled in P7 client error helper)
  - Single helper: `lib/client/require-online.ts` `requireOnline(toast): boolean`. Returns `false` + emits toast "当前离线,无法保存。请检查网络后重试。" when offline.
- [ ] **5.2** Document in README: "BabyLoom 离线时只读。新增/编辑需在线。"
- [ ] **5.2b** **HEVC user-facing warning** (spec §1770 risk): in `components/media/UploadButton.tsx` (or wherever client-side file selection happens), detect `file.type === 'video/quicktime'` or `.mov` / `.hevc` / `.h265` extension and show a non-blocking toast: "iOS 拍摄的 HEVC 视频在部分浏览器无法播放。如需在所有设备上观看,建议先转码为 H.264。" Upload still proceeds — this is information, not a gate. Server-side sniffing already produces a correct `mimeType`; this is purely a UX nudge.
- [ ] **5.3** Playwright e2e:
  - load `/timeline`, install SW, go offline, reload → cached timeline
  - try to create an entry offline → toast appears, no network attempt fires
  - go back online → submit works
- [ ] **5.4** Final commit `chore(P10): verification + offline-write guard`.

---

## Risks

| Risk | Mitigation |
|---|---|
| Service worker caches stale pages forever | `NetworkFirst` with 3s timeout for HTML; `ExpirationPlugin` caps both age and count. Worst case: user pulls to refresh. |
| Cached HTML references JS chunks that the new deploy no longer has → broken page | Serwist precaches versioned static assets with each build. On SW update, the new shell is fetched + activated on next navigation. There's a brief window where the old shell loads new HTML; mitigated by precaching the HTML too (which Serwist does for routes you list). |
| Safari iOS doesn't fire `beforeinstallprompt` | Document "iOS users: Safari 分享 → 添加到主屏幕". No code workaround. |
| Users confused that offline edits don't persist | Toast + README copy. Future P could add background sync, but it's out of v1 scope and creates non-trivial conflict resolution problems. |
| SW caches a thumbnail that is later purged from the server (P4 trash) | Acceptable — cached thumb may briefly outlive purge. Privacy nuance: someone with the device offline can still see a purged thumb. Document this as a known limitation; full mitigation needs cache busting on every purge event which is overkill for a family app. |
| Cached `/timeline` shows entries the viewer no longer has permission to see (after permissions change) | Same class as above. Cache is per-device and reflects the state at fetch time. The server is the source of truth on next online load. Document. |

## Estimated diff
~400 LOC across ~8 new files + 3 edits + icon assets. ~1 focused day.

---

# Roadmap status after P10

| Plan | Scope | Status |
|---|---|---|
| P0 | Foundation | shipped |
| P1 | Permissions engine | shipped |
| P2a | Babies + entries data | shipped |
| P2b | Admin + edit | shipped |
| P3 | Media | shipped |
| P4 | Trash bin | shipped |
| P5 | Design system | in progress |
| P6 | View-only pages (gallery/calendar/profile/me) | planned |
| P6.5 | Avatar upload | planned |
| P7 | Owner data (backup + logs) | planned |
| P8 | Permissions matrix UI | planned |
| P9 | Deployment (Docker + nginx + first-run) | planned |
| P10 | PWA + offline | planned |

After P10, the spec's §8.1 routes table is fully implemented, the deploy path matches §10, and the system meets the family-NAS use case end-to-end. Remaining work past P10 is **fast-follow polish**, not new P-plans: EXIF `takenAt` extraction (P3 follow-up), pull-to-refresh adoption on timeline/gallery, automatic backup cron (P7 follow-up), restore UI (P7 follow-up), HTTPS / reverse-proxy docs, in-browser avatar cropping (P6.5 follow-up), tightened CSP with per-request nonce (P9 follow-up).
