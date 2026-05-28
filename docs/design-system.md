# Babyloom Design System

设计系统刻意保持小而克制:tokenized CSS + 单文件 React 组件,没有运行时 UI 依赖库。本文档描述约定与边界;**具体的 token 名称和组件清单以源码为准**,不在此枚举(枚举必然漂移)。

- **Token 源**:[`app/styles/tokens.css`](../app/styles/tokens.css)(由 [`app/globals.css`](../app/globals.css) 引入)
- **字体声明**:[`app/styles/typography.css`](../app/styles/typography.css)
- **组件**:[`components/`](../components/) 下 `ui/` `mobile/` `features/` 三类

## Tokens

所有设计原子都是 CSS 自定义属性,定义在 `app/styles/tokens.css` 的 `:root` 并桥接到 Tailwind v4 `@theme`。分组:

| 分组 | 前缀 | 用途 |
| --- | --- | --- |
| 颜色 | `--color-*` | 背景、表面、前景、强调、语义色(success/warning/error)、边框、焦点、头像色板等 |
| 字号 | `--text-*` | 从 `--text-xs` 到 `--text-hero` 的字号阶梯 |
| 字重 | `--font-*` | `--font-regular` / `--font-medium` / `--font-semibold` / `--font-bold` 及 `--font-display` 字体栈 |
| 阴影 | `--shadow-*` | 按压阴影 `--shadow-press-*`、柔和阴影 `--shadow-soft-*`、`--shadow-sheet`、焦点环 `--shadow-focus*` |
| 圆角 | `--radius-*` | `--radius-sm` 到 `--radius-hero`,加 `--radius-pill` |
| 间距 | `--space-*` | 数字阶梯加 `--space-section` |
| 图层 | `--z-*` | `--z-tabbar` / `--z-sticky` / `--z-sheet` / `--z-modal` / `--z-toast` |

具体取值与完整列表见 `app/styles/tokens.css`。

`app/` 与 `components/` 中禁止裸写 hex/rgb,由 ESLint 规则 `babyloom/no-raw-color` 拦截。新增颜色先在 `app/styles/tokens.css` 加 token。

## Typography

字体自托管在 [`public/fonts/`](../public/fonts/),在 `app/styles/typography.css` 用 `@font-face` 声明。显示字体栈:

```css
Nunito, Noto Sans SC, Zen Maru Gothic, system-ui, sans-serif
```

三个字族(Nunito、Noto Sans SC、Zen Maru Gothic)各提供 400 与 700 两个字重的 WOFF2,`font-display: swap`。

## 组件

从各自文件直接 import,**没有 barrel export**。三类:

- **`components/ui/`** —— 通用基础控件(按钮、输入、卡片、对话框、开关、标签、头像、Toast、图标等),与业务无关。
- **`components/mobile/`** —— 移动端外壳与触控交互(AppShell 标题栏 + 内容区 + 条件 Tabbar、BottomSheet、ActionSheet、下拉刷新等)。
- **`components/features/`** —— 页面级业务视图组件(时间线卡片、记录编辑器、画廊网格、日历、成员列表、备份面板等),包裹视觉结构但不承载业务规则。

各组件的具体 props 和职责以源码为准;`*.test.tsx` 同目录给出最小用例。

## Motion

动效只用 CSS 变量驱动(时长 `--duration-*`、缓动 `--ease-*`,见 tokens.css),不写字面时长。`prefers-reduced-motion: reduce` 时把时长 token 归零;组件用 tokenized 时长即可自动适配。

## 验证

改动设计系统前后运行:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
```

视觉基线在 [`tests/e2e/visual-regression.spec.ts`](../tests/e2e/visual-regression.spec.ts)。更新快照前需人工审阅截图再提交。

## 用法示例

### 颜色:必须用 token,不能写 hex

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

需要新颜色时,先在 `app/styles/tokens.css` 中加入 token,再在组件里引用。

### 字号:用 `--text-*` 阶梯而不是字面值

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

### 间距:优先 `--space-*`

用 `--space-*` 阶梯加 `--space-section`,不要写魔法 px。

### 圆角与阴影

按用途从 token 取:`--radius-card` 给卡片、`--radius-pill` 给按钮、`--radius-sm` 给小控件;阴影用 `--shadow-soft-*` 给平铺面板、`--shadow-press-*` 给可按压控件、`--shadow-sheet` 给浮层。具体可用值见 tokens.css。

### 图层(z-index)

不要写字面 `z-index`,用 `--z-tabbar` / `--z-sticky` / `--z-sheet` / `--z-modal` / `--z-toast`,保证视觉层级一致。
