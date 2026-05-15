# BabyLoom V2 — 重做设计文档

**日期**: 2026-05-15
**状态**: 设计确认中
**作者**: cat (与 Claude 协同设计)
**前身**: V1 (NestJS + PG + React×2,未真实部署,整体丢弃)

---

## 1. 背景与目标

### 1.1 产品定位

BabyLoom (小日子) 是**家庭宝宝成长记录**应用,自托管在 QNAP NAS,服务于 1 个家庭、多个成员、多个宝宝的私密场景。强调:温暖、童趣、易用,老人能上手。

### 1.2 V1 的问题

V1 写完但未上线使用。诊断:

- **架构错误**:按企业 SaaS 思路做了独立的 Admin 工程,家庭场景下父母即管理员,Admin 是伪需求
- **重量级技术栈**:NestJS + PostgreSQL 对 NAS 单机过重,备份/迁移复杂,模板代码繁多
- **三端代码重复**:`client/services/api.ts` 与 `admin/services/api.ts` 重复定义、类型各写一份,无共享层
- **前端代码质量差**:页面文件偏大(AddEntry 272 行)、大量内联 `style={{}}`、使用 `any`、已有组件不复用反而手写
- **UI/交互无明确风格定位**:有 framer-motion 和 oklch 色,但缺设计语言,视觉一致性差

### 1.3 V2 目标

- 一个应用、一个仓库、一种心智模型(Next.js 全栈)
- 端到端类型安全,消除前后端类型同步
- 明确的设计语言:Animal Crossing 风格(温暖、童趣、家庭感)
- NAS 自托管友好:单容器、SQLite 单文件、按宝宝维度的文件存储、配置文件管理 owner

---

## 2. 架构

### 2.1 选型总览

| 维度 | 选型 | 备注 |
|---|---|---|
| 框架 | **Next.js 15** (App Router) | RSC + Server Actions |
| 语言 | TypeScript 5.6+ strict | |
| 样式 | Tailwind CSS v4 + `@theme` tokens | AC 风格 token |
| 组件 | 自建 `components/ui/` + Radix primitives(必要时) | 不引 Antd / shadcn 默认皮 |
| ORM | **Drizzle ORM** | 类型推导优秀,跟 SQLite 配合好 |
| 数据库 | **SQLite** + `better-sqlite3` | NAS 单机最佳,备份即 cp 文件 |
| 校验 | **Zod 4.x** | server action + form 共用一份 schema |
| 缓存 | TanStack Query 5 + RSC cache | |
| 认证 | **better-auth** | 自托管账密 + session |
| 动画 | Framer Motion 12 + CSS transitions | |
| 图片 | **Sharp** + `next/image` | AVIF/WebP 缩略图 |
| 视频 | 原文件直存 + ffmpeg 抓首帧 | 不做转码 |
| PWA | **Serwist** | next-pwa 继任者 |
| 时间 | date-fns | |
| 表单 | React Hook Form + `zodResolver` | |
| 日志 | **pino** + `pino-pretty` + `pino-roll` | 结构化 JSON,文件滚动 |
| 测试 | Vitest + RTL + Playwright | |
| Lint | Biome | |
| 包管理 | pnpm | |
| 容器 | 单 Dockerfile multi-stage + docker-compose + nginx 前置 | |

### 2.2 目录结构

```
babyloom/
├── app/                          # Next.js 15 App Router
│   ├── (auth)/
│   │   └── login/
│   ├── (family)/                 # 家长主使用面
│   │   ├── layout.tsx            # 带 Tabbar
│   │   ├── timeline/             # 时光
│   │   ├── gallery/              # 画廊
│   │   ├── calendar/             # 日历
│   │   ├── entry/
│   │   │   ├── new/              # 新建记录
│   │   │   └── [id]/             # 详情/编辑
│   │   └── profile/
│   │       ├── me/
│   │       ├── babies/           # 宝宝管理 (owner)
│   │       ├── family/           # 成员管理 (owner)
│   │       │   └── permissions/  # 宝宝粒度权限
│   │       ├── milestones/       # 自定义里程碑 (owner)
│   │       └── data/             # 备份/导出/日志 (owner)
│   │           └── logs/
│   ├── api/
│   │   ├── media/
│   │   │   ├── upload/route.ts   # multipart 上传
│   │   │   └── [id]/route.ts     # 流式输出(?size=thumb|large|original)
│   │   └── log/client/route.ts   # 前端错误回传
│   └── _actions/                 # Server Actions
│       ├── entry.ts
│       ├── milestone.ts
│       ├── baby.ts
│       ├── member.ts
│       └── auth.ts
├── components/
│   ├── ui/                       # AC 风格组件库
│   └── features/                 # 业务组件
├── lib/
│   ├── db/
│   │   ├── schema.ts             # Drizzle schema
│   │   ├── client.ts             # better-sqlite3 实例
│   │   ├── migrations/
│   │   └── queries/              # 按领域分组的查询函数
│   ├── auth/
│   ├── permissions/              # withPermission 中间件
│   ├── media/                    # Sharp、路径、存储抽象
│   ├── validation/               # Zod schemas
│   ├── logger/                   # pino 配置
│   └── config/                   # 配置文件加载
├── styles/
│   ├── tokens.css                # AC design tokens
│   └── globals.css
├── public/
├── data/                         # 挂载到 NAS volume
│   ├── config.yaml               # owner 凭证 + 家庭配置
│   ├── babyloom.db               # SQLite
│   ├── media/                    # 按 babyId 组织
│   │   └── <babyId>/<year>/<month>/{original,large,thumb,poster}/
│   └── logs/                     # pino-roll 输出
│       └── app-YYYY-MM-DD.log
├── config.example.yaml           # 仓库内示例
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

### 2.3 数据流

**默认路径(RSC + Server Actions)**:
1. 用户访问 `/timeline` → RSC 直接查 DB → 返回 HTML
2. 用户提交表单 → Server Action 校验(Zod) → 权限检查(`withPermission`) → DB 写入 → `revalidatePath` 触发 RSC 重新渲染

**例外(走 API Route)**:
- 媒体上传:multipart → `/api/media/upload`(server actions 不擅长大文件流)
- 媒体输出:`/api/media/[id]?size=thumb`(支持 Range、缓存头)
- 前端错误回传:`/api/log/client`

**客户端缓存(TanStack Query)**:
- 仅用于交互态(如里程碑选择器列表),大部分查询走 RSC

---

## 3. 数据模型 (Drizzle + SQLite)

```ts
// 家庭(顶层数据空间,单部署 = 单家庭)
families {
  id: text PK,               // uuid
  name: text NOT NULL,
  ownerUserId: text NOT NULL,
  createdAt: integer NOT NULL,
  updatedAt: integer NOT NULL,
}

// 用户(账号)
users {
  id: text PK,               // uuid
  username: text UNIQUE NOT NULL,
  nickname: text NOT NULL,
  passwordHash: text NOT NULL,
  avatarUrl: text,
  createdAt: integer NOT NULL,
  updatedAt: integer NOT NULL,
}

// 用户 ↔ 家庭(成员关系)
family_members {
  id: text PK,
  familyId: text NOT NULL FK,
  userId: text NOT NULL FK,
  role: text NOT NULL,       // 'owner' | 'editor' | 'viewer'
  joinedAt: integer NOT NULL,
  // UNIQUE(familyId, userId)
}

// 宝宝
babies {
  id: text PK,               // uuid
  familyId: text NOT NULL FK,
  name: text NOT NULL,
  birthday: text NOT NULL,   // ISO date
  gender: text NOT NULL,     // 'boy' | 'girl' | 'other'
  avatarUrl: text,
  createdAt: integer NOT NULL,
  updatedAt: integer NOT NULL,
  deletedAt: integer,        // soft delete
}

// 宝宝-成员细粒度权限(可选覆盖,默认按 family role)
baby_member_permissions {
  id: text PK,
  babyId: text NOT NULL FK,
  familyMemberId: text NOT NULL FK,
  canRead: integer NOT NULL DEFAULT 1,
  canWrite: integer NOT NULL DEFAULT 0,
  canDelete: integer NOT NULL DEFAULT 0,
  // UNIQUE(babyId, familyMemberId)
}

// 记录条目
entries {
  id: text PK,
  babyId: text NOT NULL FK,
  authorId: text NOT NULL FK,
  content: text NOT NULL,
  occurredAt: integer NOT NULL,   // 默认 createdAt,允许用户调整
  createdAt: integer NOT NULL,
  updatedAt: integer NOT NULL,
  deletedAt: integer,
}

// 里程碑(系统预设 + 家庭自定义)
milestones {
  id: text PK,
  familyId: text FK,         // NULL = 系统预设,所有家庭可见
  name: text NOT NULL,
  icon: text NOT NULL,       // emoji
  order: integer NOT NULL DEFAULT 0,
  createdAt: integer NOT NULL,
}

// 条目 ↔ 里程碑(多对多)
entry_milestones {
  entryId: text NOT NULL FK,
  milestoneId: text NOT NULL FK,
  // PRIMARY KEY (entryId, milestoneId)
}

// 媒体文件
media {
  id: text PK,               // uuid,同时作为文件名
  entryId: text FK,          // NULLABLE,允许裸照片(暂未关联)
  babyId: text NOT NULL FK,
  type: text NOT NULL,       // 'photo' | 'video'
  filename: text NOT NULL,   // 用户原始文件名(展示用)
  mimeType: text NOT NULL,
  sizeBytes: integer NOT NULL,
  width: integer,
  height: integer,
  durationSec: integer,      // 仅视频
  relativePath: text NOT NULL, // '<babyId>/<year>/<month>'
  takenAt: integer,          // 从 EXIF,fallback createdAt
  createdAt: integer NOT NULL,
}

// 会话(better-auth 自动管理)
sessions { id, userId, expiresAt, ipAddress, userAgent, ... }
```

**索引**:
- `entries`: `(babyId, occurredAt DESC)` 用于时间线
- `media`: `(babyId, takenAt DESC)` 用于画廊
- `family_members`: `(userId)` 用于权限查询
- `baby_member_permissions`: `(familyMemberId)` 用于权限查询

---

## 4. 配置文件 (`data/config.yaml`)

### 4.1 文件位置

挂载在 NAS volume 内,`data/config.yaml`。仓库内提供 `config.example.yaml`。

### 4.2 schema

```yaml
# BabyLoom 配置文件
# 此文件控制 owner 账号和家庭基础信息。
# 重置 owner 密码 = 修改此文件并重启容器。
# 其他成员的密码重置由 owner 在 App 内操作。

owner:
  username: papa                  # 登录用户名(改这个 = 改 owner 的用户名)
  password: "your-password-here"  # 明文密码,启动时 bcrypt 哈希进 DB
  nickname: "爸爸"                # 显示名

family:
  name: "我们家"                  # 家庭显示名(可在 App 内改)

app:
  baseUrl: "http://nas.local"     # 用于生成绝对 URL(可选)
  timezone: "Asia/Shanghai"       # 默认 Asia/Shanghai
```

### 4.3 启动行为

应用启动时(`lib/config/bootstrap.ts`):

1. **读取 `data/config.yaml`**
   - 文件不存在 → 写 `config.example.yaml` 到 data 目录 → 打印错误并退出
   - YAML 解析失败 → 打印错误并退出(`level: fatal`)
2. **Zod 校验**(`username` 非空、密码长度 ≥ 6 等)
3. **与 DB 对账**:
   - DB 无 owner → 创建 owner user + family
   - DB 已有 owner 且 username 相同 → 更新 `passwordHash` 和 `nickname`(实现"改文件重置密码")
   - DB 已有 owner 但 username 不同 → 更新现有 owner 的 username(保持身份连续)
4. **启动完成**,记录 `info` 日志

### 4.4 配置文件改动不热加载

仅启动时生效。改完需 `docker compose restart`。**不监听 fs 变化(YAGNI)**。

### 4.5 安全

- 文件应 `chmod 600`(部署文档说明)
- 启动后立即 bcrypt 哈希进 DB,DB 中只有 hash
- 明文存在文件中是 owner 与 NAS 物理拥有者等价的前提下的合理取舍

---

## 5. 权限模型

### 5.1 角色

| 角色 | 数量上限 | 说明 |
|---|---|---|
| `owner` | 1 | 唯一,通过 config.yaml 创建/重置 |
| `editor` | N | 默认家庭成员角色,CRUD 自己的记录 |
| `viewer` | N | 只读,适合给老人 |

### 5.2 角色权限矩阵

| 操作 | owner | editor | viewer |
|---|---|---|---|
| 看所有宝宝/记录/媒体 | ✓ | ✓ | ✓ |
| 创建/编辑/删除**自己的**记录 | ✓ | ✓ | ✗ |
| 编辑/删除**他人**记录 | ✓ | ✗ | ✗ |
| 上传媒体 | ✓ | ✓ | ✗ |
| 删除媒体 | ✓ | 仅自己上传的 | ✗ |
| 管理成员(增删/改角色/重置密码) | ✓ | ✗ | ✗ |
| 管理宝宝(增删/改资料) | ✓ | ✗ | ✗ |
| 管理里程碑预设 | ✓ | ✗ | ✗ |
| 配置 baby_member_permissions | ✓ | ✗ | ✗ |
| 备份/导出 | ✓ | ✗ | ✗ |
| 查看日志 | ✓ | ✗ | ✗ |

### 5.3 细粒度宝宝权限(可选)

`baby_member_permissions` 表覆盖默认 family role。例如:多宝宝时让二宝的奶奶只能看二宝。未配置则走默认 role。

### 5.4 权限校验中间件

`lib/permissions/with-permission.ts`:

```ts
// 伪代码
type Action = 'baby:read' | 'baby:write' | 'baby:delete'
           | 'entry:read' | 'entry:write' | 'entry:delete'
           | 'member:manage' | 'family:manage' | 'system:logs';

async function assertPermission(
  userId: string,
  action: Action,
  resource?: { babyId?: string; entryId?: string; ... }
): Promise<void> {
  // 1. 查 user 在 family 的 role
  // 2. 若 action 涉及 babyId,查 baby_member_permissions 覆盖
  // 3. 不通过 → throw ForbiddenError(自动被 server action wrapper 转 403)
  // 4. 记 warn 日志(permission denied)
}
```

所有 server action 起手调一次。

---

## 6. 媒体存储

### 6.1 目录结构(按宝宝维度)

```
data/media/
└── <babyId>/                       # 宝宝目录(uuid)
    └── <year>/<month>/             # 按拍摄/上传时间分
        ├── original/<mediaId>.<ext>      # 原始文件
        ├── large/<mediaId>.webp          # 1024w 浏览图
        ├── thumb/<mediaId>.webp          # 320w 缩略图
        └── poster/<mediaId>.webp         # 视频首帧(仅视频)
```

- **`mediaId`** = DB 主键(uuid),保证文件名唯一
- **DB 中存** `relativePath: '<babyId>/<year>/<month>'`,文件名用 `mediaId + 推导扩展名`
- **删除宝宝** = soft delete + 后台 job 清理 `data/media/<babyId>/`(避免误删,delay 7 天)

### 6.2 上传流程

1. 客户端 `POST /api/media/upload` multipart:`babyId`、文件列表
2. 服务端权限检查(`media:write` for babyId)
3. 临时落盘到 `data/media/<babyId>/<year>/<month>/original/`
4. Sharp 并行处理:
   - 提取 EXIF DateTimeOriginal → `takenAt`
   - 生成 `large/<id>.webp`(1024w, quality 85)
   - 生成 `thumb/<id>.webp`(320w, quality 75)
   - 视频:用 `ffmpeg-static` 抓首帧 → `poster/<id>.webp`
5. 写 `media` 表
6. 若提供 `entryId`,绑定关系

### 6.3 输出流程

`GET /api/media/[id]?size=thumb|large|original`:

1. 权限检查(`media:read`)
2. 从 DB 读 `relativePath` + `type`,拼接绝对路径
3. 流式输出文件,设置:
   - `Cache-Control: private, max-age=31536000, immutable`(媒体不可变)
   - `Content-Type` 从 mime
   - 支持 `Range` 请求(视频拖动)

### 6.4 视频策略

- **不转码**:直接存原文件(MP4/MOV/HEVC 都直接存)
- 浏览器播不动 HEVC 时,提示用户安装兼容插件(标注已知限制)
- 抓首帧用于画廊封面

---

## 7. UI / 设计系统

### 7.1 设计语言

**Animal Crossing 风格 design token 100% 沿用**,参考 https://github.com/guokaigdg/animal-island-ui 的 `DESIGN_PROMPT.md`。

关键特征:
- 温暖羊皮纸底色 `#f8f8f0`
- 主色薄荷绿 `#19c8b9`
- **任天堂按压阴影**:所有可点击元素 `0 5px 0 0 #bdaea0`,按下 `0 1px 0 0`
- 胶囊形按钮(`border-radius: 50px`)
- 黄色聚焦 `#ffcc00`(不是蓝)
- Nunito + Noto Sans SC + Zen Maru Gothic 字体
- 卡片浮起 `translateY(-4px)` hover

### 7.2 Tailwind v4 落地

`styles/tokens.css`(全部 token 在此):

```css
@theme {
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

  --font-display: 'Nunito', 'Noto Sans SC', 'Zen Maru Gothic', system-ui, sans-serif;

  --shadow-press: 0 5px 0 0 #bdaea0;
  --shadow-press-hover: 0 6px 0 0 #bdaea0;
  --shadow-press-active: 0 1px 0 0 #bdaea0;
  --shadow-card: 0 4px 10px rgba(107, 92, 67, 0.42);

  --radius-pill: 50px;
  --radius-card: 20px;
  --radius-sm: 12px;

  --ease-press: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 7.3 自建组件清单(`components/ui/`)

**直接对应 animal-island-ui 语义**:
- `Button` — 三档尺寸 + 按压阴影 + loading 斜纹动画
- `Input` — 胶囊 + 黄色聚焦
- `Switch` — 浮起手柄
- `Card` — 圆角 + 卡片阴影
- `Modal` — blob clip-path(移动端改为底部 sheet 或全屏)
- `Collapse` — grid-template-rows 动画
- `Tag` — 里程碑、状态标记
- `Avatar` / `AvatarGroup`
- `Spinner` / `Skeleton`
- `Toast` — 操作反馈

**移动端新增**:
- `BottomSheet` — 顶部 blob 装饰 + 拖动 handle + AnimatePresence
- `ActionSheet` — iOS 风但用 AC 配色
- `Tabbar` — 底部导航(替代 sidebar)
- `PullToRefresh`
- `WheelPicker` — 日期/里程碑选择
- `CalendarMonth`
- `MediaGrid`

**业务组件(`components/features/`)**:
- `TimelineCard`
- `EntryComposer`
- `MilestonePicker`
- `MediaUploader`
- `FamilyMemberList`

### 7.4 不做

- ❌ 深色模式(YAGNI,后续可加)
- ❌ 国际化(只做中文)
- ❌ 老人模式专属字号(用 PWA 系统字号即可)

---

## 8. 页面与用户流

### 8.1 未登录

- `/login` — 账号密码登录
- 首次访问且 DB 无任何用户 → 应用启动应已读 config.yaml 创建 owner,直接登录

### 8.2 家长视图(底部 Tabbar)

```
┌─────────────────┐
│  Time / Gallery │
│  Calendar / Me  │
└─────────────────┘
```

| 路径 | 说明 |
|---|---|
| `/timeline` | 时光主页,Pull to refresh,无限滚 |
| `/gallery` | 画廊,按月分组,Tab 切宝宝 |
| `/calendar` | 月日历,有记录日期高亮 |
| `/entry/new` | 全屏新建,BottomSheet 选里程碑、ActionSheet 选媒体 |
| `/entry/[id]` | 详情/编辑(权限内) |
| `/profile/me` | 自己资料(改 nickname/密码/头像) |
| `/profile/babies` | 宝宝管理(owner) |
| `/profile/family` | 成员管理(owner)— 添加/重置密码/改角色/删除 |
| `/profile/family/permissions` | 宝宝粒度权限(owner) |
| `/profile/milestones` | 自定义里程碑(owner) |
| `/profile/data` | 备份导出 + 日志查看(owner) |
| `/profile/data/logs` | 日志查看 |

### 8.3 关键流程

**首次部署**:
1. 用户在 NAS 上 `docker compose up -d`,容器读 `config.yaml`(不存在则报错)
2. 容器启动 → 创建 owner + family(若 DB 空)
3. 用户浏览器访问 → 跳 `/login` → 输入 config 里的 username/password
4. 进入 `/timeline`(无宝宝时引导添加首个宝宝)

**Owner 添加新成员**:
1. `/profile/family` → "添加成员"
2. 填 username / nickname / 初始密码 / 角色
3. 保存 → 口头告知家人
4. 家人首次登录后在 `/profile/me` 改密码

**Owner 重置成员密码**:
1. `/profile/family` → 选某成员 → "重置密码"
2. 填新密码 → 保存

**Owner 重置自己(owner)密码**:
1. SSH/文件管理器编辑 `data/config.yaml`
2. 改 `owner.password`
3. `docker compose restart`
4. 用新密码登录

---

## 9. 日志系统

### 9.1 选型

`pino` + `pino-pretty`(dev)+ `pino-roll`(prod 文件滚动)。

### 9.2 输出策略

| 环境 | 输出 |
|---|---|
| dev | pretty 彩色到 stdout |
| prod | JSON 同时到:① stdout(被 Docker 抓为 `docker logs`)② `data/logs/app-YYYY-MM-DD.log`(滚动,保留 14 天) |

`LOG_LEVEL` env 控制级别,默认 `info`。

### 9.3 结构化字段

```ts
interface LogEntry {
  time: number;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  module: 'auth' | 'media' | 'entry' | 'permission' | 'http' | 'system' | 'client';
  requestId?: string;   // 每个请求/server action 一个 UUID
  userId?: string;
  babyId?: string;
  msg: string;
  // ...业务字段
}
```

### 9.4 必须记录的事件

| 模块 | 事件 | 级别 |
|---|---|---|
| auth | 登录成功 / 失败 | info / warn |
| auth | 会话过期 | debug |
| permission | 拒绝(403) | warn |
| entry | 创建/编辑/删除 | info |
| media | 上传开始/完成/失败 | info / error |
| media | Sharp 处理 > 5s | warn |
| system | 启动/关闭、配置加载 | info |
| system | 配置文件错误 | fatal |
| http | 5xx 响应 | error |
| 任意 | 未捕获异常 | error + stack |
| client | 前端错误回传 | error |

### 9.5 敏感数据保护

pino `redact` 屏蔽:`password`、`passwordHash`、`token`、`cookie`、`authorization` → `[REDACTED]`。

### 9.6 前端错误回传

客户端 `window.onerror` + React Error Boundary 捕获 → POST `/api/log/client` → 后端 logger 记 `module: 'client'`,带 userAgent / URL / stack。

### 9.7 Owner 日志查看页

`/profile/data/logs`:
- 列最近 200 行
- 按 level / module 过滤
- 关键字搜索
- 直接读 `data/logs/app-<today>.log`,tail 实现
- 不做实时流(YAGNI)

---

## 10. 部署

### 10.1 Dockerfile

multi-stage:
1. `deps` — pnpm install
2. `builder` — 构建 Next.js + Drizzle migrations
3. `runner` — 最小镜像,包含 ffmpeg-static、运行 `node server.js`(Next.js standalone 输出)

### 10.2 docker-compose.yml

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    ports:
      - "127.0.0.1:3000:3000"
  nginx:
    image: nginx:alpine
    restart: unless-stopped
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    ports:
      - "80:80"
    depends_on:
      - app
```

### 10.3 nginx 职责

- 反向代理 `app:3000`
- 大文件上传支持(`client_max_body_size 200M`)
- HTTP/2、gzip

### 10.4 备份

- **手动**:Owner 在 `/profile/data` 点"导出全部" → 后端 zip(SQLite + media)→ 下载
- **自动**(后续迭代):cron 定期 dump 到 `data/backups/`

---

## 11. 测试策略

### 11.1 单元 (Vitest)

- `lib/*` 工具函数
- 权限校验逻辑(矩阵全覆盖)
- Zod schemas 正反例
- Drizzle queries(用 in-memory SQLite)

### 11.2 组件 (Vitest + RTL)

- 每个 UI 组件 1-2 个核心用例(渲染 + 主要交互)
- 业务组件覆盖关键状态(loading / empty / error)

### 11.3 E2E (Playwright)

3 个核心流程:
1. **首次部署**:挂载 config.yaml → 启动 → 登录 → 添加宝宝 → 进入时光
2. **创建记录**:登录 → 新建 entry → 上传 1 张照片 → 选 2 个里程碑 → 保存 → 时光线可见
3. **成员协作**:owner 创建 editor 成员 → 切登录 → editor 创建一条记录 → 切回 owner → 看见 editor 的记录

### 11.4 视觉回归

Playwright screenshots,关键页 3 个断点(375 / 768 / 1024):
- `/timeline`
- `/gallery`
- `/entry/new`(BottomSheet 打开态)
- `/profile/family`

### 11.5 覆盖目标

70%(单人项目实际目标)。

---

## 12. 明确不做(YAGNI)

- ❌ V1 数据迁移(V1 未上线)
- ❌ 多家庭(一个部署 = 一个家庭)
- ❌ Setup Wizard(被 config.yaml 取代)
- ❌ 深色模式
- ❌ i18n
- ❌ 推送通知
- ❌ AI 自动标签/回忆生成
- ❌ 视频转码
- ❌ 第三方分享(微信/朋友圈)
- ❌ 实时同步/协作
- ❌ 配置文件热加载
- ❌ 自动备份 cron(首版手动导出)

---

## 13. 风险与已知约束

| 风险 | 缓解 |
|---|---|
| SQLite 在大数据量下的写性能 | 家庭场景数据量极小(每年几千条记录),不构成问题 |
| 单进程容器既 SSR 又服务媒体 | nginx 前置 + standalone 输出,媒体走 `Range` 流式 |
| HEVC 视频浏览器兼容性差 | 标注已知限制,引导用户用支持的格式或安装解码插件 |
| ffmpeg 镜像体积 | 用 `ffmpeg-static`(~70MB),可接受 |
| RSC + Server Actions 心智模型学习曲线 | 单人项目可控,过程中按需查文档 |
| 配置文件明文密码暴露 | 部署文档强调 `chmod 600`,owner 物理拥有 NAS 是前提 |

---

## 14. 下一步

本设计经用户确认后,进入 `writing-plans` 阶段,产出可执行的实施计划(按模块/阶段拆解)。
