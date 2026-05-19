# UI 设计语言规范

**日期**:2026-05-18
**适用范围**:babyloom V2 全部前端页面与组件
**与 P5 spec 的关系**:P5(`2026-05-17-P5-design-system.md`)定的是"建什么、铺什么";本文定的是"长什么样、动什么样"。**两者冲突时以本文为准**,P5 实施按本文纠偏。
**视觉真值参照**:[animal-island-ui 源码](https://github.com/guokaigdg/animal-island-ui) + Timeline v5 mockup(`.superpowers/brainstorm/.../timeline-motion.html`)

---

## 1. 设计原则(铁律)

这 6 条贯穿全部组件与页面。**任何违反必须在 PR 描述里说明理由**;否则按违规处理。

### 1.1 平面优先,按压阴影专用

> **容器是平的,只有可按物件有阴影。**

- **平面元素**(无边框、无投影、不响应 hover):Card、Hero、Section、Modal 内容区、列表行
- **有按压阴影的元素**(有 `box-shadow: 0 Npx 0 0 #bdaea0`):Button、FAB、切宝宝胶囊、Tabbar 激活态、Switch 手柄
- **极轻软阴影**(`0 2px 4px 0 rgba(61,52,40,.06)`,几乎不可见):仅 Input / Textarea / Select 等输入控件,提示"可输入"的微弱深度

**反模式**(P5 实施时已踩):

```css
/* ❌ 给每张卡片加 2px 边框 + 4px 实色按压阴影 */
.card { border: 2px solid #e6dccf; box-shadow: 0 4px 0 0 #bdaea0; }

/* ✅ 卡片就是平面奶油色 */
.card { background: #f7f3df; border-radius: 20px; }
```

按压阴影是 animal-island-ui 的**视觉签名**——只属于"能按下去"的东西。滥用到容器上会让整个 UI 显得幼稚、塑料、堆叠拥挤。

### 1.2 温暖暖棕色,不用近黑

正文 `#794f27`、次级 `#9f927d`、禁用 `#c4b89e`。**不允许使用 `#000` / `#222` / `#333` 等近黑色**——在 `#f8f8f0` 羊皮纸底上,近黑会显得割裂、冷硬,与整体的"自然、温暖、像绘本"调性冲突。

### 1.3 圆角分层

| 层级 | 圆角 | 用于 |
|---|---|---|
| 小元素 | 16px | Tag、Chip、Input、小 Button |
| 卡片 | 20px | Card、TimelineCard、列表卡 |
| Hero | 22px | Timeline Hero、首屏大图 |
| Sheet / Modal | 24px | BottomSheet 顶圆、Modal、ActionSheet |

胶囊形 Button / Pill / FAB 用 `border-radius: 999px`,不参与上表。

### 1.4 Mobile-first,无 `:hover`

babyloom 是手机为主的家庭 PWA。**所有 `:hover` 状态必须用 `@media (hover: hover) and (pointer: fine)` 圈起来,或干脆不写**。

理由:
- 触屏没有 hover 概念
- Android Chrome 的"粘性 hover" bug:点过的元素会卡在 `:hover` 状态直到点别处
- 桌面浏览器即便能用到,价值也很有限——按压反馈已经够

```css
/* ❌ 在 mobile-first 产品里裸写 :hover */
.card:hover { transform: translateY(-2px); }

/* ✅ 限定真鼠标设备 */
@media (hover: hover) and (pointer: fine) {
  .card:hover { transform: translateY(-2px); }
}

/* ✅ 干脆不写(本项目默认选择) */
```

### 1.5 动效必须有功能意义

只允许 5 类动效。**纯装饰性、悬停浮动、审美微动效一律砍**。

| 类型 | 例子 | 目的 |
|---|---|---|
| 进场 | Hero / Card 错峰上滑淡入 | 让用户感知"页面正在加载完成" |
| 反馈 | 按压、Tabbar 激活胶囊上凸 | 给手指即时确认 |
| 状态指示 | Spinner、Loading 斜纹 | 告诉用户"正在处理" |
| 信息显现 | Toast 托出、BottomSheet 拉起 | 把信息送进视线 |
| 氛围 | Hero 14s ken-burns 漂移 | 让静态图片"还活着"(仅 Hero 这一处) |

### 1.6 全部动效遵守 `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

进场动画在 reduced-motion 下应**立刻显示终态**(不能从隐藏跳到可见有可察觉延迟)。Hero 的 ken-burns 必须停。按压反馈可以保留(改成"瞬时"切换,不是"动画过渡")。

---

## 2. 设计令牌(Tokens)

所有 token 必须 1:1 落到 `styles/tokens.css` 的 `:root` 与 Tailwind v4 `@theme`。**禁止在组件里写魔法数字**(颜色、字号、间距、圆角、时长都从 token 取)。

### 2.1 颜色

```css
:root {
  /* ---------- 背景层 ---------- */
  --color-bg:           #f8f8f0;  /* 页面底 · 羊皮纸 */
  --color-surface:      #f7f3df;  /* 卡片底 · 奶油 */
  --color-surface-2:    #fdfdf5;  /* 浮起表面 · 切宝宝胶囊 / 输入框 */
  --color-bg-disabled:  #f0ece2;

  /* ---------- 文字 ---------- */
  --color-fg:           #794f27;  /* 正文 · 暖棕 */
  --color-fg-soft:      #9f927d;  /* 次级 · 沙棕 */
  --color-fg-strong:    #5d3a14;  /* 强调标题 · 深棕 */
  --color-fg-disabled:  #c4b89e;
  --color-fg-inverse:   #ffffff;  /* 主色按钮上的白字 */

  /* ---------- 描边 ---------- */
  --color-border:        #aaa69d;
  --color-border-light:  #e8e2d6;  /* 极淡分隔线(Tabbar 顶部线) */
  --color-border-hover:  #827157;

  /* ---------- 品牌色 ---------- */
  --color-primary:        #19c8b9;  /* 薄荷绿 · 主行动 */
  --color-primary-hover:  #3dd4c6;
  --color-primary-active: #50b9ab;
  --color-primary-bg:     #e6f9f6;

  /* ---------- 语义色 ---------- */
  --color-success:        #6fba2c;
  --color-success-hover:  #85cc45;
  --color-success-active: #5a9e1e;

  --color-warning:        #f5c31c;  /* 兼任聚焦黄 */
  --color-warning-hover:  #f7d04a;
  --color-warning-active: #dba90e;

  --color-error:          #e05a5a;
  --color-error-hover:    #e87878;
  --color-error-active:   #c94444;

  --color-focus:          var(--color-warning);  /* 聚焦黄 = warning */

  /* ---------- 按压阴影色 ---------- */
  --color-press-shadow:        #bdaea0;  /* 默认按压色,棕灰 */
  --color-press-shadow-primary: #13a89b;  /* 薄荷绿按钮的按压色 */
  --color-press-shadow-error:   var(--color-error-active);

  /* ---------- 头像配色(分配给家庭成员) ---------- */
  --color-avatar-pink:   #f8a6b2;
  --color-avatar-blue:   #889df0;
  --color-avatar-yellow: #f5c31c;
  --color-avatar-mint:   #19c8b9;
  --color-avatar-peach:  #e59266;
  --color-avatar-teal:   #82d5bb;
  --color-avatar-purple: #b77dee;
  --color-avatar-green:  #8ac68a;
}
```

**重要**:不再使用 spec §7.2 里的 `--color-focus: #ffcc00`,统一改为 `var(--color-warning)`(`#f5c31c`,与 animal-island-ui 源码对齐)。这是与 P5 spec 的**第一处显式差异**。

### 2.2 字体

```css
:root {
  --font-family: Nunito, 'Noto Sans SC', 'Zen Maru Gothic',
                 'HarmonyOS Sans SC', 'MiSans',
                 -apple-system, 'PingFang SC', 'Hiragino Sans GB',
                 'Microsoft YaHei', sans-serif;

  --text-xs:   11px;   /* 时间戳、角标 */
  --text-sm:   12px;
  --text-base: 13.5px; /* 正文(animal-island 是 14,我们略小 0.5 适配中文) */
  --text-md:   14px;
  --text-lg:   16px;
  --text-xl:   18px;
  --text-2xl:  22px;   /* AppShell 标题 */
  --text-hero: 28px;   /* 仅 Onboarding / 大型空态 */

  --leading-tight:  1.2;
  --leading-base:   1.55;
  --leading-relax:  1.7;

  --font-regular: 400;
  --font-medium:  500;  /* 中文正文偏好(避免 bold 在小字号下糊) */
  --font-semibold: 700;
  --font-bold:    800;  /* 标题 / 强调 */
}
```

**字重规则**:中文正文用 `medium (500)` 即可,避免在小字号下用 `bold` 导致笔画糊在一起。标题、按钮文字用 `semibold (700)` 或 `bold (800)`。

### 2.3 间距

```css
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;   /* 卡片间距、列表行间距 */
  --space-4:  16px;   /* 卡片内 padding 上下 */
  --space-5:  18px;   /* 卡片内 padding 左右 */
  --space-6:  24px;   /* AppShell 顶部 padding */
  --space-7:  32px;
  --space-8:  48px;
}
```

### 2.4 圆角

```css
:root {
  --radius-sm:    16px;  /* Tag / Chip / Input */
  --radius-base:  18px;  /* Button (large) */
  --radius-card:  20px;  /* Card */
  --radius-hero:  22px;  /* Hero */
  --radius-lg:    24px;  /* Sheet / Modal */
  --radius-pill:  999px;
}
```

### 2.5 阴影

```css
:root {
  /* ---------- 按压阴影(默认/激活态)---------- */
  /* 大尺寸按钮 / FAB */
  --shadow-press-lg:        0 5px 0 0 var(--color-press-shadow);
  --shadow-press-lg-active: 0 1px 0 0 var(--color-press-shadow);
  /* 中尺寸 Button / Tabbar 激活胶囊 */
  --shadow-press-md:        0 4px 0 0 var(--color-press-shadow);
  --shadow-press-md-active: 0 1px 0 0 var(--color-press-shadow);
  /* 小尺寸 / 切宝宝胶囊 / 浮起 Pill */
  --shadow-press-sm:        0 3px 0 0 var(--color-press-shadow);
  --shadow-press-sm-active: 0 1px 0 0 var(--color-press-shadow);

  /* ---------- 软阴影(仅 Input 类)---------- */
  --shadow-soft-sm:  0 2px 4px  0 rgba(61,52,40,.06);
  --shadow-soft-md:  0 3px 10px 0 rgba(61,52,40,.10);
  --shadow-soft-lg:  0 8px 24px 0 rgba(61,52,40,.14);  /* Modal / Sheet 浮起 */
}
```

#### 2.5.1 关键规则:**按压 translateY 必须等于阴影减量**

> 按下时 `translateY` 的像素值 = `idle shadow Y` − `active shadow Y`

| 阴影规格 | translateY | 原因 |
|---|---|---|
| `0 5px → 0 1px` | `translateY(4px)` | Δ = 4 |
| `0 4px → 0 1px` | `translateY(3px)` | Δ = 3 |
| `0 3px → 0 1px` | `translateY(2px)` | Δ = 2 |

**违反的后果**:视觉上"阴影在动、按钮没动",失去按压触感。
**注**:animal-island-ui 自己源码里 primary button 是 `5px→1px` 配 `translateY(2px)`,即只补偿一半——在小尺寸 Button 上勉强可看,但**在 56px FAB 上不能用**。本项目统一按"全补偿"规则,不沿用 animal-island 的半补偿。

### 2.6 动效

```css
:root {
  --duration-fast:    150ms;
  --duration-base:    250ms;
  --duration-slow:    350ms;
  --duration-entry:   500ms;
  --duration-ambient: 14000ms;  /* Hero ken-burns */

  --ease:              cubic-bezier(.4, 0, .2, 1);   /* 通用 */
  --ease-out-back:     cubic-bezier(.34, 1.56, .64, 1);  /* 仅 Tabbar 激活胶囊上凸 */
  --duration-press:    80ms;     /* 按下瞬间 */
  --duration-press-up: 120ms;    /* 松开回弹 */
}
```

**`ease-out-back`(轻微 overshoot 弹性)只允许用在 Tabbar 激活胶囊一处**。Modal / Sheet / Toast 等都用 `--ease`(无 overshoot),否则整个 UI 会显得"过度甜腻"。

---

## 3. 阴影使用矩阵

一张表查所有组件该不该有阴影、该有哪种阴影。

| 组件 | 阴影类型 | 备注 |
|---|---|---|
| Card | ❌ 无 | 平面奶油底 |
| Hero | ❌ 无 | 有图时铺图;无图时同 Card |
| Modal 内容区 | ❌ 无 | Modal 容器本身用 `shadow-soft-lg` |
| BottomSheet 内容 | ❌ 无 | Sheet 容器本身用 `shadow-soft-lg` |
| ActionSheet 项 | ❌ 无 | 同上 |
| 列表行 | ❌ 无 | 用 `--color-border-light` 1px 分隔 |
| Tag / Chip(普通) | ❌ 无 | |
| Avatar | ❌ 无 | |
| AppShell 顶栏 | ❌ 无 | |
| Tabbar 容器 | ❌ 无 | 顶部 1px 分隔线即可 |
| Section / Divider | ❌ 无 | |
| Button(Primary) | `--shadow-press-lg` → `-lg-active` | mint 色按钮用 `--color-press-shadow-primary` 代替默认 |
| Button(Default / Secondary) | `--shadow-press-md` → `-md-active` | |
| Button(Ghost / Text / Link) | ❌ 无 | |
| Button(Loading 态) | ❌ 无 | 按钮"锁住",不再响应按压 |
| FAB | `--shadow-press-lg` → `-lg-active`,阴影色用 `--color-press-shadow-primary`(与 mint 主色协调) | `translateY(4px)` |
| 小型可按胶囊(含头像/图标的浮起胶囊) | `--shadow-press-sm` → `-sm-active` | `translateY(2px)` |
| Tabbar 激活胶囊 | `--shadow-press-md` 永驻 | 激活时上凸 `-6px`,无按压切换 |
| Switch 手柄 | `--shadow-press-sm` | 切换时仅水平位移 |
| Modal / BottomSheet / ActionSheet 容器 | `--shadow-soft-lg` | 浮起感 |
| Toast | `--shadow-soft-md` | |
| Input / Textarea / Select | `--shadow-soft-sm` | 极弱深度 |
| Input(:focus) | `--shadow-soft-sm` + 半透明黄晕 `0 0 0 3px rgba(245,195,28,.25)` | 软光晕焦点环 |
| DateRow(DatePicker 触发器) | `--shadow-soft-sm` | 同 Input |
| Dashed Card(空态) | ❌ 无 | 改用 `border: 2px dashed var(--color-border-light)` |

---

## 4. 组件视觉规范

按"基础组件 → 移动壳 → 业务组件"三层列出。每个组件给:**视觉规则、状态、a11y 要点**。

### 4.1 Card

```
背景:    --color-surface       (#f7f3df)
圆角:    --radius-card         (20px)
内边距:  16px 上下 / 18px 左右
边框:    无
阴影:    无
正文色:  --color-fg
```

变体:

| 变体 | 用法 |
|---|---|
| `Card` 默认 | TimelineCard、列表项、内容容器 |
| `Card.dashed` | 空态、占位、"添加 +" CTA 卡 |
| `Card.tinted-{color}` | 里程碑卡、强调卡(头像配色色板) |

**Card.dashed** 规则:

```
背景:    --color-surface-2     (#fdfdf5)
边框:    2px dashed --color-border-light
阴影:    无
```

**`Card.interactive`(可点击的卡片)**:不加任何 hover/active 视觉变化。点击反馈靠**路由切换的过渡**自然吸收。**禁止给可点 Card 加按压阴影、边框**。

### 4.2 Button

通用规则:

```
圆角:        --radius-pill (999px)
字重:        --font-semibold (700)
高度:        sm 32 / md 40 / lg 48
内边距:      左右 = 高度 × 0.6
transition:  transform var(--duration-press) var(--ease),
             box-shadow var(--duration-press) var(--ease)
:active:     transform: translateY(N),
             box-shadow: 0 1px 0 0 ...
             transition-duration: var(--duration-press)
```

| 变体 | 默认外观 | 默认阴影 | 按压 translateY |
|---|---|---|---|
| `primary` | mint bg + 白字 | `--shadow-press-lg`(用 primary 阴影色) | 4px |
| `default` | surface-2 bg + 暖棕字 | `--shadow-press-md` | 3px |
| `ghost-primary` | 透明 + mint 字 + mint 描边 | 无 | 0(仅透明度变化) |
| `text` | 透明 + 暖棕字 | 无 | 0 |
| `link` | 透明 + mint 字下划线 | 无 | 0 |
| `danger` | error bg + 白字 | `--shadow-press-lg`(用 error 阴影色) | 4px |
| `loading` | mint bg + 斜纹动画 | 无 | 锁定,无按压 |

**Loading 态**:

```css
.btn-loading {
  pointer-events: none;
  background: var(--color-primary-active);
  background-image: repeating-linear-gradient(
    -45deg,
    var(--color-primary-active),
    var(--color-primary-active) 10px,
    var(--color-primary) 10px,
    var(--color-primary) 20px
  );
  background-size: 28.28px 28.28px;
  animation: btn-loading-stripe 1s linear infinite;
  box-shadow: none;
}
@keyframes btn-loading-stripe {
  to { background-position: -28.28px 0; }
}
```

a11y:

- `disabled` 状态:`opacity: 0.5; cursor: not-allowed; box-shadow: none`,移除按压交互
- 焦点环:`outline: 3px solid var(--color-focus); outline-offset: 2px`
- Loading 时设 `aria-busy="true"`

### 4.3 Input / Textarea

```
背景:        --color-surface-2 (#fdfdf5)
圆角:        --radius-sm (16px) for Input, --radius-card (20px) for Textarea
边框:        2px solid --color-border-light
阴影:        --shadow-soft-sm
高度(Input): 40px;  padding 0 14px
:focus:      border-color: var(--color-focus);
             box-shadow: 0 0 0 3px rgba(245,195,28,.25), var(--shadow-soft-sm);
             outline: none
             ⚠️ 不要用 `outline: 3px solid var(--color-focus)` —— 2px border 与 3px outline 同色堆叠
             会形成 5px 实色黄带,过于笨重。改用半透明黄晕。
:disabled:   opacity 0.5; background: var(--color-bg-disabled)
error 态:    border-color: var(--color-error)
error + focus: border-color: var(--color-error);
             box-shadow: 0 0 0 3px rgba(224,90,90,.22), var(--shadow-soft-sm)
```

Textarea:`min-height: 100px`,`resize: none`,通过 JS 监听 input 事件 auto-resize 到最多 6 行;**不允许显式 resize 手柄**(会破坏视觉一致)。

**禁止使用原生 `<input type="date">` / `<input type="datetime-local">` / `<input type="time">`**:桌面端浏览器渲染各异、与 Animal Crossing 视觉脱节。日期/时间字段统一用 §4.15 DatePicker。

### 4.4 Switch

```
轨道:    40px × 24px,radius 999,
         off: --color-border-light,
         on:  --color-primary
手柄:    18px 圆形,白底,top 3 / left 3 (off) → translateX(16px) (on)
         box-shadow: --shadow-press-sm
切换动画: transition: background var(--duration-base) var(--ease),
                     transform var(--duration-base) var(--ease-out-back)
```

a11y:`role="switch"` + `aria-checked={true/false}`。

### 4.5 Tag

```
背景:    neutral: var(--color-bg-disabled)
         accent:  var(--color-primary-bg)
         error:   #fbe4e4
字色:    neutral: var(--color-fg-soft)
         accent:  var(--color-primary-active)
         error:   var(--color-error-active)
字号:    --text-sm
圆角:    --radius-sm (16px) — 不用 pill
内边距:  4px 上下 / 10px 左右
```

可选 `onRemove`:右侧加一个 `×` 图标,可点击。

### 4.6 Avatar

```
形状:    圆 (border-radius: 50%)
尺寸:    xs 24 / sm 32 / md 40 / lg 56 / xl 88
fallback: 渐变背景 + 中文姓氏首字 / 英文首字母大写
        背景色从头像色板按 `hash(userId) % 8` 分配
        字色:暖色头像底用 #fff,黄色头像底用 #724a00
```

`<AvatarGroup>` 叠层:第二个起 `margin-left: -8px`,加 2px 白色描边。

### 4.7 Modal

居中对话框,用于**确认、警告、需要简短输入**的场景。

```
遮罩:        rgba(61,52,40,.45),fade-in --duration-base
容器背景:    --color-surface-2 (#fdfdf5)
容器圆角:    --radius-lg (24px)
容器阴影:    --shadow-soft-lg
最大宽:      桌面 480px;移动端宽 = 100% - 32px (left/right 各 16)
垂直位置:    top: 50%,translateY(-50%)
内边距:      22px 上下 / 24px 左右
标题:        --text-lg (16px) 实测显大可用 --text-xl (18px),--font-bold,--color-fg-strong
            margin-bottom: 8px
正文:        --text-base (13.5px),--leading-base,--color-fg
            margin-bottom: 18px
按钮行:      flex,gap 10px,两个按钮等宽(flex: 1)
            destructive 操作必须放右侧(主操作位置)
进场:        opacity 0 → 1 + translateY(calc(-50% + 8px)) scale(.96) → translateY(-50%) scale(1)
            --duration-base var(--ease),用 backwards fill-mode
退场:        反向,--duration-fast (150ms)
ESC 关:      ✅
点遮罩关:    ✅ (但 destructive Modal 应禁用点遮罩关,避免误关)
focus trap:  ✅(打开时焦点落到主操作按钮或第一个 input)
关闭按钮 ×:  仅信息展示型 Modal 加,确认/警告型不加(避免与"取消"重复)
```

**禁止顶部加 blob clip-path 装饰**——原 spec §7.6 提到但实际过于花哨,会破坏温和感。Modal 就是平静的对话框。**这是与 P5 spec 的第二处显式差异**。

### 4.8 Collapse

```
机制:    grid-template-rows: 0fr → 1fr 配合 overflow:hidden(无需测量高度)
时长:    --duration-slow (350ms)
缓动:    --ease
箭头:    rotate(0deg) → rotate(180deg)
```

### 4.9 Toast

```
位置:    底部居中,bottom: 96px(避开 Tabbar)
背景:    --color-fg (#794f27)
字色:    --color-fg-inverse (#fff)
字号:    --text-sm
圆角:    --radius-pill
内边距:  10px 上下 / 18px 左右
阴影:    --shadow-soft-md
进场:    translateY(20px) opacity 0 → 0 1,350ms ease
持续:    5000ms 默认;含 action 时 8000ms
退场:    translateY(20px) opacity 0,250ms
最大堆: 1 (新 Toast 替换旧)
```

`role="status"` for info / success;`role="alert"` for error。

### 4.10 Spinner

```
尺寸:    sm 16 / md 24 / lg 32
形状:    圆环,边框 3px,主色 = --color-primary,辅色 = transparent
动画:    rotate 1.2s linear infinite
reduced-motion: 改为脉冲透明度(opacity .4 ↔ 1, 1s ease-in-out)
```

### 4.11 移动壳 · Tabbar

```
高度:        64px
背景:        --color-bg (和页面同色)
顶部:        1px solid --color-border-light
布局:        4 项(时间轴 / 相册 / 日历 / 我),justify-content: space-around
安全区:      padding-bottom: env(safe-area-inset-bottom)
```

每个 Tab:

```
图标 dot: 34px 圆,默认透明背景
字色:     默认 --color-fg-soft;激活 --color-primary-active
字号:     --text-xs
字重:     --font-semibold
```

激活态:

```
.tab.active .dot {
  background: var(--color-primary);
  color: white;
  transform: translateY(-6px);
  box-shadow: var(--shadow-press-md);
  transition: transform var(--duration-slow) var(--ease-out-back),
              background var(--duration-base) var(--ease),
              box-shadow var(--duration-slow) var(--ease-out-back),
              color var(--duration-base);
}
```

**唯一允许使用 `--ease-out-back` 的地方**——切换 Tab 时激活胶囊带轻微 overshoot 弹起。

### 4.12 移动壳 · BottomSheet

自下而上拉起,用于**从列表中选择**(切宝宝、选成员、Milestone 多选、媒体来源)。

```
背景:       --color-surface-2 (#fdfdf5)
顶部圆角:   --radius-lg (24px) 仅上面两角(border-radius: 24px 24px 0 0)
阴影:       0 -8px 24px 0 rgba(61,52,40,.14)(向上的软阴影,与 --shadow-soft-lg 镜像)
handle:     顶部居中 36×4px 圆角 2px 浅色横条(--color-border-light)
            margin-bottom: 14px
内边距:     18px 上 / 20px 左右 / 28px 下(底部留出安全区)
            实际再加 env(safe-area-inset-bottom)
标题:       --text-md (14px),--font-bold,--color-fg-strong,margin-bottom: 14px
列表项:     padding 10px 6px;radius 14;
            选中态背景 --color-surface,右侧加 mint-dark ✓ 标记
            点按:背景 rgba(0,0,0,.04)
"添加新…"项: 顶部 1px border-light 分隔线 + 14px 上 padding,
            mint-dark 色,--font-semibold
进场:       translateY(100%) → 0,--duration-slow (300ms) var(--ease)
退场:       反向,--duration-base (250ms)
遮罩:       rgba(61,52,40,.45),fade-in --duration-base
高度:       auto(最高 90vh);超过时内部滚动(内部加 overflow-y: auto)
关闭:       下拉超过 80px + 松手 / 点遮罩 / ESC
```

**禁止 blob clip-path 装饰**(同 Modal,P5 spec 提到但实际太花)。

### 4.13 移动壳 · ActionSheet

iOS 风菜单,自下而上,用于**对当前对象的多个操作**(编辑 / 复制 / 移到回收站等)。

```
位置:        bottom: 12px;left/right: 12px(屏幕底部留 12px 安全边距,与 iOS 一致)
分组容器:    --color-surface-2,圆角 --radius-base (18px,不用 24)
            阴影 --shadow-soft-lg
项 padding:  16px 上下 / 18px 左右
项字号:      --text-md (14.5px) 略偏大,--font-semibold
项字色:      默认: --color-fg
            emphasized(强调操作,通常是"编辑/完成"): --color-primary-active
            destructive(删除/移到回收站): --color-error
项对齐:      text-align: center(iOS 风格)
项分隔:      1px solid --color-border-light(最后一项无)
项点按态:    background: rgba(0,0,0,.05)(瞬时,无 transition)
取消块:      与分组隔 8px,独立的圆角 18px 浮起块,同样 --color-surface-2 + --shadow-soft-lg
            字重 --font-bold(比项稍重,语义"独立动作")
项数限制:    建议 ≤ 5(含 destructive);超过用 BottomSheet 替代
进场:        translateY(120%) → 0,--duration-slow (300ms) var(--ease)
退场:        反向,--duration-base (250ms)
遮罩:        rgba(61,52,40,.45),fade-in --duration-base
关闭:        点取消 / 点项 / 点遮罩 / ESC
```

### 4.14 移动壳 · AppShell

三段式布局:

```
┌───────────────────────────┐ 
│ Header (sticky, 顶部 18px) │ 包含标题 / 副标 / 右侧通常为空
├───────────────────────────┤
│ Body (flex: 1, scrollable) │ 内容区,左右 padding 16
├───────────────────────────┤
│ Tabbar (sticky bottom)     │
└───────────────────────────┘
```

- Header **不带阴影**,纯背景色 + 内容
- Body 顶部直接接 Header 内容(无强分割线)
- Body 滚动到底部时 Tabbar 顶部的 1px 分隔线**不强化**(`--color-border-light` 即可)
- 标题:`--text-2xl` 字重 `--font-bold`,副标 `--text-xs` `--font-semibold` 色 `--color-fg-soft`

### 4.15 DatePicker(复合组件)

替代原生 `<input type="date">`。由两部分组成:**触发器(DateRow)** + **滚轮 BottomSheet**。

#### 4.15.1 DateRow(触发器)

视觉与 Input 相同,但语义是按钮:

```
元素:        <button type="button">
背景:        --color-surface-2 (#fdfdf5)
高度:        44px(与 Input 高一致)
内边距:      0 16px
边框:        2px solid --color-border-light
圆角:        --radius-sm (16px)
阴影:        --shadow-soft-sm
左侧文字:    已选日期 "2024 年 8 月 1 日"(--color-fg);
            未选时 "选择生日"(--color-fg-disabled)
右侧:        chevron `›`(--color-fg-soft, --text-sm)
:focus:      border-color: var(--color-focus);
             box-shadow: 0 0 0 3px rgba(245,195,28,.25), var(--shadow-soft-sm)
:active:     无 transform(它是触发器,不是按压物件);仅触发 Sheet 弹起
:disabled:   opacity 0.5; cursor: not-allowed
a11y:        aria-haspopup="dialog";打开 Sheet 后 aria-expanded="true"
```

#### 4.15.2 滚轮 BottomSheet

iOS 风三列滚轮,装在 BottomSheet 容器里(继承 §4.12 全部样式)。

```
Sheet header(替代标题位):
  ┌─ 取消(左,--color-fg-soft,--font-semibold,--text-md)
  ├─ 选择生日(中,--font-bold,--color-fg-strong,--text-md)
  └─ 确定(右,--color-primary-active,--font-bold,--text-md)
  padding: 0 20px 14px

Wheels 区域:
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr  ← 年列略宽(4 位 vs 2 位)
  height: 200px
  padding: 0 16px
  position: relative

中心高亮带:
  ::before 伪元素;left/right 16,top 50% translateY(-50%)
  height: 40px(= 单项高度)
  background: --color-surface
  border-radius: --radius-sm
  pointer-events: none; z-index: 0

每列 wheel:
  position: relative; height: 100%; overflow: hidden; z-index: 1
  mask: linear-gradient(180deg, transparent, #000 35%, #000 65%, transparent)
  内部 .wheel-track 通过 transform: translateY(-N * 40px) 移动定位

每个 .wheel-item:
  height: 40px(必须 = 高亮带高度)
  display: flex; align-items: center; justify-content: center
  font-variant-numeric: tabular-nums  ← 等宽数字,避免抖动
  默认: --color-fg-soft, --font-semibold, --text-base
  .near(中心 ±1): --color-fg, --font-semibold
  .selected(中心): --color-fg-strong, --font-bold, --text-lg(16px)
  transition: color .2s, font-weight .2s
```

#### 4.15.3 数据规则

| 列 | 范围 | 备注 |
|---|---|---|
| 年 | `今年 - 10` ~ `今年` | 宝宝最大 10 岁;若需扩展放配置项,**不要无限滚动** |
| 月 | 1 ~ 12 | |
| 日 | 1 ~ `daysInMonth(年,月)` | 切换年/月后自动夹紧(若日>当月最大,落到最大日) |

未来日期(今年今月今日之后)在年/月/日列里**显示但不可选**(灰色 + `pointer-events: none`),或者在确定时校验报错。MVP 选简单的"显示+确认时校验"。

#### 4.15.4 交互

```
打开:        点 DateRow → Sheet 进场(§4.12 标准 translateY 100→0 300ms)
                      → 初始位置滚到当前选中值(若 DateRow 无值,默认今天 - 365 天)
滚动:        touch:swipe 上下;鼠标:滚轮也行
惯性:        松手后惯性滑动 + 吸附到最近的 40px 网格(snap-to-grid)
振动反馈:   每滚过一个 item 触发 navigator.vibrate(8)(若可用);桌面无效果
取消:        关闭 Sheet,不修改 DateRow
确定:        关闭 Sheet,把三列选中值写回 DateRow 文字 + 触发 onChange
关闭手势:   下拉 handle 超过 80px 松手 → 视作取消;点遮罩 → 视作取消;ESC → 视作取消
```

#### 4.15.5 a11y / reduced-motion

- Sheet 打开时焦点落到"确定"按钮
- 滚轮列加 `role="listbox"`,每项 `role="option" aria-selected`
- 键盘:↑/↓ 切换聚焦列的值;Tab 切换到下一列
- 屏幕阅读器:朗读"2024 年 8 月 1 日,已选中,共 11 项,当前第 5 项"
- reduced-motion:Sheet 进场 300ms → 1ms;滚轮 snap 跳跃式不平滑;无振动

---

## 5. 动效规范

### 5.1 进场动画

**规则**(由 FAB bug 总结):

1. **基础规则保持静态终态**(可见、无 transform、opacity 1),不要写"隐藏起点"
2. **起点写在 `@keyframes from` 里**
3. **`animation-fill-mode` 用 `backwards` 不用 `forwards`** —— `forwards` 会把终态 transform 永久锁住,把 `:active` / `:hover` 的 transform 全部覆盖,导致按压无效
4. 进场结束后元素自动回归基础规则,不需要 JS 清理

**模板**:

```css
.card { background: var(--color-surface); border-radius: 20px; /* 静态终态 */ }

.card.entering {
  animation: rise var(--duration-entry) var(--ease) backwards;
}

@keyframes rise {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

**位移幅度**:Card 12px / Hero 16px / FAB 16px。
**错峰**:列表卡片 `animation-delay: calc(60ms * var(--i))`,首项 100ms。
**触发**:页面 mount 时统一加 `.entering`;**单次性,不监听滚动加载**。无限滚动加载的新项目**不做进场动画**(避免滚动时眼花)。

### 5.2 按压反馈

**规则**:

```css
.btn-primary {
  box-shadow: var(--shadow-press-lg);  /* 0 5px 0 0 ... */
  transition: transform var(--duration-press)    var(--ease),
              box-shadow var(--duration-press)   var(--ease);
}
.btn-primary:active {
  transform: translateY(4px);   /* = 5 - 1 */
  box-shadow: var(--shadow-press-lg-active);  /* 0 1px 0 0 ... */
  transition-duration: var(--duration-press);  /* 按下 80ms */
}
/* 松开靠 transition 默认延续,无需额外规则 */
```

**translateY 数值必须 = 阴影减量**(见 §2.5.1)。**禁止半补偿**。

### 5.3 Tabbar 激活胶囊

**唯一**允许 overshoot 的动效:

```css
.tab .dot {
  transition: transform   var(--duration-slow) var(--ease-out-back),
              box-shadow  var(--duration-slow) var(--ease-out-back),
              background  var(--duration-base) var(--ease),
              color       var(--duration-base);
}
.tab.active .dot {
  transform: translateY(-6px);
  background: var(--color-primary);
  color: white;
  box-shadow: var(--shadow-press-md);
}
```

### 5.4 Toast 弹出

```css
.toast { transform: translateY(20px); opacity: 0; }
.toast.show {
  transform: translateY(0);
  opacity: 1;
  transition: transform  var(--duration-slow) var(--ease-out-back),
              opacity    var(--duration-base) var(--ease);
}
```

注:Toast 用 `--ease-out-back` 是**例外允许**(信息显现需要一点存在感),但 overshoot 幅度比 Tabbar 小(由位移量 20px 自然限制)。

### 5.5 Hero ken-burns(可选氛围)

```css
.hero .bg {
  position: absolute; inset: -6%;
  background-size: cover;
  animation: drift var(--duration-ambient) ease-in-out infinite alternate;
}
@keyframes drift {
  0%   { transform: scale(1)    translate(0, 0); }
  100% { transform: scale(1.05) translate(-2%, -1%); }
}
@media (prefers-reduced-motion: reduce) {
  .hero .bg { animation: none; transform: none; }
}
```

**仅 Timeline Hero 一处使用**。Gallery 大图、Profile 头像等其他大图**不要**加 ken-burns,避免页面"到处在飘"。

### 5.6 reduced-motion 行为

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

但**按压反馈应保留**(0.001ms 的 transition 等于瞬切,按压视觉差异仍在,只是不"动"了)。
ken-burns、loading 斜纹、stripe 动画必须**完全停止**。

---

## 6. 页面级布局规范

### 6.1 Timeline 页(标准实例)

**Header**

- 左:`小乐的成长` (`--text-2xl --font-bold`) + 副标 `1岁3月 · 第 456 天` (`--text-xs --font-semibold --color-fg-soft`)
- 右:**空**(不放任何按钮)

**不要的元素**(已讨论决定移除):

- ❌ 全部/今天/本周/里程碑 筛选 chips —— 增加视觉噪音,实际使用率低
- ❌ 搜索图标 —— 不是高频操作,放到 Profile/Me 子路由更合适
- ❌ Hero 上的"月龄"黄色角标 —— 与 Header 副标重复
- ❌ **切换宝宝 Pill** —— 切换宝宝是低频操作(多数家庭只有 1 个宝宝;有 2+ 时切换也不频繁);从所有页面 header 移除,**统一收到 Profile/Me 子页**

**Hero**(`/timeline` 顶部固定一块,跟随 entry 数据):

| 状态 | 视觉 | 数据来源 |
|---|---|---|
| 带图 | 大图 200px + 底部渐变遮罩 + 标题/作者时间 + 右上 `📷 N`(N>1 时) | 今天最新一条带媒体的 entry;有里程碑则优先里程碑 |
| 文字 | 奶油底,标题加大 `--text-md --font-bold` + 副标作者时间 | 今天最新一条 entry(无媒体) |
| 空态 | dashed Card,emoji + 标题 + 副标 + mint 主按钮 "＋ 现在写" | 今天没有 entry 时 |

**交互**:

- 带图 / 文字态:整块跳 `/entry/[id]`,详情页内部可翻图
- 空态:CTA 按钮跳 `/entry/new`
- 切宝宝时 Hero 跟随切换的宝宝
- Hero 那条 entry **不在下方列表里重复出现**(去重)

**列表**

- 卡片(Card 默认),`gap: 12px`
- 每张卡:作者头像 32 + 作者名 + 相对时间 / 内容 / 缩略图条
- 不按日期分组(简化;按时间倒序即可)
- 长内容截断到 3 行 + 渐隐(`-webkit-line-clamp: 3`),整卡可点进详情
- 滚动到底部:show `--color-fg-soft` 文字 "到这里啦 🌱",不做分页

**FAB**

- 右下,`bottom: 80px`(避开 Tabbar)`right: 18px`
- 跳 `/entry/new`,**当前选中的宝宝作为默认 babyId** 传入

### 6.2 其他页面参照

- **Gallery**:AppShell + 双列瀑布流 + Tabbar。每个图块用 Card 视觉(无边框无投影),`gap: 8px`
- **Calendar**:AppShell + 月历组件 + 当天 entry 列表。月历 cell 沿用 Card 语言(平面、奶油底、有 entry 的日子用 mint 圆点标注)
- **Profile/Me**:AppShell + 用户卡 + 设置项列表。每个设置项是一行(`Card` 内含 `<li>`,无边框无投影,点击进二级页)
- **Entry 详情**:无 Tabbar 的全屏页,顶部返回按钮 + 媒体轮播 + 内容卡 + 评论区(若有)
- **Login / Onboarding**:大字号标题(`--text-hero`)+ Form + 主按钮。背景同 `--color-bg`,无其他装饰

---

## 7. a11y 基线

### 7.1 对比度

- 正文 `#794f27` on `#f8f8f0` ≈ 7.4:1(AAA ✅)
- 次级 `#9f927d` on `#f8f8f0` ≈ 3.8:1(AA Large ✅,正文不可用)
- 白字 on `#19c8b9` ≈ 2.5:1(❌ 不达 AA)——**所以薄荷绿按钮上不允许放小字,只放 14px+ 加粗文字 / 图标**
- 黑色 on `#f5c31c` ≈ 11.6:1(AAA ✅)——黄色头像底用暖棕 `#724a00` 文字

### 7.2 键盘可达

- 所有可点击元素 `tabindex="0"`(或天然可聚焦如 `<button>` `<a>`)
- 焦点环:`outline: 3px solid var(--color-focus); outline-offset: 2px`,**绝不用 `outline: none` 移除**
- Tab 顺序遵循视觉顺序;Modal 内 focus trap
- ESC 关闭:Modal / BottomSheet / ActionSheet / Toast(with action)

### 7.3 ARIA

| 组件 | ARIA |
|---|---|
| Button (loading) | `aria-busy="true"` |
| Switch | `role="switch" aria-checked` |
| Tab | `role="tab" aria-selected` |
| Modal | `role="dialog" aria-modal="true" aria-labelledby` |
| Toast (info/success) | `role="status"` `aria-live="polite"` |
| Toast (error) | `role="alert"` `aria-live="assertive"` |
| Card.interactive | 用 `<a>` 或 `<button>`,不要给 `<div>` 加 `role="button"` |

---

## 8. 反模式清单(Don'ts)

本节是本次纠偏过程中**实际踩过的坑**的快速速查表。

### 8.1 视觉

- ❌ 给 Card / Hero / Section 加 2px 边框或实色按压阴影 → 容器应平
- ❌ 用近黑 `#000` / `#333` 做正文色 → 用 `--color-fg` 暖棕
- ❌ 把 animal-island-ui 的"按压阴影"当装饰用在所有容器上 → 仅限可按物件
- ❌ Modal / BottomSheet 顶部加 blob clip-path → 太花,破坏温和感
- ❌ Hero 上同时有"月龄角标"和 Header 副标月龄 → 信息重复,选一处
- ❌ 在主功能区放未经验证的 filter chips → 增加噪音,先不放

### 8.2 交互

- ❌ Mobile-first 产品里裸写 `:hover` → 必须 `@media (hover: hover)` 或不写
- ❌ 给可点击 Card 加 hover lift / hover shadow → 不需要;路由切换本身就是反馈
- ❌ FAB 点击只有阴影变化、按钮没动 → translateY 必须 = 阴影减量

### 8.3 动效

- ❌ `animation-fill-mode: forwards` 用在交互元素上 → 锁住 transform 通道,按压失效
- ❌ 进场起点写在基础规则(`base { opacity: 0; transform: ... }`)→ 应写在 `@keyframes from`
- ❌ FAB 进场用 `scale + ease-out-back` 弹簧 → 与整体节奏不匹配,显塑料
- ❌ 多处使用 `ease-out-back` overshoot → 仅 Tabbar(+ Toast 例外)
- ❌ Hover 装饰动效、纯审美微动效 → 砍
- ❌ 无限滚动加载的新项目也做进场动画 → 滚动眼花,只做首屏
- ❌ ken-burns 用在 Hero 之外的大图(Gallery / Avatar 等)→ 全页"飘"

### 8.4 工程

- ❌ 组件里写魔法颜色 / 字号 / 间距 → 必须从 token 取
- ❌ 用 `outline: none` 移除焦点环 → 重新设计焦点环,不要移除
- ❌ 用 `<div role="button">` → 用真正的 `<button>`,获得 a11y / 键盘默认行为
- ❌ Loading 按钮还允许点击 → 必须 `pointer-events: none` + `aria-busy`
- ❌ 用 `<input type="date">` / `<select>` 等原生 form control → 桌面/iOS/Android 渲染各异,与 AC 风脱节。日期用 §4.15 DatePicker,枚举用 segmented control 或 BottomSheet

---

## 9. 非目标(与 P5 spec 一致,重申)

- ❌ 深色模式
- ❌ 国际化(只做中文)
- ❌ 字号开关 / 老人模式
- ❌ 第三方组件库(headless-ui / radix / shadcn 一律不引)
- ❌ 设计 Figma 文件(本文档 + animal-island-ui demo + Timeline mockup 即视觉真值)

---

## 10. 与 P5 spec 的显式差异

| # | 项 | P5 spec | 本规范 |
|---|---|---|---|
| 1 | 聚焦黄 | `#ffcc00` | `#f5c31c`(animal-island 源码对齐) |
| 2 | Modal / Sheet 顶部装饰 | "blob clip-path 顶部装饰" | **取消**,平整顶部 |
| 3 | Card 视觉 | 隐含"按压阴影 + 边框" | **平面、无边框、无投影** |
| 4 | 按压 translateY | 沿用 animal-island `2px` 半补偿 | **全补偿:translateY = Δ阴影厚度** |
| 5 | hover lift | 默认有 | **mobile-first,默认无;桌面用 `@media (hover: hover)` 圈起** |
| 6 | Tabbar 容器 | 奶油底 + 顶部 2px 描边 | **与页面同色 + 1px 极淡分隔线** |
| 7 | Filter chips on Timeline | 未明确 | **不放**(等真有需要再加) |
| 8 | Timeline Hero | 未规划 | 新增 `/timeline` 顶部 Hero 区,三态规范 |

P5 实施计划如果已经按旧 spec 落了部分代码,这次纠偏会涉及:`styles/tokens.css`(聚焦黄、`--shadow-press-*` 系列重命名)、`components/ui/Card.tsx`(去边框去阴影)、`components/ui/Modal.tsx` 和 `BottomSheet.tsx`(去 blob)、`components/ui/Button.tsx`(translateY 调整)、`components/mobile/Tabbar.tsx`(背景与分隔线)、`app/timeline/page.tsx`(新增 Hero 区,移除筛选 chips 占位)。

具体改动清单留给后续实施 plan,**本文档不绑实施任务,只定视觉真值**。

---

## 11. 视觉真值参照

本规范由文字规则 + 三份可在浏览器中打开的 HTML 参照组成。**实施时优先以参照页的视觉数值为准**(文字规则有歧义时);参照页与本文不一致的,以本文为准。

| 参照 | 文件 | 覆盖 |
|---|---|---|
| **组件状态参考** | [`assets/2026-05-18-components-reference.html`](./assets/2026-05-18-components-reference.html) | 全部 14 类基础组件 × 全部状态(default / focus / active / disabled / loading / error / empty),Tokens 快查 |
| **弹窗交互预览** | [`assets/2026-05-18-popups-reference.html`](./assets/2026-05-18-popups-reference.html) | Modal / BottomSheet / ActionSheet 三种弹窗的实际渲染与进退场动画 |
| **Timeline 页 + 动效** | [`assets/2026-05-18-timeline-motion-reference.html`](./assets/2026-05-18-timeline-motion-reference.html) | Timeline 完整页 + 进场 / 按压 / Tabbar 切换 / Hero ken-burns / reduced-motion 模拟 |
| **Login + Onboarding** | [`assets/2026-05-19-login-onboarding-reference.html`](./assets/2026-05-19-login-onboarding-reference.html) | Pre-auth 沉浸态 / 错误展示 / 性别 segmented / DatePicker 滚轮 BottomSheet |
| **EntryComposer 新记录** | [`assets/2026-05-19-entry-composer-reference.html`](./assets/2026-05-19-entry-composer-reference.html) | 空态 / 填写中 / 时间胶囊 DateTimePicker / 里程碑全集 BottomSheet |
| **Entry 详情** | [`assets/2026-05-19-entry-detail-reference.html`](./assets/2026-05-19-entry-detail-reference.html) | 带媒体 carousel / 纯文字 / ⋯ ActionSheet(编辑 + 移到回收站) |
| **Gallery 画廊 + 全屏 viewer** | [`assets/2026-05-19-gallery-reference.html`](./assets/2026-05-19-gallery-reference.html) | 3 列正方网格 / 月分组 sticky / 视频角标 / 空态 / 全屏 viewer |
| **Calendar 日历** | [`assets/2026-05-19-calendar-reference.html`](./assets/2026-05-19-calendar-reference.html) | 月份格子 + 当日 mint 点 + 选中日预览 + 当日年龄块 + 年月 picker |

实施流程:

1. 读本规范 §1–§10 建立规则
2. 在浏览器打开三个参照页对照视觉
3. 实现完成后**用 Playwright 截图与参照页对比**,作为视觉回归基线

---

## 12. 变更记录

| 日期 | 修订人 | 变更 |
|---|---|---|
| 2026-05-18 | brainstorm | 初稿,基于 v1-v5 mockup 迭代纠偏总结 |
