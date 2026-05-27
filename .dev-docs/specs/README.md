# Babyloom V2 — 前端设计交付包

**给实施 agent(Codex / Claude / 你自己)的入口文档**。读完这一页 5 分钟,你应该知道:
- 这套交付包里有什么
- 按什么顺序读
- 实施时哪些规则**不可违反**
- 怎么用视觉真值对照验证

---

## 0. TL;DR

| 你要做的事 | 先读这个 |
|---|---|
| 写**任何**前端代码 | [`2026-05-18-UI-design-language.md`](./2026-05-18-UI-design-language.md) §1(6 条铁律)+ §2(token 表) |
| 实现某个**组件** | 上述文档对应 §4.x + [`assets/2026-05-18-components-reference.html`](./assets/2026-05-18-components-reference.html) 对照视觉 |
| 实现某个**页面** | 找到对应的 `*-reference.html`(见下表)+ 浏览器打开对照 |
| 看**Modal / Sheet** 长什么样 | §4.7 / §4.12 / §4.13 + [`assets/2026-05-18-popups-reference.html`](./assets/2026-05-18-popups-reference.html) |
| **新增组件 / 改规范** | 改 §4 → 同步 components reference → 提 PR |

---

## 1. 文件清单

```
docs/superpowers/specs/
├── README.md                                       ← 你正在读
├── 2026-05-18-UI-design-language.md                ← 真值文档
├── 2026-05-17-P5-design-system.md                  ← 上一轮实施规划(已过时,本文档以新设计语言为准)
├── 2026-05-17-P4-trash-bin-design.md               ← 回收站功能 spec
├── 2026-05-15-babyloom-v2-rebuild-design.md        ← 项目总规约
│
└── assets/                                          ← 视觉真值,浏览器打开即可
    ├── 2026-05-18-components-reference.html        ← 14 类基础组件 × 所有状态(组件 lookup)
    ├── 2026-05-18-popups-reference.html            ← Modal / BottomSheet / ActionSheet
    ├── 2026-05-18-timeline-motion-reference.html   ← Timeline 页 + 动效演示
    ├── 2026-05-19-login-onboarding-reference.html  ← Login + Onboarding + DatePicker
    ├── 2026-05-19-entry-composer-reference.html    ← 新建/编辑记录(EntryComposer)
    ├── 2026-05-19-entry-detail-reference.html      ← 单条记录详情 + 媒体 carousel
    ├── 2026-05-19-gallery-reference.html           ← 画廊网格 + 全屏 viewer
    ├── 2026-05-19-calendar-reference.html          ← 月历 + 当日预览 + 年月 picker
    └── 2026-05-19-profile-reference.html           ← Me hub + 宝宝管理 + 回收站(权限分支)
```

---

## 2. 阅读顺序(按优先级)

### 必读(进任何代码之前)

1. **`2026-05-18-UI-design-language.md` §1 设计原则** — 6 条铁律 + 1 条 SVG 图标规则。违反任何一条都属于实施问题。
2. **`§2 Tokens`** — 完整 token 表(颜色 / 字号 / 间距 / 圆角 / 阴影 / 动效)。**禁止在组件里写魔法数字**,一切从 token 取。
3. **`§3 阴影使用矩阵`** — 一张表查"哪些组件该有阴影、哪种"。卡片默认平面,按压阴影只给可按物件。

### 实现某组件时

4. **`§4.x` 对应组件规范** — 视觉规则 + 状态 + a11y
5. **打开 `assets/2026-05-18-components-reference.html`** — 找到该组件章节,核对你的实现像不像

### 实现某页面时

6. **找到对应的页面 mockup**(见上表)— 浏览器打开,对照布局与交互
7. **`§6 页面级布局规范`** — Timeline 作为标准实例,其他页面参照(目前 spec 中详细描述了 Timeline,其他页面以 mockup 为视觉真值)

### 收尾时

8. **`§7 a11y 基线`** — 对比度数值 / 键盘 / ARIA 必须项
9. **`§8 反模式清单(Don'ts)`** — 22 个常见错误用法的速查表
10. **`§10 与 P5 spec 的显式差异`** — 旧 P5 spec 与本文不一致时以本文为准

---

## 3. 实施时不可违反的硬规则

按出现频率从高到低:

1. **Token 优先** — 颜色、字号、间距、圆角、阴影、动效时长必须用 `var(--color-*)` / `var(--text-*)` / `var(--space-*)` / `var(--radius-*)` / `var(--shadow-*)` / `var(--duration-*)`,不写魔法数字
2. **平面优先** — Card / Hero / Section / Modal 内容区 / Tabbar 容器**没有边框、没有阴影、没有 hover 抬升**;按压阴影只给可按物件(§3 矩阵)
3. **按压数学** — `translateY` 必须 = 阴影厚度减量。`5px → 1px` 配 `translateY(4)`;`3px → 1px` 配 `translateY(2)`。半补偿不允许(§2.5.1)
4. **mobile-first 无 hover** — 不在裸 CSS 里写 `:hover`,要写必须用 `@media (hover: hover) and (pointer: fine)` 圈起来
5. **进场动画用 `backwards` 不用 `forwards`** — 用 `forwards` 会锁住 transform,把 `:active` 按压效果搞坏。基础规则保持静态终态,起点写在 `@keyframes from` 里(§5.1)
6. **图标用 inline SVG** — `currentColor`、24x24 viewBox、1.8px stroke、`fill: none`。emoji 仅用作内容(用户输入)或单个大型装饰(空态),不当 UI 图标(§1.7)
7. **禁用原生 form control** — 不用 `<input type="date">`、`<select>`。日期用 §4.15 DatePicker,枚举用 segmented control 或 BottomSheet
8. **正文色用暖棕 `#794f27`,不用近黑** — `#000` / `#222` / `#333` 一律禁止
9. **destructive Modal 不响应点遮罩关闭** — 只能取消或确认(§4.7)
10. **reduced-motion 必须支持** — 进场 / ken-burns / loading stripe 等动画必须停;按压反馈可瞬时切换保留

---

## 4. 视觉验证流程

每个组件 / 页面实现完后:

```
1. 浏览器打开对应的 *-reference.html
2. 本地启动 Next.js 跑到同一个页面/状态
3. 并排截图,逐项对照:
   - 间距(密度感)
   - 圆角(每层是否对)
   - 颜色(尤其按压阴影色)
   - 字号阶梯
   - hover/focus/active 状态完整性
4. 不一致项 → 修代码,不修 mockup(mockup 是真值)
```

如果发现 mockup 与规范有冲突,**规范优先**(§1–§10);如果发现规范与 mockup 都对不上你的实际需求,在 PR 里提议改规范,不要自行偏离。

---

## 5. 权限相关的可见性

某些 UI 元素的可见性由用户角色控制。实施时必须严格判断:

| 元素 | owner | editor | viewer |
|---|:---:|:---:|:---:|
| Profile/Me 的"家庭管理"分组(宝宝/成员/里程碑) | ✅ | ❌ | ❌ |
| Profile/Me 的"回收站"行 | ✅ | ✅ | ❌ |
| 回收站单条"永久删除"按钮 | ✅ | ❌ | — |
| 回收站单条"恢复"按钮 | ✅ | ✅ | — |
| 回收站顶部"选择"批量入口 | ✅ | ❌ | — |
| Entry 详情 ⋯ ActionSheet | ✅ | 仅自创 entry | ❌(不显示 ⋯ 按钮) |
| Entry 编辑 / 移到回收站 | owner / editor + 自创 | — | ❌ |

---

## 6. 与之前 P5 实施的关系

`2026-05-17-P5-design-system.md` 是上一轮"建什么 / 铺什么"的实施规划,部分代码已经落地(`styles/tokens.css`、`components/ui/*`、`components/mobile/*`、`components/features/*` 等)。

**本设计语言规范(2026-05-18)对 P5 是纠偏**,8 处显式差异列在 §10:

1. focus 黄从 `#ffcc00` → `#f5c31c`(animal-island 源码对齐)
2. Modal / Sheet 顶部不加 blob clip-path
3. Card 视觉:无边框、无投影(P5 错把按压阴影滥用到容器)
4. 按压 translateY 全补偿(不沿用 animal-island 半补偿)
5. mobile-first 默认无 `:hover`
6. Tabbar 容器与页面同色,只用 1px 极淡分隔线
7. Timeline 不放 filter chips
8. Timeline 顶部 Hero 是新增设计

实施 agent 在改老代码时,看到与上述 8 条冲突 → 按本规范修。

**header 全局变更**(2026-05-19):切换宝宝从所有页面 header(Timeline / Gallery / Calendar)移除,统一收到 Profile/Me 子页。

---

## 7. 给 AI / agent 的开场白(可复制)

如果你是 Codex / Claude 等 agent 被分配实施工作,可以把以下段落作为你的工作前置:

> 我在实施 babyloom V2 的前端。设计真值在 `docs/superpowers/specs/`。我会:
>
> 1. 先读 `README.md` 和 `2026-05-18-UI-design-language.md` 的 §1 §2 §3
> 2. 实现具体页面 / 组件时,打开对应的 `assets/*-reference.html` 对照视觉
> 3. token 优先;视觉规则不要轻易偏离;有歧义先在 PR 提议改规范
> 4. 完成后用 Playwright 截图对照 reference HTML 作为视觉回归基线
>
> 我不会:
> - 写魔法数字
> - 用 emoji 当系统图标
> - 用原生 `<input type=date>` / `<select>`
> - 给 Card / Hero / Section 加 hover lift / 按压阴影 / 2px 边框
> - 给 mobile-first 元素裸写 `:hover`

---

## 8. 维护本规范的人

修改本规范的流程:

1. **改规则**:编辑 `2026-05-18-UI-design-language.md`(§1–§10)
2. **改视觉**:编辑对应的 `assets/*.html` 视觉真值
3. **两处必须同步**;有冲突时本文档(`.md`)优先,视觉是规则的具象表达
4. **新增组件**:先加规范 §4 → 再加进 components-reference.html → 提 PR
5. **新增页面**:画 mockup 到 `assets/YYYY-MM-DD-{page}-reference.html` → 在 §11 视觉真值表加一行 → 提 PR
