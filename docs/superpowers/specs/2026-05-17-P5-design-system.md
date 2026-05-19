# P5 — 设计系统落地与 UI 视觉打磨

**日期**:2026-05-17
**承接**:`2026-05-15-babyloom-v2-rebuild-design.md` §7(UI / 设计系统)
**参考实现**:[animal-island-ui](https://github.com/guokaigdg/animal-island-ui) · [Demo 站](https://guokaigdg.github.io/animal-island-ui/)
**前置阶段**:P0 / P1 / P2a / P2b / P3 已完成,P4 设计规约已落,**P4 实施与 P5 可并行**(P5 不引入新业务字段、不动 schema、不动 API)
**面向阶段**:P5 实施计划(writing-plans 阶段输出)

---

## 1. 背景与目标

P0–P3 已交付完整的数据层、权限层、媒体子系统与所有 owner 后台页;P2b 的 `/profile/{babies,members,milestones}` 是当前 app 内**唯一一组成型 UI**,其余页面(`/timeline` / `/entry/new` / `/entry/[id]` / `/entry/[id]/edit` / `/onboarding/baby` / `/login`)仍然是裸 Tailwind 默认外观,且 `app/globals.css` 头部明确标注:

```css
/* placeholder tokens — full Animal Crossing palette lands in P5 */
```

Spec §7 已经把 **animal-island-ui 风格的 token、组件清单、移动端组件**完整定下;P2b 在管理页上一定程度落了"胶囊按钮 + 卡片"语义,但 `components/ui/` 目录尚未真正建立,所有页面各自重复写 Tailwind 工具类,导致:

- token 漂移:同一个"主按钮"在不同页面颜色/圆角/阴影都不一致
- 缺失任天堂按压阴影(`box-shadow: 0 5px 0 0 #bdaea0` + active 收缩到 `0 1px 0 0`)这一 animal-island-ui 的核心视觉签名
- 缺失温暖羊皮纸底 `#f8f8f0` / 薄荷绿主色 `#19c8b9` / 黄色聚焦 `#ffcc00` 的整体氛围
- 移动端 Tabbar / BottomSheet / ActionSheet 全部未实现
- 无视觉回归基线,后续任何 UI 改动都会偷偷退化

P5 的工作是把 spec §7 从"规约文字"变成"代码现实",并把所有现有页面统一刷过一遍,**不增加任何业务逻辑、不动 API、不动数据模型**。这是一次纯前端打磨。

### P5 目标

1. **Tokens**:`styles/tokens.css` 落地 spec §7.2 全部 token(色板 / 字体 / 阴影 / 圆角 / 缓动)+ Tailwind v4 `@theme` 桥接
2. **核心组件**:`components/ui/` 建立 11 个核心组件(`Button` / `Input` / `Textarea` / `Switch` / `Card` / `Modal` / `Collapse` / `Tag` / `Avatar` / `Spinner` / `Toast`),每个对照 animal-island-ui demo 落 token、状态、a11y
3. **移动端壳**:`components/mobile/` 新增 5 个移动端组件(`Tabbar` / `BottomSheet` / `ActionSheet` / `PullToRefresh` / `AppShell`)
4. **业务组件**:`components/features/` 抽出 `TimelineCard` / `EntryComposer` / `MilestonePicker` / `MediaUploader` / `FamilyMemberList` —— 现有内嵌实现统一迁移
5. **页面刷一遍**:7 个现有页 + `app/layout.tsx` 全部接入新组件、新 token,删除内嵌 Tailwind 重复样式
6. **视觉回归基线**:Playwright 截图基线 320 / 768 / 1024 三档,覆盖每个主页面与每个 UI 组件 demo
7. **a11y / reduced-motion**:键盘可达性 + `prefers-reduced-motion` 关闭按压抖动 + `aria-*` 完整覆盖
8. **DESIGN.md**:`docs/DESIGN.md` 留组件 API、token 表、动效约定的单一查阅入口(P5+ 维护)

### P5 非目标(留 P6+)

- ❌ 深色模式(spec §7.4 已明确 YAGNI)
- ❌ 国际化(spec §7.4,只做中文)
- ❌ 老人模式字号开关(同上)
- ❌ 新页面 / 新业务功能(`/gallery` / `/calendar` / `/profile/trash` 等仍属 P3/P4 范围,P5 只刷它们的视觉,不新建)
- ❌ 任何 schema / API / 权限改动
- ❌ baby_member_permissions UI(留 P6 或更后)
- ❌ 第三方组件库(headless-ui / radix / shadcn 一律不引)

---

## 2. 范围

### 2.1 In scope(文件级)

| # | 模块 | 路径 | 内容 |
|---|---|---|---|
| 1 | Tokens | `styles/tokens.css` | spec §7.2 全部 `@theme` 变量 + `:root` 备份 |
| 2 | Typography | `styles/typography.css` | Nunito + Noto Sans SC + Zen Maru Gothic `@font-face`(本地子集化,自托管) |
| 3 | Global | `app/globals.css` | 改为 `@import "../styles/tokens.css"; @import "../styles/typography.css"; @import "tailwindcss";` + 全局背景/文字色绑定到 token |
| 4 | Button | `components/ui/Button.tsx` | 三尺寸 (sm/md/lg) × 五 variant (primary/secondary/ghost/error/success) + loading 斜纹动画 + 按压阴影 |
| 5 | Input | `components/ui/Input.tsx` | 胶囊 + 黄色聚焦 + error state + leading/trailing slot |
| 6 | Textarea | `components/ui/Textarea.tsx` | 同 Input 视觉语义 + auto-resize |
| 7 | Switch | `components/ui/Switch.tsx` | 浮起手柄 + 颜色切换 + `aria-checked` |
| 8 | Card | `components/ui/Card.tsx` | 圆角 20 + 卡片阴影 + hover `translateY(-4px)` |
| 9 | Modal | `components/ui/Modal.tsx` | 桌面端居中 + blob clip-path 顶部装饰 + focus trap + ESC 关闭 |
| 10 | Collapse | `components/ui/Collapse.tsx` | `grid-template-rows: 0fr → 1fr` 动画(无 JS 高度测量) |
| 11 | Tag | `components/ui/Tag.tsx` | 三 variant (neutral/accent/error) + 可选 onRemove |
| 12 | Avatar | `components/ui/Avatar.tsx` | 圆形 + fallback 首字母 + `AvatarGroup` 叠层 |
| 13 | Spinner | `components/ui/Spinner.tsx` | 1.2s 旋转 + reduced-motion fallback |
| 14 | Toast | `components/ui/Toast.tsx` + `ToastProvider` | 单 stack、底部居中、5s 默认、action slot、reduced-motion fallback |
| 15 | Tabbar | `components/mobile/Tabbar.tsx` | 底部 4 项 (Timeline / Gallery / Calendar / Me) + active 上凸 + 安全区 padding |
| 16 | BottomSheet | `components/mobile/BottomSheet.tsx` | 顶部 blob 装饰 + 拖动 handle + 背景 dim + ESC/点空关闭 |
| 17 | ActionSheet | `components/mobile/ActionSheet.tsx` | iOS 风布局 + AC 配色 + destructive variant |
| 18 | PullToRefresh | `components/mobile/PullToRefresh.tsx` | 仅 touch + `overscroll-behavior: contain`,桌面端 no-op |
| 19 | AppShell | `components/mobile/AppShell.tsx` | 顶部 sticky 标题栏 + 内容区 + 底部 Tabbar 容器 |
| 20 | TimelineCard | `components/features/TimelineCard.tsx` | 替代 `/timeline/page.tsx` 内嵌 markup |
| 21 | EntryComposer | `components/features/EntryComposer.tsx` | `/entry/new` 与 `/entry/[id]/edit` 共享表单壳 |
| 22 | MilestonePicker | `components/features/MilestonePicker.tsx` | BottomSheet 内的多选 Tag 网格 |
| 23 | MediaUploader | `components/features/MediaUploader.tsx` | 包裹现有 `UploadButton`,补齐视觉与状态 |
| 24 | FamilyMemberList | `components/features/FamilyMemberList.tsx` | 抽 `MembersAdminClient` 视觉骨架 |
| 25 | Layout | `app/layout.tsx` | 接 `ToastProvider` + `AppShell`(移动)+ 字体预加载 link |
| 26 | Pages | `app/{timeline,profile/*,entry/*,onboarding/*,login}/page.tsx` + 现有 Client 组件 | 删除内嵌样式,改用新组件 |
| 27 | Demo 路由 | `app/(dev)/components/page.tsx` | 仅 `NODE_ENV !== 'production'`:每个 UI 组件一张 demo 卡,作截图基线源 |
| 28 | E2E | `tests/e2e/visual-regression.spec.ts` | Playwright 截图,7 页 × 3 断点 + demo 路由 11 个组件 |
| 29 | E2E | `tests/e2e/a11y.spec.ts` | `@axe-core/playwright` 跑每页,0 critical/serious 违规 |
| 30 | Unit | `tests/unit/ui/*.test.tsx` | 每个 UI 组件最小行为单测(props 渲染 + 关键 a11y attr) |
| 31 | Docs | `docs/DESIGN.md` | 组件 API 速查表 + token 表 + 动效约定 + reduced-motion 决策 |

### 2.2 Out of scope(显式不做)

- 新页面(`/gallery` / `/calendar` / `/profile/me` / `/profile/trash` / `/profile/data` 等仍是 P3/P4/P6 范围)
- 任何 schema 改动、API 改动、权限改动
- 任何依赖升级(Next/React/Tailwind 锁定在当前版本)
- 第三方组件库
- 设计稿 / Figma 文件(以 animal-island-ui demo 站为视觉真值,不再二次出稿)
- 暗色模式 / i18n / 字号开关
- 备份/部署相关(P6)

---

## 3. 设计 token 落地(spec §7.2 → 代码)

### 3.1 `styles/tokens.css`

完整复用 spec §7.2 表,**一字不漏地落到 `@theme` 块**,新增三类补充 token:

```css
@import "tailwindcss";

@theme {
  /* === Color (spec §7.2 原样) === */
  --color-bg: #f8f8f0;
  --color-surface: rgb(247, 243, 223);
  --color-fg: #725d42;
  --color-fg-strong: #794f27;
  --color-muted: #9f927d;
  --color-accent: #19c8b9;
  --color-accent-hover: #3dd4c6;
  --color-accent-active: #11a89b;
  --color-success: #6fba2c;
  --color-warning: #f5c31c;
  --color-error: #e05a5a;
  --color-focus: #ffcc00;
  --color-border: #c4b89e;

  /* === Typography === */
  --font-display: 'Nunito', 'Noto Sans SC', 'Zen Maru Gothic', system-ui, sans-serif;
  --text-xs:   clamp(0.75rem, 0.72rem + 0.1vw, 0.8125rem);
  --text-sm:   clamp(0.875rem, 0.83rem + 0.15vw, 0.9375rem);
  --text-base: clamp(1rem, 0.95rem + 0.2vw, 1.0625rem);
  --text-lg:   clamp(1.125rem, 1.05rem + 0.3vw, 1.25rem);
  --text-xl:   clamp(1.25rem, 1.15rem + 0.4vw, 1.5rem);
  --text-hero: clamp(1.75rem, 1.4rem + 1.6vw, 2.5rem);

  /* === Shadow (任天堂按压阴影:核心签名) === */
  --shadow-press:        0 5px 0 0 #bdaea0;
  --shadow-press-hover:  0 6px 0 0 #bdaea0;
  --shadow-press-active: 0 1px 0 0 #bdaea0;
  --shadow-card:         0 4px 10px rgba(107, 92, 67, 0.42);
  --shadow-card-hover:   0 8px 18px rgba(107, 92, 67, 0.48);

  /* === Radius === */
  --radius-pill: 50px;
  --radius-card: 20px;
  --radius-sm:   12px;
  --radius-xs:   8px;

  /* === Motion === */
  --duration-fast:   120ms;
  --duration-normal: 220ms;
  --duration-slow:   360ms;
  --ease-press:      cubic-bezier(0.4, 0, 0.2, 1);
  --ease-out-expo:   cubic-bezier(0.16, 1, 0.3, 1);

  /* === Spacing rhythm(非均匀,故意打破"全 8px 网格") === */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-section: clamp(2rem, 1.5rem + 3vw, 5rem);

  /* === Z layer === */
  --z-tabbar: 40;
  --z-sticky: 50;
  --z-sheet:  60;
  --z-modal:  70;
  --z-toast:  80;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0ms;
    --duration-normal: 0ms;
    --duration-slow: 0ms;
  }
}
```

### 3.2 字体策略

- 自托管 Nunito / Noto Sans SC / Zen Maru Gothic 各取 **400 + 700** 两档,WOFF2 子集化(中文取 GB2312 子集 ~ 5–8MB → 子集化 < 800KB)
- `app/layout.tsx` 顶部 `<link rel="preload" as="font" crossorigin>` 仅预加载 **Nunito 400 + Noto Sans SC 400**,其余按需
- `font-display: swap`,首屏 FOUT 而非 FOIT
- spec §性能 / web 性能规则:landing JS < 150KB(P5 不引入新依赖,天然满足)

### 3.3 反 token 漂移护栏

新增 ESLint 规则桩(P5 落规则文件,执行延后到 P5 末):

```js
// eslint-rules/no-raw-color.js(P5 配套)
// 禁止 components/**/*.tsx / app/**/*.tsx 出现 #xxxxxx / rgb(... 字面色值,
// 必须走 var(--color-*) 或 Tailwind token 类。
// 白名单:styles/tokens.css、tests/**、注释、SVG 内联。
```

8 fixtures(4 正 + 4 反),与 P4 `parent-chain-join` 同结构。

---

## 4. 核心组件契约(11 个)

每个组件落 `components/ui/` 一个文件,同目录配 `*.test.tsx`。**不出 `index.ts`**,显式从子路径 import,避免 barrel re-export 的 tree-shaking 坑。

### 4.1 通用约定

- 全部 `'use client'` 仅在确有交互/状态时声明,纯展示组件(`Card` / `Tag` / `Avatar` / `Spinner`)保持 server-component-friendly
- 全部 forward `className` + `...rest`,内部 class 与外部 class 用 `cn()`(`lib/cn.ts`,30 行的 clsx 替代,**不引依赖**)合并
- props 一律 `interface XxxProps extends Pick<HTMLAttributes, ...>`,不重新发明事件类型
- 按压阴影组件(`Button` / `Card` 可交互态)统一 `transition: box-shadow var(--duration-fast) var(--ease-press), transform var(--duration-fast) var(--ease-press)`
- 所有交互组件实现 `:focus-visible` 黄色聚焦环 `outline: 3px solid var(--color-focus); outline-offset: 2px`,**不写 `outline: none`**

### 4.2 Button(签名最重的组件)

```tsx
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'error' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;       // default 'primary'
  size?: ButtonSize;             // default 'md'
  loading?: boolean;             // 显示斜纹动画,disabled 自动 true
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}
```

视觉规则:

| variant | bg | fg | press shadow color |
|---|---|---|---|
| primary | `--color-accent` | white | `#bdaea0`(暖灰)|
| secondary | `--color-surface` | `--color-fg` | `#bdaea0` |
| ghost | transparent | `--color-accent` | none(只做 underline-hover) |
| error | `--color-error` | white | `#a04545` |
| success | `--color-success` | white | `#508a20` |

按压动画(核心签名):

```css
.btn {
  box-shadow: var(--shadow-press);
  transform: translateY(0);
}
.btn:hover { box-shadow: var(--shadow-press-hover); transform: translateY(-1px); }
.btn:active { box-shadow: var(--shadow-press-active); transform: translateY(4px); }
@media (prefers-reduced-motion: reduce) {
  .btn, .btn:hover, .btn:active { transform: none; transition: none; }
}
```

loading 状态:`::before` 伪元素跑斜纹 `repeating-linear-gradient` + `background-position` 动画,文字 `opacity: 0.6`,事件 `pointer-events: none`。

a11y:`disabled` / `aria-busy={loading}` / `aria-disabled` 配齐。

### 4.3 Modal(桌面)+ BottomSheet(移动)

二者**共享** `useDialog` hook(focus trap + ESC + scroll lock + restore focus on close)。

判断依据(spec §7.3):**< 640px viewport 自动渲染 BottomSheet,>= 640px 渲染 Modal**。组件层面对调用方透明:

```tsx
<Dialog open onOpenChange={...} title="..."> ... </Dialog>
```

`Dialog` 内部走 `useMediaQuery('(min-width: 640px)')` 二选一渲染。

Modal 桌面端:
- 居中,`max-width: min(90vw, 480px)`
- 顶部 blob 装饰:`clip-path: path('M 0 30 Q 20 0 50 10 ...')` 内嵌 SVG `<defs>`,**纯 CSS**,无 Lottie
- 背景 dim `rgba(60, 48, 32, 0.4)` + `backdrop-filter: blur(2px)`

BottomSheet 移动端:
- 从底升起,`transform: translateY(100%) → 0`
- 顶部 24px 高度的 handle bar(灰色圆角小棒)
- 拖动手势:**仅 touchstart + touchmove + touchend**,不引 framer-motion / react-spring(spec §性能)
- 阈值:下滑 > 80px 或速度 > 0.5px/ms → 关闭

### 4.4 Toast

单 stack,底部居中,**同时最多 1 条**(新 toast 顶掉旧的,避免移动端遮挡 Tabbar)。

```tsx
const { show, dismiss } = useToast();
show({ message, action?, durationMs?, variant? });
```

variant 决定背景 token:`success` / `error` / `info`(默认 `info`)。reduced-motion 下淡入淡出改瞬切。

P4 的 `useTrashAction` 5s 撤销 toast 是 P5 `Toast` 的第一个真实消费者,**P5 提前实现 Toast,P4 直接使用**。

### 4.5 其余组件

- **Input / Textarea**:胶囊外形,聚焦时 `box-shadow: 0 0 0 3px var(--color-focus)` + border 变色;error 态 `border-color: var(--color-error)` + 下方 `<p aria-live="polite">`
- **Switch**:`role="switch"` + `aria-checked`,手柄 `box-shadow: var(--shadow-press)`,切换时手柄 `translateX` 动画 200ms
- **Card**:基础卡片;可选 `interactive` prop 启用 hover lift(`translateY(-4px) + --shadow-card-hover`)
- **Collapse**:`<div style="display:grid; grid-template-rows: ${open ? '1fr' : '0fr'};"><div style="overflow:hidden">{children}</div></div>`,纯 CSS 高度过渡,**不测高度**
- **Tag**:基础 chip;`removable` 显示右侧 × 按钮
- **Avatar**:`size: sm | md | lg`;无图片走背景色 + 首字母大写(取昵称首字符,中文取首字)
- **Spinner**:1.2s 旋转的 SVG 圆环,reduced-motion 下显示静态 `…` 字符

---

## 5. 移动端壳(5 个组件 + `AppShell` 组装)

### 5.1 Tabbar

底部固定 4 项:

| 路径 | icon | label |
|---|---|---|
| `/timeline` | 📔 / 自绘 SVG | 时光 |
| `/gallery` | 🖼️ / 自绘 | 画廊 |
| `/calendar` | 📅 / 自绘 | 日历 |
| `/profile` | 👤 / 自绘 | 我 |

- 高度 64px + `env(safe-area-inset-bottom)`
- active 项:背景 `--color-accent` 上凸 6px `translateY(-6px)` + 卡片阴影
- inactive:灰色描线
- 隐藏规则:`/login` / `/onboarding/*` 不渲染 Tabbar(`AppShell` 内 pathname 判断)
- `/gallery` 与 `/calendar` 路由 P5 不创建,Tabbar 链接到占位页 `/gallery`(返回简单"P6 开发中" 占位)以保留 4 格视觉完整

### 5.2 AppShell

```tsx
<AppShell title="时光" rightSlot={<UploadButton />}>
  {children}
</AppShell>
```

- 顶部 sticky 标题栏:title 居中,左右 slot 可选;高度 56px + 安全区
- 内容区:`<main>`,`overflow-y: auto`,`padding-bottom: calc(64px + env(safe-area-inset-bottom))` 留 Tabbar 空间
- Tabbar 由 AppShell 内部条件渲染
- `/login` / `/onboarding/*` 使用 `<PlainShell>`(不带 Tabbar/AppHeader 的简单容器)

### 5.3 ActionSheet / PullToRefresh / BottomSheet

- ActionSheet:iOS 风,从下升起,选项纵向列表,底部"取消"独立卡片;destructive 选项红字
- PullToRefresh:仅 touch device 启用;wrapper 监听 `scrollTop === 0 && touchmove.dy > 0` → 下拉指示器(自绘 spinner)+ release 触发 callback
- BottomSheet:见 §4.3

---

## 6. 业务组件抽取与页面刷新

P5 不写新页,但要**把现有页内嵌的 markup 抽出到 `components/features/`**,使下一阶段加新功能时不会复制粘贴。

### 6.1 抽取清单与对应页面

| 业务组件 | 抽自 | 落到 |
|---|---|---|
| `TimelineCard` | `app/timeline/page.tsx` 单条记录 markup | `components/features/TimelineCard.tsx` |
| `EntryComposer` | `app/entry/new/page.tsx` + `app/entry/[id]/edit/page.tsx` 共享 form | `components/features/EntryComposer.tsx` |
| `MilestonePicker` | `EntryComposer` 内的里程碑多选 | `components/features/MilestonePicker.tsx` |
| `MediaUploader` | `components/media/UploadButton.tsx` 视觉包装 | `components/features/MediaUploader.tsx` |
| `FamilyMemberList` | `app/profile/members/MembersAdminClient.tsx` 列表渲染 | `components/features/FamilyMemberList.tsx` |
| `BabyCard` | `app/profile/babies/BabiesAdminClient.tsx` 行 | `components/features/BabyCard.tsx` |
| `MilestoneRow` | `app/profile/milestones/MilestonesAdminClient.tsx` 行 | `components/features/MilestoneRow.tsx` |

### 6.2 页面刷新清单

| 页 | 主要工作 |
|---|---|
| `app/layout.tsx` | 接 `<ToastProvider>` + 字体 preload + html lang="zh" |
| `app/login/page.tsx` | 用 `Card` 包表单,`Input` + `Button`,品牌色背景 hero |
| `app/onboarding/baby/page.tsx` | 同上 + 大号情绪标题 "添加第一个宝宝" |
| `app/timeline/page.tsx` | 接 `AppShell` + `TimelineCard` 列表 + 顶部宝宝切换 chip(`Tag` 复用) |
| `app/entry/new/page.tsx` | 接 `AppShell`(无 Tabbar 全屏)+ `EntryComposer`;桌面端 `Modal` 包裹 |
| `app/entry/[id]/page.tsx` | 详情页,`Card` 主容器 + 里程碑 `Tag` + 媒体网格 |
| `app/entry/[id]/edit/page.tsx` | 复用 `EntryComposer` |
| `app/profile/page.tsx` | 个人主页,卡片化入口列表 |
| `app/profile/babies/*` | 接 `BabyCard` + `Button` |
| `app/profile/members/*` | 接 `FamilyMemberList` + `Modal` |
| `app/profile/milestones/*` | 接 `MilestoneRow` + `Tag` |
| 新增占位 `app/gallery/page.tsx` + `app/calendar/page.tsx` | "即将到来" 卡片,让 Tabbar 不指向 404 |

每页刷新原则:
- **不动数据加载/权限/redirect 逻辑**,只换 markup
- **删 Tailwind 重复工具类堆**,改 `<Button variant=...>`、`<Card>`、`<Tag>` 等语义组件
- 每改完一页,在 plan 对应任务里勾"已删除内嵌 `bg-*` / `text-*` / `rounded-*` 工具类,grep 验证"

---

## 7. 动效与降级

### 7.1 必做动效(全部用 CSS / Web Animations API,不引依赖)

| 元素 | 动效 |
|---|---|
| Button | 按压阴影变化 + Y 位移 120ms |
| Card(interactive) | hover lift -4px + shadow 加深 220ms |
| Modal | scale(0.96)→1 + opacity 0→1 220ms |
| BottomSheet | translateY(100%)→0 320ms ease-out-expo |
| Toast | translateY(20px)→0 + opacity 220ms,退场反向 |
| Tabbar active | translateY(-6px) spring-feel `cubic-bezier(0.34, 1.56, 0.64, 1)` 280ms |
| Collapse | grid-template-rows 220ms |
| Switch handle | translateX 200ms ease-press |
| Spinner | rotate(360deg) 1.2s linear infinite |

### 7.2 reduced-motion 矩阵

所有上述动效**必须**实现 `@media (prefers-reduced-motion: reduce)` 分支,基本规则:

- 位移类(`transform: translateY/X`):退化为瞬切
- 旋转类(Spinner):退化为静态字符 `…` 或暂停
- 不影响:颜色变化、阴影变化(无运动暗示,可保留)

E2E 覆盖:`tests/e2e/a11y.spec.ts` 中,设 `await context.emulateMedia({ reducedMotion: 'reduce' })`,跑 1 个 button click + 1 个 modal open + 1 个 toast,断言 `getComputedStyle(...).transitionDuration === '0s'`。

---

## 8. 测试策略

### 8.1 单元(`tests/unit/ui/*.test.tsx`)

每个 UI 组件最小 1 个用例:

- props 渲染正确(variant / size 走对 token)
- 关键 a11y 属性存在(`role` / `aria-*` / `tabIndex`)
- 交互组件:disabled 不可点击、loading 不触发 onClick

不追求高覆盖率;视觉回归是主防线。

### 8.2 视觉回归(`tests/e2e/visual-regression.spec.ts`)

**三档断点**:`{ width: 320, height: 720 }` / `{ width: 768, height: 1024 }` / `{ width: 1280, height: 800 }`。

**截图清单**(15 张 × 3 = 45 截图):

1. `/login`
2. `/onboarding/baby`(seeded:无宝宝家庭)
3. `/timeline`(seeded:3 条 entry + 1 张图)
4. `/timeline` + open BottomSheet(media uploader,移动端 320)
5. `/entry/new`
6. `/entry/[id]`
7. `/entry/[id]/edit`
8. `/profile`
9. `/profile/babies`
10. `/profile/members`
11. `/profile/milestones`
12. `/gallery`(占位页)
13. `/calendar`(占位页)
14. `(dev)/components` 主屏(全组件 demo)
15. `(dev)/components` + open Modal demo

**像素差阈值**:`maxDiffPixelRatio: 0.005`(0.5%);超过 → CI 失败,人工 review baseline 更新。

**字体反走样**:Playwright 启动加 `--font-render-hinting=none`(Linux CI 字体一致性),CI 镜像锁定 `mcr.microsoft.com/playwright:v1.48`。

### 8.3 a11y(`tests/e2e/a11y.spec.ts`)

引入 `@axe-core/playwright`(devDep,无运行时成本):

- 跑每个页面(同 §8.2 清单的 1–13),期望 **0 critical + 0 serious**
- moderate / minor 不阻塞 CI,记录到 `tests/e2e/a11y-report.md`,P5 末检视

键盘流测试(独立 spec):
- Tab 顺序合理(login → username → password → 提交)
- Modal 打开 → Tab 不出 Modal(focus trap)
- ESC 关 Modal
- Tabbar 在桌面端可 ↑/↓ 切换

### 8.4 reduced-motion(同 spec)

3 个用例,见 §7.2。

### 8.5 总测试矩阵规模估算

| 类型 | 数量 |
|---|---|
| Unit(UI 11 + features 7) | ~18 个测试文件 |
| Visual regression | 15 截图 × 3 断点 = 45 |
| a11y | 13 页 |
| 键盘流 | 3 用例 |
| reduced-motion | 3 用例 |
| token guard ESLint | 8 fixtures |

CI 增量耗时估算:Playwright 视觉回归 ~ 3–5 分钟(锁定镜像、并行 4 worker)。

---

## 9. 性能预算(spec web 规则对账)

P5 引入字体 + token CSS + 一批组件 JS,需确保仍在预算内:

| 指标 | 预算 | P5 落地策略 |
|---|---|---|
| JS gzipped (landing) | < 150KB | 不引新依赖;UI 组件平均 < 1KB gzipped;预估 +12KB |
| CSS gzipped | < 30KB | tokens + tailwind purged 后预估 +6KB |
| LCP | < 2.5s | 字体 preload only Nunito 400 + Noto 400,其余 swap |
| CLS | < 0.1 | 字体子集化避免回流;`font-display: swap` + 字号 clamp 锁高度 |
| INP | < 200ms | 所有动效 transform/opacity only;无 layout 触发动画 |

CI Lighthouse 不强制(避免 flaky),改为人工 + 单次本地基线截图存档 `docs/perf/p5-lighthouse-baseline.json`。

---

## 10. 实施顺序建议(交给 P5 plan)

为最小化合并冲突 + 让中间状态可见,plan 建议如下顺序(plan 阶段细化):

1. **Tokens + globals.css + 字体**(全局基建,最先合)
2. **`lib/cn.ts` + 4 个零依赖纯展示组件**(Card / Tag / Avatar / Spinner)+ demo 路由骨架
3. **Button + Input + Textarea + Switch**(交互基础)+ demo 卡 + 单测
4. **`useDialog` + Modal + BottomSheet + Dialog 自适配**
5. **Toast + ToastProvider 接入 `app/layout.tsx`**(P4 等这一步)
6. **Collapse**(用得少,放后)
7. **AppShell + Tabbar + 占位 /gallery /calendar**
8. **业务组件抽取**(TimelineCard / EntryComposer / MilestonePicker / FamilyMemberList / BabyCard / MilestoneRow)
9. **页面刷一遍**(7 页 + Layout)
10. **视觉回归基线**(每页人工 review 一次后写入 baseline)
11. **a11y + reduced-motion + 键盘流 E2E**
12. **`no-raw-color` ESLint 规则 + CI 接线**
13. **`docs/DESIGN.md`** 收尾

每一步合一次 PR,plan 用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans` 推进;视觉回归 baseline 不能由 subagent 自动接受,必须人工 review。

---

## 11. 验收(Acceptance)

P5 plan 末尾 `## Acceptance` 复用此清单:

1. ✅ `styles/tokens.css` 落地 spec §7.2 全部 token,`app/globals.css` 不再有 placeholder 注释
2. ✅ `components/ui/` 11 个核心组件齐,每个有单测 + demo
3. ✅ `components/mobile/` 5 个移动端组件齐
4. ✅ `components/features/` 7 个业务组件抽出
5. ✅ 7 个现有页 + Layout 全部刷过,grep 现有页面**无原始色值字面量**(`#[0-9a-f]{3,6}`),所有按钮均通过 `<Button>` 渲染
6. ✅ Tabbar 在移动断点(< 640px)正常显示,4 个 tab 跳转正常
7. ✅ `pnpm playwright test visual-regression` 45 截图全过(初次写入 baseline 由人工 review)
8. ✅ `pnpm playwright test a11y` 0 critical / 0 serious 违规
9. ✅ reduced-motion 3 用例通过(动效退化为瞬切)
10. ✅ Lighthouse 本地一次性跑 `/timeline` 移动断点:Performance ≥ 90,Accessibility ≥ 95
11. ✅ `pnpm lint` 通过,`babyloom/no-raw-color` 在 `--print-config` 中可见
12. ✅ JS gzipped(landing)< 150KB,CSS gzipped < 30KB(Next build 输出实测)
13. ✅ `docs/DESIGN.md` 涵盖 11 + 5 + 7 个组件 API 与 token 表
14. ✅ P4 `useTrashAction` 的 5s 撤销 toast 通过 P5 `Toast` 工作(交叉验证)
15. ✅ Spec §7 与实现 100% 对齐(token 表逐项对照,无遗漏、无私加)

---

## 12. Spec ↔ Impl 对账要点(plan 落笔前必做)

延续 P1 round-10 / P4 §8 原则:**plan 头部先 grep 真实代码,不能只读 spec**。P5 plan Task 0 跑:

```bash
# 1. 现有页面有多少处硬编码颜色 / 圆角 / 阴影
grep -rE '#[0-9a-fA-F]{3,6}' app/ components/ | grep -v '\.test\.' | wc -l
grep -rE 'rounded-(sm|md|lg|xl|full)' app/ components/ | wc -l
grep -rE 'shadow-' app/ components/ | wc -l

# 2. 现有 Tailwind 工具类堆点(决定页面刷新工作量)
grep -rE 'className="[^"]{120,}"' app/ components/ | wc -l   # 超长 className 行数

# 3. 现有 UI 组件目录是否被偷偷建过
ls components/ui components/mobile components/features 2>/dev/null

# 4. P2b 三个 admin client 已有的"半成型"按钮/卡片样式
grep -rE 'button|Card|Modal' app/profile/{babies,members,milestones}/ | head -20

# 5. P3 的 UploadButton / MediaImage 视觉与新 token 的差距
cat components/media/UploadButton.tsx | grep -E 'className|style'

# 6. P4 Trash 页(若已开工)对 Toast / Modal 的依赖时序
grep -rE 'useTrashAction|Toast|toast' app/ lib/ 2>/dev/null
```

**冲突处理原则**:spec 是"应当如此",P2b/P3 现有实现可能已经偏离;P5 调整方向是**让实现回归 spec**(不像 P4 那样反向)—— 因为 spec §7 还没真正落过,这次是首次落地,不存在"已交付决策不可回退"问题。

典型冲突点:
- P2b admin 页里的按钮颜色 vs spec 主色 `#19c8b9` → 刷掉 P2b 的零散色值
- 现有 `components/media/UploadButton.tsx` 自己写了样式 → 改成 `MediaUploader` 包装,样式走 token
- 字体当前 `system-ui, sans-serif`(`app/globals.css`)→ 换 Nunito + Noto Sans SC

---

## 13. 与 P6+ 的接口

| 项 | 阶段 | P5 留给后续的挂点 |
|---|---|---|
| `/gallery` 真实实现 | P6 | 占位页用 `AppShell` + `Card`,后续替换 `<main>` 内容即可 |
| `/calendar` 真实实现 | P6 | 同上 |
| `/profile/me` | P6 | 入口已在 `/profile/page.tsx` 卡片化列表,P6 加路由 |
| `/profile/trash`(P4 已规约) | P4 实施期 | P5 完成后 P4 实施直接消费 `Toast` / `Modal` / `Card` / `Tag` |
| `/profile/data` 备份/日志查看 | P6 | 同 trash 一致的 `Card` + 列表语义 |
| `baby_member_permissions` 细粒度 UI | P6 或更后 | schema 已存在(P1),UI 不动 |
| 暗色模式 | 永不做(spec §7.4) | token 已用 CSS var,真要做后续可加 `[data-theme=dark]` 覆盖 |
| i18n / 字号开关 | 永不做(spec §7.4) | — |

---

**下一步**:本 spec 经用户 review 后,进入 writing-plans 阶段,产出 `docs/superpowers/plans/2026-05-17-P5-design-system.md` 实施计划。
