# P5 — Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the spec §7 design system real. Drop animal-island-ui tokens into `styles/tokens.css`, build a 23-component library under `components/{ui,mobile,features}/`, sweep every existing page to use those components, and lock the result behind visual-regression baselines + a11y + a no-raw-color ESLint guard. Zero schema / API / permission changes. P4 (`/profile/trash`) consumes P5's `Toast` and `Modal` — these must land before P4's UI tasks.

**Architecture:** Tokens drive everything via Tailwind v4 `@theme`. Each UI component is a single file under `components/ui/<Name>.tsx` (no barrel). Mobile shell composes `AppShell` + `Tabbar` and renders Tabbar conditionally by pathname. Dialog auto-adapts to viewport (BottomSheet < 640px, Modal ≥ 640px). Toast is a singleton stack mounted at root layout via `<ToastProvider>`. Business components (`components/features/`) replace inlined markup in existing pages. Visual regression takes 15 screens × 3 breakpoints = 45 baselines reviewed by a human before commit.

**Tech Stack:** Tailwind v4 already installed; no new runtime deps. New devDep: `@axe-core/playwright`. Self-hosted WOFF2 subsets of Nunito / Noto Sans SC / Zen Maru Gothic checked into `public/fonts/`. CSS-only animations + a tiny `lib/cn.ts` (~30 lines) for class merging — no `clsx` / `tailwind-merge` / `framer-motion` / `radix-ui` / `headless-ui`.

---

## Execution corrections from plan review

This plan was reviewed against the current `claude/affectionate-satoshi-6703ce` worktree on 2026-05-17 before execution. Apply these corrections while executing:

- The repo currently has **zero hardcoded hex colors** in `app/` and `components/`. The §12 grep returns 0. P5 does **not** need a hex-color cleanup pass; the no-raw-color ESLint rule is preventive, not retrofit.
- The repo has **173 `className=` occurrences** concentrated in 9 page files. The dominant patterns are:
  - Button: `bg-black text-white rounded px-4 py-2 disabled:opacity-50` (and `text-sm` / `py-1.5` size variants)
  - Card / row: `border rounded p-3` and `border rounded p-3 flex ...`
  - Input: `border rounded px-2 py-1` (with `text-sm` / `flex-1` variants)
  - Error text: `text-red-600 text-sm`
  - Container: `min-h-screen p-4 max-w-2xl mx-auto`
  - 1 inline Toast: `fixed bottom-4 left-4 right-4 mx-auto max-w-sm rounded border bg-white p-3 shadow` — replace first when `<Toast>` lands.
- `components/` currently contains only `media/`. `components/ui/`, `components/mobile/`, `components/features/` must be created.
- `components/media/UploadButton.tsx` already has working logic (FormData + clientUploadId). P5 **wraps** it in `<MediaUploader>` — do not rewrite the upload logic.
- `app/globals.css` is 13 lines and uses `system-ui` font stack. Replace wholesale, not via Edit.
- `app/layout.tsx` exists but is minimal. Inspect it before wiring `<ToastProvider>`; do not assume it already has a `lang="zh"` or `<head>` tree.
- There is no `app/(dev)` route group; create it with `app/(dev)/components/page.tsx` and guard the page body with `if (process.env.NODE_ENV === 'production') notFound();`.
- P4 (`docs/superpowers/plans/2026-05-17-P4-trash-bin.md`, 222 lines) is committed but its UI tasks have not all shipped. **Coordinate ordering**: P5 Phase 1–5 (tokens through Toast) must complete before P4 starts the `useTrashAction` toast wiring. Phase 8+ (page sweep) can happen in parallel with P4 UI.
- Do not create one commit per task during this execution unless explicitly requested. Group into the 13 phases below, one commit per phase; leave commit choreography to the final integration step.
- The repo uses `pnpm` based on lint script; if `pnpm` is unavailable in CI, fall back to `npm exec` for equivalent commands.

## Execution status — 2026-05-17

Implemented in `claude/affectionate-satoshi-6703ce`:

- Phase 0–9: complete. Tokens, typography, 11 core UI components, mobile shell components, 7 feature components, demo route, and existing-page sweep are in place.
- Phase 10: visual-regression spec file exists, but snapshot baselines are intentionally not committed because the plan requires human review before baseline commit.
- Phase 11: complete. `@axe-core/playwright` is installed, `tests/e2e/a11y.spec.ts` covers the P5 page set, and a11y / reduced-motion / keyboard-flow Playwright specs pass when the Next dev server is allowed to bind port 3000.
- Phase 12: `babyloom/no-raw-color` is implemented, tested, registered, and visible in ESLint print-config.
- Phase 13: `docs/DESIGN.md` exists and spec §16 is updated with this implementation status.

Verification completed locally: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, raw-color grep, `pnpm exec eslint --print-config app/login/page.tsx`, and escalated `pnpm exec playwright test a11y reduced-motion keyboard-flow`. Full visual-regression baselines remain intentionally uncommitted pending human review.

---

## Scope IN (this plan)

- Spec §7.2 tokens fully materialized in `styles/tokens.css` + `@theme`
- 11 core UI components (`components/ui/`) with unit tests + demo cards
- 5 mobile shell components (`components/mobile/`)
- 7 business components (`components/features/`) abstracting inlined page markup
- Layout (`app/layout.tsx`) wired with font preload + ToastProvider
- 9 existing pages re-skinned to use new components (markup-only changes)
- Tabbar renders unavailable future tabs (`/gallery`, `/calendar`) as disabled placeholders so P5 does not create new business routes
- 1 dev-only demo route `(dev)/components` as visual-regression source
- 1 ESLint rule `babyloom/no-raw-color` (preventive)
- Self-hosted WOFF2 subsets for Nunito + Noto Sans SC + Zen Maru Gothic
- Visual regression baselines via Playwright (15 screens × 3 breakpoints)
- `@axe-core/playwright` accessibility coverage (0 critical / 0 serious on each page)
- Reduced-motion E2E coverage
- `docs/DESIGN.md` reference for tokens + component API + motion contract

## Scope OUT (deferred / explicitly never)

- Dark mode (spec §7.4: never)
- i18n (spec §7.4: never)
- Font-size accessibility toggle (spec §7.4: never)
- Any schema / API / permission change
- New business pages (real `/gallery` / `/calendar` / `/profile/me` / `/profile/data` are P6; `/profile/trash` real UI is P4)
- Third-party UI library
- Dependency upgrades (Next, React, Tailwind pinned at current versions)
- Figma / design-tooling files
- Lighthouse CI gating (manual single-shot baseline only)
- baby_member_permissions UI (P6+)

## Spec sections covered

§7 in full (7.1 design language, 7.2 token table, 7.3 component inventory, 7.4 non-goals), §8.2 navigation tabbar shape, §11.4 visual regression strategy.

---

## File Structure

**New files:**

```
styles/
├── tokens.css                              # @theme + tokens + reduced-motion override
└── typography.css                          # @font-face for Nunito / Noto / Zen Maru

public/fonts/
├── nunito-400.woff2                        # subset
├── nunito-700.woff2
├── noto-sans-sc-400.woff2                  # GB2312 subset
├── noto-sans-sc-700.woff2
├── zen-maru-gothic-400.woff2               # JIS L1 subset
└── zen-maru-gothic-700.woff2

lib/
├── cn.ts                                   # ~30 line clsx replacement
└── hooks/
    ├── useDialog.ts                        # focus trap + ESC + scroll lock + restore
    ├── useMediaQuery.ts                    # 6-line SSR-safe wrapper
    └── useToast.ts                         # consumer hook (provider below)

components/ui/
├── Avatar.tsx + Avatar.test.tsx
├── Button.tsx + Button.test.tsx
├── Card.tsx + Card.test.tsx
├── Collapse.tsx + Collapse.test.tsx
├── Dialog.tsx + Dialog.test.tsx            # auto Modal/BottomSheet adapter
├── Input.tsx + Input.test.tsx
├── Modal.tsx                               # internal, consumed by Dialog
├── Spinner.tsx + Spinner.test.tsx
├── Switch.tsx + Switch.test.tsx
├── Tag.tsx + Tag.test.tsx
├── Textarea.tsx + Textarea.test.tsx
├── Toast.tsx + Toast.test.tsx              # primitive; provider exports below
└── ToastProvider.tsx

components/mobile/
├── ActionSheet.tsx + ActionSheet.test.tsx
├── AppShell.tsx + AppShell.test.tsx
├── BottomSheet.tsx                         # internal, consumed by Dialog
├── PullToRefresh.tsx + PullToRefresh.test.tsx
└── Tabbar.tsx + Tabbar.test.tsx

components/features/
├── BabyCard.tsx
├── EntryComposer.tsx
├── FamilyMemberList.tsx
├── MediaUploader.tsx
├── MilestonePicker.tsx
├── MilestoneRow.tsx
└── TimelineCard.tsx

app/
└── (dev)/components/page.tsx               # demo route, NODE_ENV guard

eslint-rules/
└── no-raw-color.js                         # AST rule

tests/
├── e2e/visual-regression.spec.ts
├── e2e/a11y.spec.ts
├── e2e/reduced-motion.spec.ts
├── e2e/keyboard-flow.spec.ts
└── unit/
    ├── ui/*.test.tsx                       # 11 files
    ├── mobile/*.test.tsx                   # 4 files
    └── no-raw-color.test.ts                # 8 fixtures

docs/
└── DESIGN.md                               # final reference
```

**Modified files:**

```
app/globals.css                             # rewrite: import tokens + typography
app/layout.tsx                              # wire ToastProvider + font preload + lang="zh"
app/login/page.tsx
app/onboarding/baby/page.tsx
app/timeline/page.tsx
app/entry/new/page.tsx
app/entry/[id]/page.tsx
app/entry/[id]/edit/page.tsx
app/profile/page.tsx
app/profile/babies/BabiesAdminClient.tsx
app/profile/members/MembersAdminClient.tsx
app/profile/milestones/MilestonesAdminClient.tsx
components/media/UploadButton.tsx           # accept className prop for wrapping
eslint.config.mjs                           # register babyloom/no-raw-color
package.json                                # add devDep @axe-core/playwright
```

---

## Phase 0 — Reconnaissance & Setup

Pure verification; no code change. Outputs feed every later phase.

- [ ] **0.1** Run spec §12 Task 0 grep block; paste output into `docs/superpowers/plans/_p5-recon.md` (gitignored). Confirm 0 hex hits, ~173 className hits, no existing `components/ui/`.
- [ ] **0.2** Inspect `app/layout.tsx` end-to-end. Note current `<head>` / `<html lang>` / font links. **Verify**: file exists and length < 60 lines (if longer, document why).
- [ ] **0.3** Inspect `app/globals.css` (13 lines). Confirm `system-ui` font and placeholder-token comment.
- [ ] **0.4** Inspect each of the 9 page files. For each, list (a) total className count (b) which of the 4 dominant patterns appear (button / card / input / error). Store in `_p5-recon.md` as table.
- [ ] **0.5** Inspect `components/media/UploadButton.tsx`. Confirm it accepts `babyId` + `onUploaded` and renders no styled wrapper of its own (or list what's there).
- [ ] **0.6** Confirm WOFF2 font subset requirements and current font-file state. Actual acquisition happens in Phase 1 because Phase 0 is verification-only:
  - Nunito 400 + 700: from Google Fonts via `pyftsubset` or pre-built `fonts.bunny.net` subset endpoint — keep Latin Extended-A range.
  - Noto Sans SC 400 + 700: GB2312 subset (~6500 codepoints) ≤ 800 KB each.
  - Zen Maru Gothic 400 + 700: JIS Level 1 subset (~3000 codepoints) ≤ 400 KB each.
  - **Verify in Phase 1**: each file < 1 MB, total `public/fonts/` < 5 MB.
- [ ] **0.7** Confirm CI Playwright base image is `mcr.microsoft.com/playwright:v1.48` (or current `@playwright/test` matching version). If not pinned in `playwright.config.ts`, add a comment for Phase 11.

**Phase exit:** `_p5-recon.md` exists with all 7 outputs and is ignored by git; nothing committed.

---

## Phase 1 — Tokens & Typography Foundation

Establishes the design language. Everything downstream depends on this.

- [ ] **1.1** Create `styles/tokens.css` with the full token block from spec §3.1 (the P5 spec, this repo's `docs/superpowers/specs/2026-05-17-P5-design-system.md` §3.1). Include the `@media (prefers-reduced-motion: reduce)` override that zeroes the three duration vars.
- [ ] **1.2** Create `styles/typography.css` with `@font-face` declarations for the 6 WOFF2 files. Use `font-display: swap`, set `unicode-range` per family to allow the browser to skip subsets it doesn't need.
- [ ] **1.3** Rewrite `app/globals.css` to:
  ```css
  @import "../styles/tokens.css";
  @import "../styles/typography.css";

  html, body {
    background: var(--color-bg);
    color: var(--color-fg);
    font-family: var(--font-display);
    font-size: var(--text-base);
  }

  *:focus-visible {
    outline: 3px solid var(--color-focus);
    outline-offset: 2px;
    border-radius: var(--radius-xs);
  }
  ```
  Remove the placeholder-token comment.
- [ ] **1.4** Update `app/layout.tsx`:
  - Set `<html lang="zh">`.
  - Add `<link rel="preload" as="font" type="font/woff2" crossOrigin="" href="/fonts/nunito-400.woff2" />` and the same for `noto-sans-sc-400.woff2`.
  - **Do not** add `<ToastProvider>` yet (Phase 5).
- [ ] **1.5** Manual smoke: `pnpm dev`, open `/login`, confirm:
  - Background is warm cream (`#f8f8f0`).
  - Default body text is brown (`#725d42`).
  - Tab-focusing the username input shows the yellow focus ring.
  - Network panel shows the two preloaded WOFF2.
- [ ] **1.6** **Verify**: `pnpm build` succeeds. No unused-`@theme`-var warnings (Tailwind v4 prints these to stdout).

**Phase exit:** Tokens visible site-wide; existing pages still ugly but warm-toned; commit `feat(P5): design tokens + typography foundation`.

---

## Phase 2 — Zero-Dep Helpers + Pure Display Components

Smallest pure pieces first; sets coding conventions for later interactive components.

- [ ] **2.1** Create `lib/cn.ts`:
  ```ts
  export function cn(...inputs: Array<string | false | null | undefined>): string {
    return inputs.filter(Boolean).join(' ');
  }
  ```
  **Verify:** unit test in `lib/cn.test.ts` covers truthy mix, empty, all-falsy.
- [ ] **2.2** Create `components/ui/Card.tsx`:
  - Props: `{ children, className, interactive?: boolean, as?: 'div' | 'article' | 'section' }`.
  - Base: `background: var(--color-surface); border-radius: var(--radius-card); box-shadow: var(--shadow-card); padding: var(--space-4);`
  - `interactive`: add `transition` + `hover { transform: translateY(-4px); box-shadow: var(--shadow-card-hover); }`.
- [ ] **2.3** Create `components/ui/Tag.tsx`:
  - Props: `{ children, variant?: 'neutral' | 'accent' | 'error', removable?: boolean, onRemove? }`.
  - Pill shape, `border-radius: var(--radius-pill)`, padding `var(--space-1) var(--space-3)`.
  - `removable`: render trailing `×` button with `aria-label="移除"`.
- [ ] **2.4** Create `components/ui/Avatar.tsx`:
  - Props: `{ src?, alt, name, size?: 'sm' | 'md' | 'lg' }` (28/40/56 px).
  - Fallback: initial of `name` (Chinese: first char; Latin: first uppercase letter) on `--color-accent` background.
  - Also export `AvatarGroup` with `max?: number` (default 3) and stacking via negative margin.
- [ ] **2.5** Create `components/ui/Spinner.tsx`:
  - SVG circle with `stroke-dasharray` animated via `@keyframes` rotate 1.2s linear infinite.
  - Reduced-motion: render static "…" with `aria-label="加载中"`.
- [ ] **2.6** Write unit tests for §2.2–2.5: each verifies (a) renders children/props (b) honors variants (c) has correct `role` / `aria-*`.
- [ ] **2.7** **Verify**: `pnpm test components/ui` green; `pnpm typecheck` green.

**Phase exit:** 4 pure components shippable; commit `feat(P5): Card / Tag / Avatar / Spinner`.

---

## Phase 3 — Interactive Form Components

The signature visual: pressed-shadow buttons + yellow-focus inputs.

- [ ] **3.1** Create `components/ui/Button.tsx` per spec §4.2:
  - Props: `{ variant?, size?, loading?, leadingIcon?, trailingIcon?, fullWidth?, ...HTMLButtonAttributes }`.
  - 5 variants × 3 sizes via CSS-var-driven class names (e.g., `data-variant="primary"`).
  - Pressed-shadow + `translateY(0)/-1/4` per spec §4.2.
  - `loading`: render Spinner, set `aria-busy`, swap text to `opacity: 0.6`, pointer-events none, disable.
  - **Verify**: reduced-motion test confirms `transform: none`.
- [ ] **3.2** Create `components/ui/Input.tsx`:
  - Props: `{ label?, error?, leadingSlot?, trailingSlot?, ...HTMLInputAttributes }`.
  - Pill outer with `border: 2px solid var(--color-border)`; on focus border becomes accent; ring via outline.
  - `error`: red border + `<p aria-live="polite">` below.
  - Auto-link `<label htmlFor>` ↔ `id` (generate id if missing).
- [ ] **3.3** Create `components/ui/Textarea.tsx`:
  - Same visual language as Input.
  - Auto-resize via `ref` + `scrollHeight` on input; **without** a ResizeObserver dep — set `height: auto; height = scrollHeight`.
- [ ] **3.4** Create `components/ui/Switch.tsx`:
  - `role="switch"` + `aria-checked`.
  - Handle uses `box-shadow: var(--shadow-press)` and animates `translateX` 200 ms.
  - Keyboard: Space toggles.
- [ ] **3.5** Unit tests for §3.1–3.4:
  - Button: disabled + loading prevents `onClick`; all variants render; aria-busy on loading.
  - Input: error renders message with `aria-live`; label auto-linking works.
  - Switch: Space key toggles; `aria-checked` reflects state.
- [ ] **3.6** Demo route stub: create `app/(dev)/components/page.tsx` with `notFound()` guard in production. Render the 4 prior + 4 new components in a grid of `<Card>`s. This becomes the visual-regression source.
- [ ] **3.7** **Verify**: `pnpm dev` → visit `/components`, all 8 components visible, focus rings yellow, buttons press correctly. `pnpm test` green.

**Phase exit:** Interactive primitives ready; commit `feat(P5): Button / Input / Textarea / Switch + demo route`.

---

## Phase 4 — Dialog Adapter (Modal + BottomSheet)

The trickiest non-form component; isolate to its own phase.

- [ ] **4.1** Create `lib/hooks/useMediaQuery.ts` (SSR-safe: returns `undefined` server-side, real boolean after first effect).
- [ ] **4.2** Create `lib/hooks/useDialog.ts`:
  - Manages: open state, focus trap, ESC handler, body scroll lock (set `document.body.style.overflow`), focus restore on close.
  - Returns `{ panelRef, descriptorProps }` for the panel + `{ onKeyDown, role: 'dialog', 'aria-modal': true }` for the panel.
- [ ] **4.3** Create `components/ui/Modal.tsx`:
  - Centered, max-width `min(90vw, 480px)`, `--color-surface` panel + scrim `rgba(60, 48, 32, 0.4)` with `backdrop-filter: blur(2px)`.
  - Inline SVG `<defs><clipPath>` for top "blob" — embed path as CSS `clip-path: path(...)` on a pseudo-element decoration.
  - Animation: scale 0.96→1 + opacity 0→1, 220ms ease-out-expo.
- [ ] **4.4** Create `components/mobile/BottomSheet.tsx`:
  - Slides up from bottom; height auto, max-height 90vh.
  - Top handle bar (24×4 px rounded).
  - Touch handlers (raw, no library): track `touchstart.clientY`, on `touchmove` translate by `Δy` (clamp at 0), on `touchend` close if `Δy > 80` or velocity (`Δy / Δt`) > 0.5; otherwise spring back.
  - Reduced-motion: opacity-only fade, no slide.
- [ ] **4.5** Create `components/ui/Dialog.tsx`:
  - Props: `{ open, onOpenChange, title, description?, children, footer? }`.
  - Body: `const isDesktop = useMediaQuery('(min-width: 640px)') ?? true;` then `return isDesktop ? <Modal ...> : <BottomSheet ...>;` (default desktop on SSR to avoid layout shift; mobile sees a paint flicker first frame which is acceptable).
  - **Both branches** wire `useDialog` so behavior is identical.
- [ ] **4.6** Add demo entries to `(dev)/components/page.tsx`: "Open Modal" + "Open BottomSheet (mobile)" buttons.
- [ ] **4.7** Unit tests:
  - `useDialog`: ESC closes, body scroll restores on close.
  - Dialog: opens/closes via `onOpenChange`; renders title with `aria-labelledby`.
  - BottomSheet: touch drag past threshold calls `onOpenChange(false)` — simulate with `fireEvent.touchStart` / `touchMove` / `touchEnd`.
- [ ] **4.8** **Verify**: keyboard flow — open dialog, Tab stays inside; ESC closes; focus returns to trigger.

**Phase exit:** Dialog adapter shipped; commit `feat(P5): Dialog adapter (Modal + BottomSheet)`.

---

## Phase 5 — Toast (unblocks P4)

- [ ] **5.1** Create `components/ui/Toast.tsx` (primitive): renders a single toast row with variant + action button. Animates `translateY(20px)→0 + opacity` 220 ms; reduced-motion swaps to opacity-only.
- [ ] **5.2** Create `components/ui/ToastProvider.tsx`:
  - Holds at most 1 toast (new toast replaces old per spec §4.4).
  - Exposes `show({ message, variant?, durationMs?, action? })` and `dismiss()` via React context.
  - Auto-dismiss after `durationMs` (default 5000); clear timer on manual dismiss.
- [ ] **5.3** Create `lib/hooks/useToast.ts` consumer hook (reads context, throws if outside provider).
- [ ] **5.4** Wire `<ToastProvider>` into `app/layout.tsx`, mounted around `{children}`.
- [ ] **5.5** Add a "Show toast" demo button in `(dev)/components/page.tsx` for each variant.
- [ ] **5.6** Unit tests:
  - Toast renders message + variant class.
  - Provider replaces existing toast on second `show()`.
  - Auto-dismiss fires after `durationMs` (use `vi.useFakeTimers()`).
  - Action click fires callback and dismisses.
- [ ] **5.7** **Verify**: manual — click toast demo, see bottom-centered toast, auto-dismiss, action callback runs.

**Phase exit:** Toast functional in app; **P4 unblocked**; commit `feat(P5): Toast + ToastProvider`.

---

## Phase 6 — Collapse

Light phase; kept separate so it doesn't bloat earlier commits.

- [ ] **6.1** Create `components/ui/Collapse.tsx` using `grid-template-rows: 0fr ↔ 1fr` (no JS height measurement). Inner `<div style="overflow:hidden">` holds children. 220 ms transition.
- [ ] **6.2** Demo card + unit test (open/closed renders both states; aria-expanded on toggle).
- [ ] **6.3** **Verify**: switching with reduced-motion enabled snaps instantly.

**Phase exit:** Commit `feat(P5): Collapse`.

---

## Phase 7 — Mobile Shell + Future Tab Placeholders

- [ ] **7.1** Create `components/mobile/Tabbar.tsx`:
  - 4 items hardcoded in spec §5.1.
  - `Timeline` and `Me` link to existing routes. `Gallery` and `Calendar` render as disabled future tabs with `aria-disabled="true"` and no navigation until their real P6 pages exist.
  - SVG icons inlined (no icon library). Each ~ 24 × 24.
  - Active tab: `--color-accent` background, `translateY(-6px)` with `cubic-bezier(0.34, 1.56, 0.64, 1)` 280 ms.
  - Reduced-motion: drop the translate, keep color change.
  - Read pathname via `usePathname()` to determine active.
- [ ] **7.2** Create `components/mobile/AppShell.tsx`:
  - Props: `{ title, leftSlot?, rightSlot?, children }`.
  - Sticky top header (56 px + safe-area).
  - Bottom Tabbar conditional: hide on `pathname.startsWith('/login')` or `pathname.startsWith('/onboarding')`.
  - Content padding-bottom `calc(64px + env(safe-area-inset-bottom))` when Tabbar visible.
- [ ] **7.3** Create `components/mobile/ActionSheet.tsx`:
  - Built on top of `BottomSheet`; renders option list + cancel button. Destructive option red.
- [ ] **7.4** Create `components/mobile/PullToRefresh.tsx`:
  - Wraps children; only mounts touch listeners if `'ontouchstart' in window`. Renders a self-drawn spinner above the content when pulled.
  - Desktop: pass-through wrapper.
- [ ] **7.5** Do **not** create `/gallery` or `/calendar` pages in P5. Verify disabled Tabbar items do not navigate or 404.
- [ ] **7.6** Unit tests for AppShell pathname branching + Tabbar active-state highlighting.
- [ ] **7.7** **Verify**: `pnpm dev`, mobile-emulate 375 px, navigate `/timeline` → `/profile` via Tabbar. Tab active state lifts correctly. Disabled `/gallery` and `/calendar` items do not navigate. `/login` shows no Tabbar.

**Phase exit:** Commit `feat(P5): mobile shell + future tab placeholders`.

---

## Phase 8 — Business Component Extraction

Each business component extracts inlined markup from a real page. **Do not change behavior** — only rehouse the JSX and replace primitives.

- [ ] **8.1** `components/features/TimelineCard.tsx`:
  - Inputs: entry row + child media + author name.
  - Renders `<Card>` with author Avatar, time, body text, optional `<ThumbnailStrip>` (reuse existing `components/media/ThumbnailStrip.tsx` as-is).
- [ ] **8.2** `components/features/BabyCard.tsx`:
  - Extract from `BabiesAdminClient.tsx` row markup.
- [ ] **8.3** `components/features/MilestoneRow.tsx`:
  - Extract from `MilestonesAdminClient.tsx`.
- [ ] **8.4** `components/features/FamilyMemberList.tsx`:
  - Extract from `MembersAdminClient.tsx` (list portion only; mutations stay in client component).
- [ ] **8.5** `components/features/MilestonePicker.tsx`:
  - Multi-select grid of `<Tag>` chips, intended to mount inside `<Dialog>`.
- [ ] **8.6** `components/features/MediaUploader.tsx`:
  - Wraps existing `components/media/UploadButton.tsx`; adds a `<Button variant="secondary">` trigger + thumbnail preview row using `<Card>`.
  - Update `UploadButton.tsx` to accept `className` and forward — no logic change.
- [ ] **8.7** `components/features/EntryComposer.tsx`:
  - Shared form for `/entry/new` and `/entry/[id]/edit`.
  - Composes `<Textarea>` + `<MilestonePicker>` (in Dialog) + `<MediaUploader>` + `<Button>` submit.
- [ ] **8.8** No new tests — these are visually tested in Phase 11.

**Phase exit:** Commit `feat(P5): extract business components`.

---

## Phase 9 — Page Sweep

The bulk of P5 by line count, but each page is mechanical: replace inline className strings with components from `components/ui/` + `components/features/`.

For **each** page below:
1. Open the page.
2. Replace `bg-black text-white rounded px-4 py-2 disabled:opacity-50` → `<Button variant="primary" disabled={...}>`.
3. Replace `border rounded p-3` → `<Card>`.
4. Replace `border rounded px-2 py-1` form rows → `<Input>` / `<Textarea>`.
5. Replace `text-red-600 text-sm` → conditional `useToast().show({ variant: 'error', ... })` for transient errors, or `<p role="alert">` with token classes for inline.
6. **Grep verify**: after the page is done, no `bg-black|bg-white|text-red-|text-blue-|rounded |border ` matches in that file (allow `border-` token classes if any sneak in via component).

- [ ] **9.1** `app/login/page.tsx`: wrap form in `<Card>`, replace button + inputs. Add brand hero (cream background + h1 "BabyLoom").
- [ ] **9.2** `app/onboarding/baby/page.tsx`: same treatment; large display-style title using `--text-hero`.
- [ ] **9.3** `app/timeline/page.tsx`: wrap in `<AppShell title="时光">`, render list of `<TimelineCard>`. Baby switcher using `<Tag variant="accent">` chips at top.
- [ ] **9.4** `app/entry/new/page.tsx`: render `<EntryComposer>` inside `<AppShell title="新建">` on mobile, inside `<Dialog>` on desktop (use existing route; the modal-on-desktop is a UX upgrade left optional in this pass — pick AppShell-only for first cut to keep diff small; document trade-off in plan note).
- [ ] **9.5** `app/entry/[id]/page.tsx`: detail layout with `<Card>` + milestone `<Tag>`s + media grid (reuse existing `components/media/Gallery.tsx`).
- [ ] **9.6** `app/entry/[id]/edit/page.tsx`: `<EntryComposer>` in edit mode.
- [ ] **9.7** `app/profile/page.tsx`: card grid of profile entrypoints (babies / members / milestones / trash placeholder / data placeholder). Each entrypoint a `<Card interactive>` linking to its route.
- [ ] **9.8** `app/profile/babies/BabiesAdminClient.tsx`: list using `<BabyCard>`, add/edit dialogs.
- [ ] **9.9** `app/profile/members/MembersAdminClient.tsx`: list using `<FamilyMemberList>`, reset-password via `<Dialog>`.
- [ ] **9.10** `app/profile/milestones/MilestonesAdminClient.tsx`: list using `<MilestoneRow>`.
- [ ] **9.11** **Verify**:
  - `pnpm typecheck` green.
  - `pnpm test` green.
  - `pnpm playwright test` (existing P2b E2E suites) all pass — markup changes must not break selectors. Where Playwright assertions referenced legacy text/class, update the selector to a role-based or data-testid query; document each in a comment.
  - `grep -rE '\bbg-(black|white|red|blue)\b' app/` returns 0.

**Phase exit:** Commit `feat(P5): sweep existing pages to new design system`.

---

## Phase 10 — Demo Route Completion + Visual Regression Baseline

- [ ] **10.1** Flesh out `app/(dev)/components/page.tsx`: one section per component with title + 2–3 stateful variants each.
- [ ] **10.2** Install `@axe-core/playwright` as a devDep.
- [ ] **10.3** Create `tests/e2e/visual-regression.spec.ts`:
  - Define 15 screens per spec §8.2.
  - Define 3 viewports: 320×720, 768×1024, 1280×800.
  - Use Playwright `toHaveScreenshot()` with `maxDiffPixelRatio: 0.005` and `--font-render-hinting=none`.
  - Each test seeds DB to a deterministic state (extract seed helper from existing E2E tests; Execution-corrections note #4 applies).
- [ ] **10.4** Run baselines locally: `pnpm playwright test visual-regression --update-snapshots`. Human-review every file under `tests/e2e/visual-regression.spec.ts-snapshots/`. **Do not commit baselines until reviewed.**
- [ ] **10.5** Commit baselines once approved.
- [ ] **10.6** **Verify**: re-run `pnpm playwright test visual-regression` → 45 pass.

**Phase exit:** Commit `test(P5): visual regression baselines (45 screens)`.

---

## Phase 11 — A11y + Reduced-Motion + Keyboard

- [ ] **11.1** Create `tests/e2e/a11y.spec.ts`:
  - For each of pages 1–13 in spec §8.2 list, navigate, run `axe.analyze()`, assert `violations.filter(v => ['critical', 'serious'].includes(v.impact)).length === 0`.
  - Write moderate+minor to `tests/e2e/a11y-report.md` (not asserted).
- [ ] **11.2** Create `tests/e2e/reduced-motion.spec.ts` per spec §7.2:
  - `await context.emulateMedia({ reducedMotion: 'reduce' })`.
  - Click a button → inspect `getComputedStyle(btn).transitionDuration` === `'0s'`.
  - Open dialog → same check on panel.
  - Show toast → same check.
- [ ] **11.3** Create `tests/e2e/keyboard-flow.spec.ts`:
  - `/login`: Tab through fields in order; Enter submits.
  - Dialog open: Tab cycles inside panel.
  - Tabbar (desktop view): arrow keys move highlight.
- [ ] **11.4** **Verify**: all three suites green.

**Phase exit:** Commit `test(P5): a11y + reduced-motion + keyboard flow`.

---

## Phase 12 — `no-raw-color` ESLint Rule

- [ ] **12.1** Create `eslint-rules/no-raw-color.js`:
  - AST visitor on `Literal` (string) and `TemplateElement`.
  - Regex: `/#[0-9a-fA-F]{3,8}\b/` and `/\brgba?\(/`.
  - Report unless the file path matches an allowlist (`styles/tokens.css`, `tests/**`, `public/**`, `**/*.svg`) **or** preceded by an `// COLOR-EXEMPT: <reason>` comment on the previous line.
- [ ] **12.2** Create `tests/unit/no-raw-color.test.ts` with 8 fixtures:
  | # | Code | Expect |
  |---|---|---|
  | 1 | `const x = 'pad'` | pass |
  | 2 | `const x = 'var(--color-accent)'` | pass |
  | 3 | `// COLOR-EXEMPT: brand logo svg literal\nconst x = '#19c8b9'` | pass |
  | 4 | `// COLOR-EXEMPT:\nconst x = '#19c8b9'` (empty reason) | **fail** |
  | 5 | `const x = '#19c8b9'` | **fail** |
  | 6 | `const x = 'bg-[#fff]'` | **fail** |
  | 7 | `` const x = `rgba(0,0,0,0.5)` `` | **fail** |
  | 8 | tokens.css line | pass (path allowlist) |
- [ ] **12.3** Register rule in `eslint.config.mjs` under the `babyloom` plugin (already wired from P4).
- [ ] **12.4** **Verify**: `pnpm lint --print-config app/login/page.tsx | grep no-raw-color` shows rule is loaded. `pnpm lint` returns 0 violations across the repo (P5 sweep must have already cleared everything).

**Phase exit:** Commit `feat(P5): no-raw-color ESLint guard`.

---

## Phase 13 — `docs/DESIGN.md` + Final Verification

- [ ] **13.1** Create `docs/DESIGN.md`:
  - **§1 Tokens table**: every var in `tokens.css` with semantic description.
  - **§2 Component API reference**: for each of 11 + 5 + 7 components, signature + 1-line usage example.
  - **§3 Motion contract**: the spec §7.1 table of durations + the reduced-motion decisions.
  - **§4 Pattern recipes**: "How to do X with the design system" — modal dialog, destructive confirm, async-loading button, error toast.
- [ ] **13.2** Run the full acceptance checklist (spec §11):
  - [ ] tokens land in `styles/tokens.css`; `app/globals.css` placeholder comment gone
  - [ ] 11 / 5 / 7 components present, demos rendered
  - [ ] page sweep complete; raw color grep returns 0
  - [ ] Tabbar works at < 640px
  - [ ] visual regression 45 screens pass
  - [ ] a11y 0 critical / 0 serious
  - [ ] reduced-motion 3 cases pass
  - [ ] manual Lighthouse on `/timeline` mobile: Performance ≥ 90, Accessibility ≥ 95 (record JSON in `docs/perf/p5-lighthouse-baseline.json`)
  - [ ] `pnpm lint` clean, `no-raw-color` in `--print-config`
  - [ ] JS gzipped < 150 KB, CSS gzipped < 30 KB (run `pnpm build`, inspect `.next/build-manifest.json` + report sizes)
  - [ ] `docs/DESIGN.md` complete
  - [ ] P4 `useTrashAction` 5s undo toast uses P5 `Toast` correctly (smoke test once P4 wires it)
  - [ ] Spec §7 table-for-table matches implementation
- [ ] **13.3** Update `docs/superpowers/specs/2026-05-15-babyloom-v2-rebuild-design.md` §16 to note "P5 实施完成 2026-XX-XX, 见 plans/2026-05-17-P5-design-system.md".

**Phase exit:** Commit `docs(P5): DESIGN.md + spec status update`. Phase 13 commit is the final integration commit; no PR squash needed since phases were already coherent.

---

## Acceptance

Mirrors spec §11; all 15 checks listed in Phase 13.2 above must pass before P5 is considered shipped.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Subset fonts render glyphs that fail at runtime (uncommon CJK chars) | Test `/onboarding/baby` with the placeholder Chinese name "测试宝宝" — covers common range. For tail risk, leave system-ui fallback in `--font-display`. |
| BottomSheet touch-drag flickers on iOS Safari | Use `touch-action: pan-y` on the panel; explicit `preventDefault()` on `touchmove` only when dragging. Test on real iOS device once before Phase 4 sign-off. |
| Visual regression flake from font-rendering jitter | Pin Playwright image; use `--font-render-hinting=none`; allow 0.5% diff. If still flaky, raise to 1% and document. |
| P4 plan assumes Toast exists before P4 UI tasks land | P4 plan to add explicit "P5 Phase 5 must complete first" dependency note. This plan's Phase 5 ordering is the contract. |
| `pnpm` not available in CI | Fall back to `npm exec` equivalents; document in `playwright.config.ts` and CI workflow. |
| Reduced-motion still leaves grid-template-rows transition on Collapse | Add explicit `transition: none` override in the reduced-motion media query for `.collapse-grid`. |
| Tabbar overlaps content on iOS Safari home-bar | `env(safe-area-inset-bottom)` padding already in plan; verify on device. |

---

## Out-of-band notes for P4 implementers

When P4 (`docs/superpowers/plans/2026-05-17-P4-trash-bin.md`) starts UI work:
- Phase 5 of this plan must already be merged. Check `git log --grep "feat(P5): Toast"`.
- `useTrashAction` imports `useToast` from `@/lib/hooks/useToast` (not directly from `components/ui/Toast`).
- The 5s undo behavior is implemented at the **call site** (P4), not in the Toast primitive — Toast just provides `durationMs` + `action` slot.
- `/profile/trash` page (P4 Phase 3) should use `<AppShell title="垃圾桶">` already shipped in P5 Phase 7.
- Trash modals (purge confirm, empty confirm) use `<Dialog>` from P5 Phase 4 — auto-adapts to BottomSheet on mobile.

---

**Next:** Begin Phase 0. Recommended worker: `superpowers:subagent-driven-development` with one subagent per phase. After Phase 5 lands, ping P4 owner to unblock trash UI tasks.
