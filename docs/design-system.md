# Babyloom Design System

P5 turns the spec §7 visual language into reusable code. The system is intentionally small: tokenized CSS, single-file React components, and no runtime UI dependency.

## Tokens

Tokens live in `app/styles/tokens.css` and are imported by `app/globals.css`.

| Group | Tokens |
| --- | --- |
| Color | `--color-bg`, `--color-surface`, `--color-fg`, `--color-fg-strong`, `--color-muted`, `--color-accent`, `--color-success`, `--color-warning`, `--color-error`, `--color-focus`, `--color-border`, `--color-scrim`, `--color-on-solid` |
| Type | `--font-display`, `--text-xs`, `--text-sm`, `--text-base`, `--text-lg`, `--text-xl`, `--text-hero` |
| Shadow | `--shadow-press`, `--shadow-press-hover`, `--shadow-press-active`, `--shadow-press-error`, `--shadow-press-success`, `--shadow-card`, `--shadow-card-hover` |
| Radius | `--radius-pill`, `--radius-card`, `--radius-sm`, `--radius-xs` |
| Space | `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-6`, `--space-8`, `--space-12`, `--space-section` |
| Layer | `--z-tabbar`, `--z-sticky`, `--z-sheet`, `--z-modal`, `--z-toast` |

Raw hex/rgb colors are blocked in `app/` and `components/` by `babyloom/no-raw-color`. New color work belongs in `app/styles/tokens.css`.

## Typography

Fonts are self-hosted under `public/fonts/` and declared in `app/styles/typography.css`.

The display stack is:

```css
Nunito, Noto Sans SC, Zen Maru Gothic, system-ui, sans-serif
```

Only regular weights 400 and 700 are part of P5.

## Core UI

Import components from their direct files. There is no barrel export.

| Component | Path | API |
| --- | --- | --- |
| Button | `components/ui/Button.tsx` | `variant?: 'primary' | 'secondary' | 'ghost' | 'error' | 'success'`, `size?: 'sm' | 'md' | 'lg'`, `loading?`, `leadingIcon?`, `trailingIcon?`, `fullWidth?` |
| Input | `components/ui/Input.tsx` | `label?`, `error?`, `leadingSlot?`, `trailingSlot?`, plus native input props |
| Textarea | `components/ui/Textarea.tsx` | `label?`, `error?`, `autoResize?`, plus native textarea props |
| Switch | `components/ui/Switch.tsx` | `checked`, `onCheckedChange`, plus button props |
| Card | `components/ui/Card.tsx` | `interactive?`, `as?: 'div' | 'article' | 'section'` |
| Dialog | `components/ui/Dialog.tsx` | `open`, `onOpenChange`, `title`, `description?`, `footer?`; renders Modal on desktop and BottomSheet on mobile |
| Collapse | `components/ui/Collapse.tsx` | `open`, `children`, `className?` |
| Tag | `components/ui/Tag.tsx` | `variant?: 'neutral' | 'accent' | 'error'`, `removable?`, `onRemove?` |
| Avatar | `components/ui/Avatar.tsx` | `src?`, `alt`, `name`, `size?: 'sm' | 'md' | 'lg'`; also exports `AvatarGroup` |
| Spinner | `components/ui/Spinner.tsx` | `size?: 'sm' | 'md' | 'lg'`, `className?` |
| Toast | `components/ui/Toast.tsx` | primitive used by `ToastProvider`; consumers call `useToast().show({ message, variant?, durationMs?, action? })` |

## Mobile

| Component | Path | Notes |
| --- | --- | --- |
| AppShell | `components/mobile/AppShell.tsx` | Sticky title bar, content area, and conditional Tabbar. Hidden on `/login` and `/onboarding`. |
| Tabbar | `components/mobile/Tabbar.tsx` | Timeline and Me navigate. Gallery and Calendar are disabled future tabs in P5. |
| BottomSheet | `components/mobile/BottomSheet.tsx` | Internal Dialog mobile surface. |
| ActionSheet | `components/mobile/ActionSheet.tsx` | Mobile action list with destructive variant. |
| PullToRefresh | `components/mobile/PullToRefresh.tsx` | Touch-only refresh affordance; desktop is no-op. |

## Feature Components

Feature components wrap page-level visual structure without moving business rules.

| Component | Path | Used By |
| --- | --- | --- |
| TimelineCard | `components/features/TimelineCard.tsx` | `/timeline`, entry displays |
| EntryComposer | `components/features/EntryComposer.tsx` | `/entry/new`, `/entry/[id]/edit` |
| BabyCard | `components/features/BabyCard.tsx` | `/profile/babies` |
| MilestoneRow | `components/features/MilestoneRow.tsx` | `/profile/milestones` |
| FamilyMemberList | `components/features/FamilyMemberList.tsx` | `/profile/members` |
| MilestonePicker | `components/features/MilestonePicker.tsx` | Entry composer milestone selection |
| MediaUploader | `components/features/MediaUploader.tsx` | Entry composer media upload wrapper |

## Motion

Motion uses CSS variables only: `--duration-fast`, `--duration-normal`, `--duration-slow`, `--ease-press`, and `--ease-out-expo`.

`prefers-reduced-motion: reduce` sets the three duration tokens to `0ms`. Components should use tokenized durations so this behavior applies automatically.

## Verification

Run these before merging design-system changes:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
```

Visual baselines are defined in `tests/e2e/visual-regression.spec.ts`. Generate or update snapshots only when a human can review the files before commit.

## 用法示例

### 颜色：必须用 token，不能写 hex

```css
/* ✅ */
.card {
  background: var(--color-surface);
  color: var(--color-fg);
}

/* ❌ ESLint 规则 babyloom/no-raw-color 会拦截 */
.card {
  background: #ffffff;
  color: rgb(24, 24, 24);
}
```

需要新颜色时，先在 `app/styles/tokens.css` 中加入 token，再在组件里引用。

### 字号：用 `--text-*` 阶梯而不是字面值

```css
/* ✅ */
.heading {
  font-size: var(--text-xl);
}

/* ❌ */
.heading {
  font-size: 24px;
}
```

### 间距：优先 `--space-*`

间距阶梯是 `--space-1` 到 `--space-12` 加 `--space-section`。短距用相邻阶梯组合，超出范围再考虑加 token。

### 圆角与阴影

按用途选择：`--radius-card` 给卡片、`--radius-pill` 给按钮、`--radius-xs/sm` 给小型控件。阴影 `--shadow-card` 用于平铺面板，`--shadow-press` 系列用于可按压控件。

### 图层（z-index）

不要写字面 `z-index`，用 `--z-tabbar` / `--z-sticky` / `--z-sheet` / `--z-modal` / `--z-toast`，保证视觉层级一致。
