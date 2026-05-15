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
│   ├── media/                    # Sharp、路径、存储抽象、上传状态机
│   ├── reconcile/                # 启动时 + 周期性清理孤儿/卡住状态
│   ├── backup/                   # SQLite online backup + manifest
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
  status: text NOT NULL,     // 'active' | 'trashed' | 'purged'
  createdAt: integer NOT NULL,
  updatedAt: integer NOT NULL,
  deletedAt: integer,        // 进入 trashed 状态的时间
  deletedBy: text FK,
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
  status: text NOT NULL,          // 'active' | 'trashed' | 'purged'
  createdAt: integer NOT NULL,
  updatedAt: integer NOT NULL,
  deletedAt: integer,             // 进入 trashed 状态的时间
  deletedBy: text FK,
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
  id: text PK,                  // uuid,同时作为文件名
  entryId: text FK,             // NULLABLE,允许裸照片(暂未关联)
  babyId: text NOT NULL FK,
  uploadedBy: text NOT NULL FK, // 上传者 userId,用于"editor 仅可删自己上传的"判定
  type: text NOT NULL,          // 'photo' | 'video'
  filename: text NOT NULL,      // 用户原始文件名(展示用)
  mimeType: text NOT NULL,
  sizeBytes: integer NOT NULL,
  width: integer,
  height: integer,
  durationSec: integer,         // 仅视频
  relativePath: text NOT NULL,  // '<babyId>/<year>/<month>'
  contentHash: text NOT NULL,   // sha256(原文件),幂等键
  status: text NOT NULL,        // 完整状态机见 §6.5
                                // 'pending' | 'processing' | 'ready' | 'trashed' | 'purged' | 'failed'
                                // 仅 ready 对外可见;trashed 仅在垃圾桶 UI 可见
  clientUploadId: text,         // 客户端幂等 token(仅 pending/processing 阶段使用)
  takenAt: integer,             // 从 EXIF,fallback createdAt
  createdAt: integer NOT NULL,
  deletedAt: integer,           // 进入 trashed 的时间
  deletedBy: text FK,           // 软删触发者
  purgedAt: integer,            // 进入 purged 的时间
  purgedBy: text FK,            // 硬删触发者(owner 或 system)
  // 见 §3.1 索引:partial UNIQUE 仅对 status='ready' 生效
}

// 会话(better-auth 自动管理)
sessions { id, userId, expiresAt, ipAddress, userAgent, ... }
```

**索引 / 约束**(§3.1):
- `entries`: `(babyId, status, occurredAt DESC)` 用于时间线(status=active 过滤)
- `entries`: `(status, deletedAt)` 用于垃圾桶查询
- `media`: `(babyId, status, takenAt DESC)` 用于画廊
- `media`: `(status, deletedAt)` 用于垃圾桶查询
- `media`: **PARTIAL UNIQUE** `(babyId, contentHash) WHERE status = 'ready'`
  ⚠️ **关键**:partial index 而非全表 UNIQUE,使 pending/processing/failed/trashed/purged row 不占去重坑位。
  实现:`CREATE UNIQUE INDEX media_dedupe ON media(babyId, contentHash) WHERE status = 'ready';`
- `media`: `(status, createdAt)` 用于 reconcile job 扫描卡住的 pending/processing
- `media`: `(clientUploadId)` WHERE clientUploadId IS NOT NULL,用于幂等重试匹配
- `babies`: `(familyId, status)`
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

**注**:所有"删除"指**软删**(进垃圾桶)。**硬删**(从垃圾桶彻底清除)仅 owner 可做,见 §5.6。

| 操作 | owner | editor | viewer |
|---|---|---|---|
| 看所有宝宝/记录/媒体 (`status='active'/'ready'`) | ✓ | ✓ | ✓ |
| 创建/编辑/**软删** 自己的记录 | ✓ | ✓ | ✗ |
| 编辑/软删他人记录 | ✓ | ✗ | ✗ |
| 上传媒体 | ✓ | ✓ | ✗ |
| 软删媒体 | ✓ | 仅自己上传的 | ✗ |
| **看垃圾桶** | 全部 | 仅 `deletedBy === userId` | ✗ |
| **还原**(trashed → active/ready) | ✓(任意) | 仅 `deletedBy === userId` 且自身是 author/uploader | ✗ |
| **硬删**(trashed → purged) | ✓ | ✗ | ✗ |
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
// 完整 Action 集合 —— 任何新增受保护资源必须先加到这里
type Action =
  | 'baby:read'   | 'baby:write'   | 'baby:trash'   | 'baby:purge'   | 'baby:restore'
  | 'entry:read'  | 'entry:write'  | 'entry:trash'  | 'entry:purge'  | 'entry:restore'
  | 'media:read'  | 'media:write'  | 'media:trash'  | 'media:purge'  | 'media:restore'
  | 'trash:view'                                    // 查看垃圾桶页
  | 'member:manage'
  | 'family:manage'
  | 'milestone:manage'
  | 'system:logs'
  | 'system:backup';

// 命名约定:
//   *:trash   软删(active/ready → trashed)
//   *:purge   硬删(trashed → purged) — owner only
//   *:restore 还原(trashed → active/ready)

interface PermissionResource {
  babyId?: string;
  entryId?: string;
  mediaId?: string;
  authorId?: string;      // entry 的作者(从 DB 读出,绝不接受客户端)
  uploadedBy?: string;    // media 的上传者(从 DB 读出)
  targetUserId?: string;  // member:manage 的被操作者
}

async function assertPermission(
  userId: string,
  action: Action,
  resource?: PermissionResource
): Promise<void> {
  // 1. 查 user 在 family 的 role
  // 2. 若 action 涉及 babyId,查 baby_member_permissions 覆盖
  // 3. 所有权规则(见下方矩阵):
  //    - *:trash / *:restore  → 非 owner 时,对应 ownership 字段必须 === userId
  //    - *:purge              → 仅 owner,其他角色一律拒绝
  // 4. 不通过 → throw ForbiddenError(被统一异常处理转 403/404,见 §5.5)
  // 5. 记 warn 日志(action, userId, resource, reason)
}
```

**所有权规则矩阵**(细化原 5.2):

| Action | viewer | editor | owner |
|---|---|---|---|
| `entry:write` / `entry:trash` | ✗ | 仅 `authorId === userId` | 任意 |
| `entry:restore` | ✗ | 仅 `authorId === userId` **AND** `deletedBy === userId` | 任意 |
| `entry:purge` | ✗ | ✗ | ✓ |
| `media:write` | ✗ | 允许(对有 `media:write` 的目标 baby) | 任意 |
| `media:trash` | ✗ | 仅 `uploadedBy === userId` | 任意 |
| `media:restore` | ✗ | 仅 `uploadedBy === userId` **AND** `deletedBy === userId` | 任意 |
| `media:purge` | ✗ | ✗ | ✓ |
| `media:read` | 允许(有 `baby:read` 即可) | 同左 | 任意 |
| `baby:trash` / `baby:restore` / `baby:purge` | ✗ | ✗ | ✓ |
| `trash:view` | ✗ | 允许(列表过滤为 `deletedBy === userId`) | 全部 |

**关键**:`*:restore` 的 `deletedBy === userId` 是必备约束 — 防止 editor 通过直接 API 调用还原 owner 软删的内容(绕过 UI 过滤)。详见 §5.5.2。

### 5.5 调用约定(关键 — 不只 server action)

**所有受保护入口必须显式调用 `assertPermission`**。固化规则:

- **Server Actions**:用高阶函数 `withPermission(action, resolveResource)(handler)` 包裹,handler 内可直接使用受信任的 `userId`
- **API Routes**(`app/api/*/route.ts`):**必须**走规范化路由模板(见 §5.7),起手调 `await assertPermission(userId, action, resource)`,且 lint 规则强制(自定义 ESLint rule `babyloom/api-route-must-assert`)
- **统一异常处理**:在 `app/(family)/layout.tsx` 和每个 `route.ts` 都包一层 `try/catch`,**`ForbiddenError` 和"资源不存在/非 ready/已软删"统一返回 404**(见 §5.6 — 防存在性泄露)
- **测试硬性要求**(见 §11.3):每个受保护 endpoint 必须有跨权限拒绝用例,否则视为该 endpoint 未完成

### 5.5.1 字段分类:Ownership vs Target

实现端最容易混淆的两类客户端字段必须明确区分:

| 类型 | 例子 | 服务端处理 | 解释 |
|---|---|---|---|
| **Ownership 字段** | `authorId` / `uploadedBy` / `familyId` / `status` / `deletedBy` / `purgedBy` / `createdAt` / `updatedAt` | **绝不接受客户端输入**,在请求 body/query 中出现一律忽略,只从 session/DB 推导 | 这些字段是身份/状态,允许客户端写就是允许 spoof |
| **Target 字段** | `babyId`(上传时选择哪个宝宝)、`entryId`(媒体绑定哪个 entry)、URL path 里的 `mediaId` | **必须接受客户端输入**(否则无法表达用户选择),但服务端**必须**用 DB loader 加载该资源,校验存在 + 状态 + 跨权限,然后用 DB 数据继续判断 | 这是用户的资源选择,不是身份属性 |

**关键不变量**:Target 字段进入授权判断前必须经过 DB loader 反向加载,所有后续权限决策基于 DB row 字段而非客户端传入值。例如:`POST /api/media/upload` 接收 `babyId`,但服务端先 `SELECT * FROM babies WHERE id=?`,确认存在 + `status='active'` + 当前 user 在该 baby 的 family + 有 `media:write` 权限,**然后用加载到的 `baby.familyId` 等字段做后续判断**,绝不直接用 multipart 里的字段做权限以外的事。

伪造的 target 字段(指向别人家庭的 baby)**统一走 §5.6 的 404 出口**,不区分"无权"和"不存在"。

#### Target Field 完整枚举(实现端必须逐项覆盖)

> **元教训**:target field 是个**集合**,不能给单个字段加 loader 就以为安全了。Codex 第四轮发现 entryId 漏校验,根因就是没枚举。

下表列出 V2 全部 target field,**任何新增的 target 字段必须先扩充本表并补 loader**,否则视为未实现:

| 字段 | 出现位置 | DB loader 加载字段 | 必校验 |
|---|---|---|---|
| `babyId` | upload multipart / entry create / 任何资源新建 | `id, familyId, status` | 形状 / 存在 / `status='active'` / `family_members(userId, baby.familyId)` 存在 / 有目标 action 权限 |
| `entryId` | upload multipart(可选,挂载到 entry) | `id, babyId, status, authorId` | 形状 / 存在 / `status='active'` / `entry.babyId === loaded baby.id`(跨宝宝拒绝;跨家庭由此隐含) / user 有 `entry:write` 权限(挂载等于编辑该 entry) |
| `mediaId` | URL path `/api/media/[id]/...` | `id, babyId, status, uploadedBy, type, relativePath` | 形状 / 存在 / 该 endpoint 允许的 status 集合 / 父 baby `status='active'` / 对应 `media:*` 权限 |
| `milestoneId` | entry create(关联里程碑) | `id, familyId` | 形状 / 存在 / `familyId IS NULL`(系统预设)OR `familyId === user 所在 family` |
| `memberId` (target) | owner 改/删成员、宝宝粒度权限配置 | `id, familyId, role` | 形状 / 存在 / `familyId === user 所在 family` / 操作矩阵允许(如不能 demote 自己、不能删 owner) |

**通用 loader 模板**(`lib/permissions/target-loaders.ts`):

```ts
async function loadAndAssertTarget<T>(opts: {
  id: string;
  table: 'babies' | 'entries' | 'media' | 'milestones' | 'users';
  allowedStatuses?: string[];     // 如 ['active']
  parentLoaded?: { id: string };  // 如父 baby,确保 child.parentId === parent.id
  requirePermission: { userId: string; action: Action };
}): Promise<T>
```

实现端调用范式(以 entryId 为例):
```ts
const baby = await loadAndAssertTarget({ id: req.babyId, table: 'babies',
                                          allowedStatuses: ['active'],
                                          requirePermission: { userId, action: 'media:write' } });
let entry: Entry | undefined;
if (req.entryId) {
  entry = await loadAndAssertTarget({ id: req.entryId, table: 'entries',
                                       allowedStatuses: ['active'],
                                       parentLoaded: baby,
                                       requirePermission: { userId, action: 'entry:write' } });
}
```

任何 target field 漏走 `loadAndAssertTarget` → ESLint 规则 + 测试缺失视为该 endpoint 未完成。

### 5.5.2 UI 过滤 ≠ API 授权

**原则**:UI 列表的"看不到" **不等于** API 接口的"拒绝"。每条 UI 过滤逻辑必须在 API 层有等价的 `assertPermission` 校验。

反例(Codex 抓到的真实漏洞):垃圾桶 UI 给 editor 过滤为"自己软删的",但 API `*:restore` 仅校验 `authorId/uploadedBy === userId`,没校验 `deletedBy === userId`。editor 知道 ID 就能直接还原 owner 软删的项,绕过 UI 隐藏。

**强制要求**:
- 编写每个 restore/delete/edit endpoint 时,先列出"UI 列表的过滤条件",授权矩阵**必须**包含所有这些条件
- E2E 测试必须有"UI 列表外的资源 → 直接 API 调用 → 拒绝"用例

### 5.6 防存在性泄露:统一 404 响应

**问题**:若"资源不存在 → 404"而"未授权 → 403",攻击者可通过响应码差异枚举出真实存在的 mediaId。

**规则**:对**任何**资源(media / entry / baby),以下情况一律返回**统一 404**(响应体相同 `{ "error": "not_found" }`,不区分原因):
- 资源 ID 不存在
- 资源存在但 `status` 不在允许集(如 ready/active)
- 资源已 `purged`
- 当前用户对该资源**任一字段**无 `*:read` 权限(包括跨家庭、跨宝宝 baby_member_permissions 限制)
- ID 格式非法(非 UUID)

**例外**:已认证用户访问垃圾桶页相关 endpoint 时,可以看到自己有权看到的 `trashed` 资源(此时 200),其他情况仍统一 404。

**`401 vs 404`**:**未认证**(无 session cookie)→ 401(因为登录与否本就不是机密)。**已认证但无权 / 不存在** → 一律 404。

### 5.7 规范化 API Route 模板

所有 `/api/media/*` 和受保护 API Route **必须**套此模板,通过 `withAuthorizedResource(action, loader)` 高阶函数实现:

```ts
// 伪代码 — 实际实现在 lib/permissions/route-template.ts
export function withAuthorizedResource<R>(
  action: Action,
  loader: (id: string) => Promise<R | null>,   // 仅返回最小必要字段
  toResource: (row: R) => PermissionResource,
) {
  return (handler: (req, ctx, row: R) => Promise<Response>) =>
    async (req: Request, ctx: { params: { id: string } }) => {
      // 1. 解析 + 校验 ID 形状(UUID 正则) → 否则统一 404
      const id = ctx.params.id;
      if (!UUID_RE.test(id)) return jsonNotFound();

      // 2. 认证 session → 否则 401(未登录信息可暴露)
      const userId = await getSessionUserId(req);
      if (!userId) return jsonUnauthorized();

      // 3. 服务端唯一来源:从 DB 拿资源最小字段集
      //    media: { id, babyId, status, uploadedBy, type, relativePath }
      const row = await loader(id);
      if (!row) return jsonNotFound();          // 真不存在

      // 4. 状态闸门:非可读状态等同不存在(防存在性泄露)
      //    media 只允许 'ready'(或 trash:view 路径下 'trashed')
      //    详见每个 endpoint 的具体接受 status 集合

      // 5. 授权:基于 DB 字段(永远不读客户端 babyId)
      try {
        await assertPermission(userId, action, toResource(row));
      } catch (e) {
        if (e instanceof ForbiddenError) return jsonNotFound();  // 转 404
        throw e;
      }

      // 6. 通过 → 调业务 handler(handler 收到的 row 已可信任)
      return handler(req, ctx, row);
    };
}
```

**关键不变量**:
- 第 5 步**永远**用 `loader` 拿到的 DB 字段调 `assertPermission`,handler **绝不可**从请求体读取 babyId/authorId/uploadedBy
- 第 4-5 步任何失败都走"统一 404"出口
- 路径(文件系统)构造在第 6 步之后,且 `relativePath` 来自 DB,杜绝路径遍历

`GET /api/media/[id]`、`DELETE /api/media/[id]` 等所有 endpoint 一律包此模板,ESLint rule 禁止裸 export。

---

## 6. 媒体存储

### 6.1 目录结构(按宝宝维度 + staging)

```
data/media/
├── _staging/                       # 上传中转区,与最终区物理隔离
│   └── <uploadId>/                 # 单次上传一个目录,失败时整目录可删
│       ├── original.<ext>
│       ├── large.webp
│       ├── thumb.webp
│       └── poster.webp             # 仅视频
└── <babyId>/                       # 宝宝目录(uuid)
    └── <year>/<month>/             # 按拍摄/上传时间分
        ├── original/<mediaId>.<ext>      # 原始文件
        ├── large/<mediaId>.webp          # 1024w 浏览图
        ├── thumb/<mediaId>.webp          # 320w 缩略图
        └── poster/<mediaId>.webp         # 视频首帧(仅视频)
```

- **`mediaId`** = DB 主键(uuid),保证文件名唯一
- **DB 中存** `relativePath: '<babyId>/<year>/<month>'`,文件名用 `mediaId + 推导扩展名`
- **`_staging/`** 必须与 babyId 目录在同一文件系统挂载点 → 保证 `rename(2)` 原子

### 6.2 上传流程(两阶段、原子、status-aware 幂等)

**设计原则**:
- DB 是真相源,文件系统是衍生品
- 任何步骤失败后,reconcile job 总能根据 `media.status` 清理孤儿
- 幂等是 **status-aware**:仅对 `status='ready'` 的 row 做去重,pending/processing/failed/trashed/purged 不占去重坑位
- 客户端可安全重试,服务端按 `(contentHash, clientUploadId)` 联合识别"是同一次重试"还是"独立的并发"

**前置约束**(回应 Codex 第二轮发现):
- 唯一索引为 **partial unique**:`UNIQUE(babyId, contentHash) WHERE status='ready'`
- pending/processing 的 row 不阻塞新 row 插入,仅通过 `clientUploadId` 匹配判断"同一请求重试"

**流程**:

1. **客户端**:
   - 计算 `contentHash = sha256(file)`
   - 生成 `clientUploadId = uuidv4()`(本次上传任务的稳定 token,**网络层重试必须复用同一个**)
   - `POST /api/media/upload` multipart:
     - **Target 字段**(用户选择,必传):`babyId`(目标宝宝)、可选 `entryId`(若关联记录)
     - **请求字段**:`contentHash`, `clientUploadId`, `filename`, `mimeType`, `sizeBytes`, 文件二进制
     - **绝不接受**:`uploadedBy / authorId / familyId / status` 等 ownership 字段(出现一律忽略,见 §5.5.1)

2. **服务端 — 准入**(任何 IO 前,严格按序):

   **2.1 认证** → 无 session → 401(其余情况一律统一 404)

   **2.2 Target 校验:DB loader 加载 `babyId`**(关键 — Codex 第三轮 finding #3 修法)
   ```sql
   SELECT id, familyId, status FROM babies WHERE id = ?
   ```
   - babyId 格式非 UUID → 404
   - 不存在 → 404
   - `status !== 'active'` → 404(trashed/purged 的宝宝不能再上传)
   - **跨家庭校验**:用 session 的 userId 查 `family_members`,确认 `family_members.familyId === baby.familyId`。不匹配 → 404
   - 至此 `baby` row 是可信数据源,后续判断都基于它

   **2.3 权限校验**:`assertPermission(userId, 'media:write', { babyId: baby.id, familyId: baby.familyId })`
   - 内部检查 `family_members.role` + `baby_member_permissions` 覆盖
   - 失败 → 统一 404

   **2.4 Target 校验:DB loader 加载 `entryId`**(若客户端传了 entryId)
   ```sql
   SELECT id, babyId, status, authorId FROM entries WHERE id = ?
   ```
   仅当 multipart 包含 `entryId` 时执行,**走 §5.5.1 通用 target loader 模板**:
   - 格式非 UUID → 404
   - 不存在 → 404
   - `status !== 'active'` → 404(trashed/purged 的 entry 不能挂新媒体)
   - **跨宝宝校验**:`entry.babyId !== baby.id` → 404(防止挂到别人宝宝下的 entry)
     > 跨家庭由"baby 已通过 step 2.2 校验属于当前 user 的 family"+"entry.babyId === baby.id" 联合隐含,无需额外校验 `entries.familyId`(entries 表不存 familyId,通过 babyId 推导)
   - **权限校验**:`assertPermission(userId, 'entry:write', { entryId, authorId: entry.authorId, babyId: entry.babyId })` — editor 仅能挂到自己作者的 entry 上;owner 任意。失败 → 统一 404
   - 至此 `entry` row 可信,后续用 `entry.id` 写入 `media.entryId`(绝不直接用 multipart 里的 entryId)

   **2.5 Status-aware 去重查询**:`SELECT id, status, clientUploadId, uploadedBy FROM media WHERE babyId=? AND contentHash=? ORDER BY createdAt DESC`
   - 按命中行的状态分支:

   | 命中 row 状态 | 处理 |
   |---|---|
   | `ready` | **真去重**:200 `{ mediaId, deduplicated: true }`,不重新落盘 |
   | `pending` / `processing` 且 `clientUploadId` 相同 | **同请求重试**:202 `{ mediaId, status, pollUrl }`,客户端轮询 |
   | `pending` / `processing` 且 `clientUploadId` 不同 / 缺失 | **并发独立请求**:继续走新 row(partial index 不阻拦) |
   | 仅 `failed` / `trashed` / `purged` | **允许重传**:旧行保留作审计,走新 row |
   | 无命中 | 走新 row |

3. **服务端 — Stage**(对"走新 row"分支):
   - 在事务内 `INSERT INTO media (id=uuid, status='pending', babyId, contentHash, clientUploadId, uploadedBy, filename, mimeType, sizeBytes, createdAt)`
   - 流式写入 `data/media/_staging/<mediaId>/original.<ext>`,边写边算 sha256
   - 写完校验 hash 与客户端声明一致 → 不一致:删 staging、`status='failed'`、422 返回

4. **服务端 — Process**(在 staging 内):
   - `status='processing'`
   - Sharp 并行生成 large/thumb;视频用 `ffmpeg-static` 抓 poster;提取 EXIF → `takenAt`
   - 任一步失败 → 删 `_staging/<mediaId>/` → `status='failed'` → 5xx 抛错

5. **服务端 — Commit(原子)**:
   - 确保目标目录存在
   - 用 `fs.rename` 把 staging 文件移到最终位置(同文件系统原子)
   - 事务内 `status='ready'`、写 `relativePath`、`width/height/durationSec/takenAt`
   - 若提供 `entryId`,同事务 `media.entryId = ?`
   - 此刻 partial unique index 才生效;**若此时检测到约束冲突**(极端并发:两个独立请求同一文件同时 commit),保留一个 `ready`,另一个回滚为 `failed`、删 staging,客户端可重试(它会命中 ready 分支真去重)

6. **进度轮询端点**:`GET /api/media/[id]/status` — 返回 `{ status, progress? }`,供步骤 2 表中 202 场景使用,同样走 §5.7 模板

7. **失败恢复 / Reconcile Job**(应用启动 + 每天一次):
   - `status IN ('pending','processing')` 且 `createdAt < now - 1h` → 删 staging、标 `failed`
   - `_staging/` 内无对应 DB row 的目录 → 删
   - 不处理 `trashed`(用户主导,见 §6.5)

8. **对外可见性**:所有业务查询默认 `WHERE status = 'ready'`;`trashed` 仅在垃圾桶 endpoint 可见;`failed` / `purged` / `pending` / `processing` 对用户完全隐藏

### 6.3 输出流程(走 §5.7 模板)

`GET /api/media/[id]?size=thumb|large|original`:

走 §5.7 `withAuthorizedResource('media:read', loadMediaForRead, ...)`,其中:
- `loadMediaForRead(id)` 仅 `SELECT id, babyId, status, uploadedBy, type, relativePath WHERE id=?`,**绝不读客户端 babyId**
- 状态闸门:`status !== 'ready'` → 走 §5.6 统一 404
- `size` 参数白名单校验(`thumb|large|original`),非法 → 400
- 通过授权后才拼绝对路径(从 DB `relativePath`),流式输出:
  - `Cache-Control: private, max-age=31536000, immutable`
  - `Content-Type` 从 mime
  - 支持 `Range` 请求

### 6.4 软删流程(进垃圾桶)

`POST /api/media/[id]/trash`:

走 §5.7 `withAuthorizedResource('media:trash', loadMediaForTrash, ...)`,授权时把 DB 的 `uploadedBy` 传入 PermissionResource → editor 仅能软删自己上传的。

事务内:
- `status='trashed'`, `deletedAt=now`, `deletedBy=userId`
- **不删文件**(还原时需要)
- 释放 partial unique index 占位(因为 index 仅对 ready),允许同 hash 重传

### 6.5 媒体状态机(完整)

```
                  upload
                    │
                    ▼
                 pending ────(超时/失败)────► failed
                    │                          ▲
            (开始处理)                         │
                    ▼                          │
                processing ──(Sharp/ffmpeg失败)┘
                    │
            (commit 原子 rename)
                    ▼
                  ready ◄──(restore)── trashed
                    │                     │
                (trash)                (owner purge)
                    │                     │
                    ▼                     ▼
                 trashed              purged
                                      (DB 行保留作审计,
                                       媒体文件被删除)
```

**对外可见性**:
- 业务查询(timeline/gallery)→ `status='ready'`
- 垃圾桶页 → `status='trashed'`(按权限过滤为自己软删的或全部)
- 永远不可见:`pending` / `processing` / `failed` / `purged`

### 6.6 视频策略

- **不转码**:直接存原文件(MP4/MOV/HEVC 都直接存)
- 浏览器播不动 HEVC 时,提示用户安装兼容插件(标注已知限制)
- 抓首帧用于画廊封面

---

## 6A. 垃圾桶(Trash Bin)

V1 的核心 UX 不变量保留:**移动端常规删除走软删,真删隔离到特权位置**。V2 没有独立 admin app,把"特权位置"挪到主 app 内的 owner-only UI。

### 6A.1 设计哲学

| 决策 | 选择 | 理由 |
|---|---|---|
| 自动清理(N 天后硬删) | **不做** | NAS 存储成本极低;owner 主动管理,避免误自动清 |
| 资源范围 | entries / media / babies | 这三类是用户数据,删错代价高 |
| 排除资源 | family_members(撤销访问权)、milestones(配置,可重建) | 语义不是"数据软删" |
| 软删后是否仍备份 | 否,仅备份 `status='ready' / 'active'` | 备份 = 干净数据 |
| 撤销窗口(Toast) | 软删时 5 秒"撤销"toast | 应对手滑 |
| 还原行为 | 完全恢复(同 ID、同关系) | 不创建新行 |

### 6A.2 状态机统一

| 资源 | active 状态值 | trashed 状态值 | purged 状态值 |
|---|---|---|---|
| `entries` | `'active'` | `'trashed'` | `'purged'` |
| `babies` | `'active'` | `'trashed'` | `'purged'` |
| `media` | `'ready'` | `'trashed'` | `'purged'` |

> media 用 `'ready'` 而非 `'active'` 是因为它前置还有 pending/processing/failed,语义更准。

### 6A.3 软删 → 还原 → 硬删 流程

**软删 (`*:trash`)**:
- editor 仅能软删自己作者/上传的;owner 任意
- 事务内:`status = 'trashed'`、`deletedAt = now`、`deletedBy = userId`
- 媒体文件**不动**(还原时需要)
- 返回 200 + Toast `"已删除 · 撤销"`(5 秒撤销窗口)

**撤销 Toast (`*:restore` 子路径)**:
- 客户端 5 秒内点撤销 → 立即调还原
- 5 秒后 Toast 消失,数据仍在垃圾桶可还原

**还原 (`*:restore`)**:
- 同软删权限(editor 自己的、owner 任意)
- `status` 回到 `active` / `ready`、清 `deletedAt`/`deletedBy`
- 媒体的 partial unique index 重新生效;若期间已重传过同 hash 文件,**还原失败**(409 Conflict)并提示用户"垃圾桶版本与现有重复,请先处理"

**硬删 (`*:purge`,owner only)**:
- 单项硬删:`status = 'purged'`、`purgedAt = now`、`purgedBy = userId`
- 媒体:**立即**删除对应 `original/large/thumb/poster/` 文件
- 关联清理:
  - 硬删 entry → 关联 `entry_milestones` 删除;关联 media `entryId` 置 NULL(媒体本身保留)
  - 硬删 baby → 该宝宝下所有 `entries` 和 `media` **必须先**全部进 trashed 状态(否则拒绝),硬删 baby 时不级联硬删它们(避免一键销毁)— 由 owner 显式批量硬删
- DB 行保留为 `purged`(审计用),业务查询全不可见

**清空垃圾桶(owner only,批量 `*:purge`)**:
- 在 `/profile/trash` 顶部按钮,弹二次确认("此操作不可撤销")
- 对当前过滤条件下的所有 `trashed` 行执行硬删
- 大批量时分批事务(每批 100 项),避免单事务过大

### 6A.4 跨资源一致性 — 父链可见性不变量

**核心不变量**:**资源在任何对外出口的可见性 = 自身 status 干净 AND 父链所有 status 干净**。
父链定义:
- `media` 的父 = `babies`(via `babyId`)
- `entries` 的父 = `babies`(via `babyId`)
- `babies` 无父

**"对外出口"包括**(实现端逐一对账):
- timeline / gallery / calendar 等业务查询
- `GET /api/media/[id]` 媒体输出
- **备份导出 manifest**(Codex 抓到的实际漏洞 — 之前只看自身 status)
- 任何 entry/media 详情接口
- 搜索(若后续添加)

**实现要点**:每个查询都必须 join 父表过滤,不允许偷懒只看自身 status。SQL 模板:
```sql
SELECT m.* FROM media m
JOIN babies b ON b.id = m.babyId
WHERE m.status = 'ready' AND b.status = 'active';

SELECT e.* FROM entries e
JOIN babies b ON b.id = e.babyId
WHERE e.status = 'active' AND b.status = 'active';
```

**软删 baby 时**:
- baby 本身 `status='trashed'`
- 其下 entries/media **不**级联 trashed(独立生命周期,owner 可单独管理)
- 由"父链可见性不变量"保证用户感知到的"消失"
- 还原 baby → 子资源自然重新可见

**软删 entry 时**:
- entry `status='trashed'`
- 其关联 media `entryId` **不**置 NULL(还原时需要恢复关系)
- 若 entry 还原 → 关联 media 自动重新挂上

**硬删 baby 时**(§6A.3 已说,这里强化):
- 必须先确认该 baby 下所有 entries/media 已全部 trashed,否则拒绝(409)
- 这是为了防止"硬删 baby 间接吞掉 N 张 ready 照片"
- 实际硬删 baby 时,**不**级联硬删子资源(它们留在 trashed,owner 显式批量 purge)

### 6A.5 API 端点

| 端点 | Action | 备注 |
|---|---|---|
| `GET /api/trash` | `trash:view` | 列表,过滤 entries/media/babies,editor 视角仅自己软删的 |
| `POST /api/media/[id]/trash` | `media:trash` | 走 §5.7 模板 |
| `POST /api/media/[id]/restore` | `media:restore` | |
| `DELETE /api/media/[id]` | `media:purge` | **真删**,owner only |
| `POST /api/entries/[id]/trash` | `entry:trash` | |
| `POST /api/entries/[id]/restore` | `entry:restore` | |
| `DELETE /api/entries/[id]` | `entry:purge` | owner only |
| 同理 babies | | |
| `POST /api/trash/empty` | `*:purge` 批量 | owner only,二次确认 |

> 部分操作也可走 server action,但凡是单点 endpoint 一律套 §5.7 模板。

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
| `/profile/trash` | **垃圾桶** — 任何成员可访问,内容按权限过滤 |
| `/profile/data` | 备份导出 + 日志查看(owner) |
| `/profile/data/logs` | 日志查看 |

**`/profile/trash` 页面结构**:
```
┌─ 顶部:Tab [记录] [媒体] [宝宝]
├─ 列表:每项显示 缩略图/标题 + "X 由 Y 删除"
│  └─ 单项操作:[还原] [彻底删除(owner)]
└─ 底部(owner only):[清空当前 Tab] 按钮(二次确认)
```
- editor 看到的列表仅过滤为"自己软删的"
- owner 看到全部
- 硬删按钮在 editor 视角下隐藏(双重保险:UI 不展示 + 后端 §5.7 拒绝)

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

**误删恢复(editor)**:
1. timeline 长按某条记录 → 删除 → Toast `"已删除 · 撤销"` 5 秒
2. 错过 toast → 进 `/profile/trash` → [记录] tab → 找到该条 → 还原
3. 想立即真删 → 找 owner 操作

**owner 清理垃圾桶**:
1. `/profile/trash` → 选 tab → 单项 [彻底删除] 或顶部 [清空]
2. 二次确认弹窗:"此操作不可撤销,确认彻底删除 N 项?"
3. 确认后立即硬删 + 删媒体文件

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

### 10.4 备份(一致性快照)

**关键风险**:
1. 直接 zip 运行中的 `babyloom.db` 会拿到损坏快照(WAL 未合并、读写中)
2. DB 行已写但 media 文件未 commit 时打包会丢文件
3. **备份期间 owner 的 trash/restore/purge 等媒体相关写**会让快照里 manifest 列出的文件在打包前消失(Codex 第三轮 finding #2)
4. **软删 baby 后,该 baby 下 ready 状态的 media 仍会进入 manifest**(Codex 第三轮 finding #1)→ 违反"备份=干净数据"

**SQLite 启停态**:启用 WAL 模式(`PRAGMA journal_mode=WAL`)。WAL 给读者快照隔离,允许在线备份。

**备份流程**(Owner 在 `/profile/data` 点"导出全部"触发):

1. **进入备份模式**:设置全局 `BACKUP_IN_PROGRESS` 标志
   - **所有媒体相关写一律暂停**(返回 503 + Retry-After,5-30 秒):
     - 媒体上传 commit
     - `*:trash` / `*:restore` / `*:purge`(对 entries / media / babies 全部)
     - 清空垃圾桶
     - entry 创建/编辑(可能关联媒体)
   - **进行中的写**等待其完成(最多 30 秒,超时强杀并清 staging)
   - **读流量**(timeline / 媒体输出 / 垃圾桶浏览)不受影响

2. **DB 快照**:调用 `better-sqlite3` 的 `db.backup(targetPath)`(底层 SQLite Online Backup API)

3. **WAL Checkpoint**:`PRAGMA wal_checkpoint(TRUNCATE)` 把 WAL 合并进主库

4. **Sanitize 快照 DB(关键 — Codex 第四轮 finding #2 修法)**

   > **原则**:备份产物 = 干净自包含数据集。文件层面已经只放 ready/active,**DB 层面必须同步清洗**,否则 trashed/purged/failed 行的元数据(filename、EXIF、deletedBy 等)会偷渡进备份。

   在 snapshot DB(**不动生产 DB**)上执行,全部在单一事务内,失败立即中止备份:

   ```sql
   BEGIN;

   -- 4.1 删除非干净状态的资源行
   DELETE FROM media   WHERE status != 'ready';
   DELETE FROM entries WHERE status != 'active';
   DELETE FROM babies  WHERE status != 'active';

   -- 4.2 切断"父链不干净"的孤儿
   --     babyId 父级是必需(media 没有 baby 就没意义)→ 删除
   --     entryId 父级是可选(media 没有 entry 也合法,变成裸照片)→ NULL 化保留媒体
   DELETE FROM media   WHERE babyId NOT IN (SELECT id FROM babies);
   DELETE FROM entries WHERE babyId NOT IN (SELECT id FROM babies);
   DELETE FROM entry_milestones WHERE entryId NOT IN (SELECT id FROM entries);
   UPDATE media SET entryId = NULL
     WHERE entryId IS NOT NULL
       AND entryId NOT IN (SELECT id FROM entries);

   -- 4.3 清理删除/审计字段(保留行不应保留这些痕迹)
   UPDATE media   SET deletedAt=NULL, deletedBy=NULL, purgedAt=NULL, purgedBy=NULL;
   UPDATE entries SET deletedAt=NULL, deletedBy=NULL;
   UPDATE babies  SET deletedAt=NULL, deletedBy=NULL;
   -- clientUploadId 是上传期间幂等 token,ready 之后已无用,清空
   UPDATE media   SET clientUploadId=NULL;

   -- 4.4 不进备份的表(运行时数据,还原后应当重新生成)
   DELETE FROM sessions;
   -- 若有其他临时/缓存表(如 reconcile 标记)同样清空

   -- 4.5 baby_member_permissions 中指向已删 baby/member 的孤儿
   DELETE FROM baby_member_permissions
     WHERE babyId NOT IN (SELECT id FROM babies);
   -- familyMemberId 不切断(family_members 不参与状态清洗)

   COMMIT;

   -- 4.6 物理清除 deleted page(关键!防止 forensic 残留)
   VACUUM;
   ```

   **执行后不变量**(每条都是 E2E 测试断言):
   - `SELECT COUNT(*) FROM media WHERE status != 'ready'` = 0
   - `SELECT COUNT(*) FROM entries WHERE status != 'active'` = 0
   - `SELECT COUNT(*) FROM babies WHERE status != 'active'` = 0
   - `SELECT COUNT(*) FROM media WHERE deletedAt IS NOT NULL OR purgedAt IS NOT NULL` = 0
   - `SELECT COUNT(*) FROM sessions` = 0
   - 每条 media 必有对应 baby:`m.babyId IN babies.id`
   - 每条 entry 必有对应 baby:同上
   - 每个 media.entryId(非 NULL)必有对应 entry

   **失败处理**:任一 SQL 失败 → 立即回滚事务、删 snapshot db、释放写屏障、返回 5xx → 客户端可重试

5. **生成 manifest(父链感知查询)** — 对**清洗后**的 snapshot DB 执行:
   ```sql
   SELECT m.id, m.relativePath, m.contentHash, m.sizeBytes, m.type
   FROM media m
   JOIN babies b ON b.id = m.babyId
   WHERE m.status = 'ready' AND b.status = 'active';
   ```
   **关键**:`JOIN babies` 过滤 — 软删的 baby 下的 media **不进备份**,即使 media 自身 status 是 ready。entries 同理:
   ```sql
   SELECT e.* FROM entries e
   JOIN babies b ON b.id = e.babyId
   WHERE e.status = 'active' AND b.status = 'active';
   ```
   写 `manifest.json`:`version`、`createdAt`、`appVersion`、`dbSha256`(对**清洗后** DB 计算)、`media[]: { id, path, contentHash, sizeBytes }`

   因为 sanitize(步骤 4)已经把 DB 过滤为 `status='ready' AND parent active`,这里 join 的结果集**应当等价于** `SELECT FROM media`(冗余保险);若两者数量不一致 → spec invariant 被违反,立即中止备份。

6. **Hardlink staging(Codex 第三轮 finding #2 修法)**:
   - 创建 `data/_backup_staging/<backupId>/media/` 目录
   - 对 manifest 列出的**每个**文件执行 `fs.link(原路径, staging路径)`(POSIX hardlink)
   - hardlink 几乎免费,NAS 同文件系统下毫秒级
   - **即使后续生产文件被删,hardlink 副本仍存在**(inode 引用计数 > 0,文件不会被实际释放)
   - 失败兜底:如 hardlink syscall 失败(跨文件系统、磁盘满)→ 回退为 copy;copy 也失败 → 中止备份并清理 staging,返回错误

7. **释放写屏障**:`BACKUP_IN_PROGRESS = false`,后续 owner 的删改操作正常进行
   - **写屏障窗口**:从步骤 1 到步骤 7,典型只持续数秒(取决于 sanitize SQL 执行 + hardlink 数量),家用场景几乎无感

8. **流式打包 zip**:从 `_backup_staging/<backupId>/` 读文件 + 清洗后的 snapshot db + manifest.json,流式输出
   - 即使此时生产侧 owner 在硬删某些 media,staging 里 hardlink 不受影响

9. **校验**:边打包边算 zip 整体 sha256 → 写 zip 注释 + 单独 `babyloom-backup-<ts>.sha256`

10. **响应**:zip 流式下载,文件名 `babyloom-backup-<YYYY-MM-DD-HHMM>.zip`

11. **清理**:打包完成或失败后,`rm -rf data/_backup_staging/<backupId>/`(只删 hardlink,生产文件 inode 不受影响)

**还原流程**(后续迭代,先把"导出可还原"作为设计前提):
1. 上传 zip → 校验整体 sha256
2. 校验 `manifest.dbSha256` 与 zip 内 db 一致
3. 校验每个 media 文件的 sha256 与 manifest 一致
4. **校验清洗不变量**(对解压后的 DB 执行):
   - `SELECT COUNT(*) FROM media WHERE status != 'ready'` = 0
   - `SELECT COUNT(*) FROM entries WHERE status != 'active'` = 0
   - `SELECT COUNT(*) FROM babies WHERE status != 'active'` = 0
   - `SELECT COUNT(*) FROM sessions` = 0
   - `SELECT COUNT(*) FROM media WHERE deletedAt IS NOT NULL OR purgedAt IS NOT NULL` = 0
   - 每条 `media.babyId` 在 `babies.id` 中
   - 每条 `entries.babyId` 在 `babies.id` 中
   - 每条非 NULL `media.entryId` 在 `entries.id` 中
5. 任何不一致 → 拒绝还原并报告差异
6. 通过后停服 → 替换 `babyloom.db` + `media/` → 启动 → reconcile job 自检

**自动备份**(后续迭代):cron 调用同一备份流程,旋转保留 N 份。

**关键不变量**:`manifest.json` 内列出的每个 media 文件**必须**出现在 zip 内;反过来 zip 内的 media 文件**必须**在 manifest 内 — 这是还原一致性的 invariant。

---

## 11. 测试策略

### 11.1 单元 (Vitest)

- `lib/*` 工具函数
- 权限校验逻辑(角色 × Action 矩阵全覆盖,包括 media:* 和所有权判定)
- Zod schemas 正反例
- Drizzle queries(用 in-memory SQLite)
- **媒体上传状态机**:`pending → processing → ready` 与失败分支 `→ failed` 的所有转移路径
- **Reconcile job**:孤儿目录、卡住状态行、过期 deleted 文件的清理逻辑
- **备份 manifest**:join babies 后正确反映 `m.status='ready' AND b.status='active'` 的子集、sha256 计算稳定
- **父链可见性查询**:每个对外出口的 SQL 都覆盖"自身干净 + 父链干净"的不变量
- **Restore 授权**:`deletedBy === userId` 必备约束的正反例

### 11.2 组件 (Vitest + RTL)

- 每个 UI 组件 1-2 个核心用例(渲染 + 主要交互)
- 业务组件覆盖关键状态(loading / empty / error)

### 11.3 E2E (Playwright)

**核心正向流程**:
1. **首次部署**:挂载 config.yaml → 启动 → 登录 → 添加宝宝 → 进入时光
2. **创建记录**:登录 → 新建 entry → 上传 1 张照片 → 选 2 个里程碑 → 保存 → 时光线可见
3. **成员协作**:owner 创建 editor 成员 → 切登录 → editor 创建一条记录 → 切回 owner → 看见 editor 的记录

**安全 / 权限拒绝用例**(必须全部存在,缺一个视为该 endpoint 未完成 — **统一 404 防存在性泄露**):

4. **跨宝宝媒体拒绝(不存在性泄露)**:两个宝宝 A、B;viewer 仅可看 A → viewer `GET /api/media/<B 的 mediaId>` 返回 **404**(不是 403);同时 `GET /api/media/<完全不存在的-uuid>` 也返回 **404**,**两个响应体必须完全相同**(`{ "error": "not_found" }`)
5. **跨作者媒体软删拒绝**:editor1 上传 mediaX → editor2 调用 `POST /api/media/<X>/trash` 返回 **404** → mediaX 仍 `status='ready'`
6. **viewer 写入拒绝**:viewer 调用 `POST /api/media/upload` 返回 **404**(因为它无 `media:write`,统一走 404)
7. **未认证 vs 已认证无权区分**:无 cookie → 401;有 cookie 但无权 → 404
8. **路径遍历拒绝**:`GET /api/media/../../config.yaml` / `GET /api/media/xxx?path=...` 等异常一律 404,且**不会落到文件系统**
9. **跨家庭 target babyId 拒绝**(Codex 第三轮修正):上传时 multipart `babyId` 指向**别人家庭的** baby → DB loader 加载 baby → 跨家庭检查失败 → 统一 404;`babyId` 指向已 `trashed` 的 baby → 同样 404;`babyId` 是非法 UUID → 404
10. **客户端塞 ownership 字段被忽略**:multipart 里塞 `uploadedBy=<other-user-id>` / `status=ready` → 服务端**完全忽略**这些字段,`media.uploadedBy` 必等于 session userId
11. **配置文件改 owner 密码生效**:重写 config.yaml + 重启 → 旧密码 401、新密码成功
12. **GET /api/media/[id]/status 同样套模板**:无权访问的 mediaId 返回 404,不暴露状态信息

**上传幂等 / 状态机用例**(Codex Finding #1 必须覆盖):

12. **真去重(ready 命中)**:上传同一文件两次(同 contentHash、同 clientUploadId 或不同都行)→ 第二次返回 200 + `deduplicated: true`、`mediaId` 与第一次相同、磁盘仅一份原图、partial unique index 仅一条 ready 记录
13. **同请求重试(pending 命中)**:模拟客户端在第一次请求未完成时重传(同 clientUploadId)→ 返回 202 + 进度端点,**不**新建 row,**不**重新落盘
14. **并发独立请求(pending 命中但 token 不同)**:两个独立客户端几乎同时上传同一文件(同 contentHash、不同 clientUploadId)→ 允许并发 → 都进入 pending → commit 时仅一个胜出为 ready,另一个回滚为 failed → 客户端重试时命中 ready 真去重
15. **failed 不卡坑位**:模拟一次 failed → 用户重传同一文件 → **成功创建新 ready row**(不被 failed row 阻塞)
16. **trashed 不卡坑位**:软删一个 media → 重传同一文件 → 成功新建 ready;此时 trashed 行被还原会触发 409(见 §6A.3)

**故障注入用例**(可用 mock 实现):

17. **Sharp 失败 → 无孤儿**:mock Sharp 抛错 → staging 被清空、media 行 `status='failed'`、目标目录无文件
18. **进程中途崩 → reconcile 清理**:手动建一条 `status='processing'` + 1h 前的脏行 + 一个 staging 目录 → 触发 reconcile → 行变 `failed`、目录被删
19. **备份一致性**:并发上传中点击备份 → 上传被短暂拒绝(503)→ 备份完成 → zip 内 manifest 与文件一一对应、sha256 校验通过

**垃圾桶用例**:

20. **软删后从 timeline 消失**:editor 软删自己的 entry → timeline 不再展示 → `/profile/trash` 可见
21. **撤销 toast 还原**:软删后 5 秒内点撤销 → entry 立即回到 timeline、`status='active'`
22. **editor 只能还原自己的**:editor1 软删 entry → editor2 进 `/profile/trash` **看不到**该 entry(列表过滤)
23. **owner 看全部垃圾桶**:owner 进 `/profile/trash` 能看到所有成员软删的内容
24. **editor 硬删拒绝**:editor 调用 `DELETE /api/entries/[id]`(对应 `entry:purge`)→ 404
25. **owner 硬删生效**:owner `DELETE /api/media/[id]` → DB 行 `status='purged'`、磁盘文件被删
26. **owner 清空垃圾桶**:`/profile/trash` 顶部"清空"→ 二次确认 → 所有当前 tab 的 trashed 项变 purged
27. **还原冲突 409**:软删 mediaX(hash=H)→ 重传同 hash 文件成功创建新 ready → 试图还原 X → 409 Conflict
28. **软删 baby 后内容不可见**:软删 babyA → timeline/gallery 中其 entries 和 media 都不再展示(但状态仍是 active/ready,DB 行未变)→ 还原 baby → 自动重新可见
29. **备份排除 trashed**:垃圾桶里有 N 个 media → 触发备份 → manifest 不包含它们、zip 内无这些文件

**Codex 第三轮新增 / 强化**:

30. **备份排除"trashed baby 下的 ready media"**(Codex finding #1):软删 babyA → babyA 下仍有 M 张 status=ready 的 media → 触发备份 → manifest **不含**这 M 张、zip 内**无**这些文件 → 还原 babyA 后 timeline 重新看到它们(数据未丢)
31. **备份期间 owner purge 不破坏 zip**(Codex finding #2):
    - 触发备份,在写屏障期间另一 tab 尝试 `*:purge` → 503
    - 写屏障释放(hardlink 完成)后,另一 tab purge mediaX 成功 → 生产侧 media 文件被删
    - 备份打包继续 → zip 内**仍包含** mediaX(从 hardlink staging 读)→ sha256 校验通过
32. **Hardlink 失败回退 copy**:mock `fs.link` 抛 EXDEV → 自动回退 `fs.copyFile` → 备份成功
33. **Hardlink + copy 全失败**:mock 两者都抛错 → 备份失败、staging 被清理、写屏障被释放、返回错误,**不留半成品**
34. **Editor 还原 owner 软删的内容被拒**(Codex finding #4):
    - editor1 写了 entryX(authorId=editor1)
    - owner 软删 entryX(deletedBy=owner)
    - editor1 进 `/profile/trash` 看不到 entryX(过滤 deletedBy === self)
    - editor1 直接 `POST /api/entries/X/restore` → **返回统一 404**(因为 `deletedBy !== userId`)
    - entryX 仍在 trashed 状态
35. **跨家庭 baby 上传被拒**(Codex finding #3):editor 在 multipart 塞别家庭的 babyId → 404,无 staging 副作用,无 DB 行写入
36. **trashed baby 上传被拒**:multipart babyId 指向已 trashed 的 baby → 404

**Codex 第四轮新增**:

37. **跨宝宝 entryId 上传拒绝**(finding #1):editor 上传时 multipart `babyId=A`,`entryId=<B 宝宝的 entry>` → `entry.babyId !== loaded baby.id` → 404,无 staging,无 DB 写
38. **trashed entryId 上传拒绝**:multipart entryId 指向已 trashed 的 entry → 404
39. **未授权 entryId 上传拒绝**:editor1 上传时 multipart 塞 editor2 作者的 entryId → `entry:write` 权限失败 → 404
40. **合法 entryId 上传成功**:editor 上传带自己作者的 active entryId → media.entryId 写入正确、可在该 entry 详情看到
41. **无 entryId 上传成功**:multipart 不传 entryId → 上传成功、`media.entryId IS NULL`
42. **清洗后 DB 无 trashed 元数据**(finding #2):
    - 制造数据:owner 软删 mediaX(filename=`secret.jpg`)+ owner 软删 entryY + owner 软删 babyZ
    - 触发备份 → 拿到 zip → 解压 db
    - 断言:`SELECT COUNT(*) FROM media WHERE status='trashed'` = 0
    - 断言:`SELECT COUNT(*) FROM entries WHERE status='trashed'` = 0
    - 断言:`SELECT COUNT(*) FROM babies WHERE status='trashed'` = 0
    - 断言:DB 内**不存在** `filename='secret.jpg'` 的行
    - 断言:`SELECT COUNT(*) FROM sessions` = 0
    - 断言:所有 `deletedAt` / `purgedAt` 字段均为 NULL
43. **清洗后 DB 与文件一一对应**:解压 zip → 遍历 DB 中所有 media 行 → 每条都能在 `media/` 目录里找到对应文件;遍历 zip 内每个文件 → 都能在 DB 中找到对应行
44. **VACUUM 后无残留**:制造数据 → 备份前后 sqlite3 dump 出 raw page → 解压备份 db → 用 `sqlite3 .dump` 与文本搜索 → 确认被 sanitize 的 row 字段(如 deleted 的 filename)**不在** page 物理空间内
45. **Sanitize SQL 失败回滚**:mock 4.5 步 SQL 失败 → 备份立即中止、snapshot 文件被删、写屏障被释放、返回 5xx、生产 DB 与文件**未受任何影响**
46. **Media 挂 trashed entry 在备份中被保留**(Codex 第五轮 finding #1):
    - editor1 上传 mediaX 到 entryY(active),`media.entryId = Y`
    - owner 软删 entryY → `entries.status='trashed'`,mediaX 不动(active baby 下的 ready)
    - 触发备份 → 解压 zip 检查:
      - **mediaX 文件仍在 zip 内**(关键 — 媒体不应跟随 entry 被备份丢弃)
      - DB 内 mediaX 行的 `entryId IS NULL`(已切断与已删 entry 的关联)
      - DB 内无 entryY 行(被 sanitize 删除)

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
- ❌ 垃圾桶自动清理 cron(owner 主导)
- ❌ 垃圾桶里二次软删撤销栈(只有一层 trashed)

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
| 媒体 API Route 漏写 `assertPermission` | 自定义 ESLint rule `babyloom/api-route-must-assert` 在 CI 拦截;E2E 测试覆盖跨权限拒绝 |
| 上传过程崩溃产生孤儿文件/脏行 | 两阶段上传 + staging 隔离 + `status` 状态机 + reconcile job 兜底 |
| **上传幂等键卡死(failed/pending row 永久占坑)** | **Partial UNIQUE 仅对 `status='ready'` 生效;status-aware 准入逻辑按命中行状态分支** |
| **响应码差异泄露资源存在性** | **§5.6 统一 404 响应(无权/不存在/非 ready 同样响应体);§5.7 规范化路由模板强制顺序** |
| **服务端误信客户端 babyId** | **§5.5 明确"绝不接受客户端 ownership 字段";§5.7 模板内 babyId 必从 DB loader 读出;E2E 用例 #9 覆盖** |
| 备份取到不一致快照(并发上传期间) | SQLite Online Backup API + 短暂上传冻结 + manifest 校验 + 还原前 sha256 验证 |
| WAL 模式下意外丢失未 checkpoint 的写入 | 启动启用 `journal_mode=WAL` + `synchronous=NORMAL`,备份前显式 `wal_checkpoint(TRUNCATE)` |
| **editor 通过硬删销毁证据** | **硬删(`*:purge`)owner only,editor 即便对自己软删的也无法硬删;UI 不展示按钮 + 后端拒绝双重保险** |
| **垃圾桶无限增长占满 NAS 磁盘** | owner 在 `/profile/trash` 可手动清空;`/profile/data` 显示存储占用;**不做自动清理**(显式选择) |
| **软删 baby 后子资源仍泄露到备份** | §6A.4 父链可见性不变量;§10.4 备份查询 join babies 过滤;E2E 用例 #30 |
| **备份期间并发 purge 让 zip 文件缺失** | §10.4 写屏障扩展为全媒体相关写 + Hardlink staging 解耦生产与打包;E2E 用例 #31-33 |
| **Ownership 与 Target 字段混淆**(实现者错信客户端 babyId 或拒绝必要 target) | §5.5.1 字段分类表;§6.2 step 2.2 显式 DB loader;E2E 用例 #9, #35-36 |
| **Editor 通过直接 API 还原 owner 软删的内容**(UI 过滤被绕过) | §5.4 矩阵 restore 加 `deletedBy === userId` 约束;§5.5.2 UI 过滤 ≠ API 授权原则;E2E 用例 #34 |
| **`entryId` 上传时无 loader,可跨宝宝/跨权限挂载** | §5.5.1 Target field 完整枚举表 + 通用 loader 模板;§6.2 step 2.4 显式 entryId loader;E2E 用例 #37-41 |
| **备份 DB 快照保留 trashed/purged/failed 行元数据** | §10.4 step 4 在 snapshot 上执行 sanitize SQL + VACUUM,与文件清单一一对应;还原前校验清洗不变量;E2E 用例 #42-45 |
| **Sanitize SQL 误删挂在 trashed entry 上的 ready media** | §10.4 step 4.2 改为对 `media.entryId` 仅 UPDATE NULL,不 DELETE 媒体行;E2E 用例 #46 |
| **entryId loader SQL 引用 entries 中不存在的列** | §6.2 step 2.4 & §5.5.1 表统一:entry loader 仅 SELECT `id, babyId, status, authorId`,跨家庭由跨宝宝隐含 |

---

## 14. SQLite 启动 PRAGMA

应用启动时(`lib/db/client.ts`)在打开 DB 后立即执行:

```sql
PRAGMA journal_mode = WAL;       -- 支持并发读 + 在线备份
PRAGMA synchronous = NORMAL;     -- 在 NAS 上的合理耐久度/性能平衡
PRAGMA foreign_keys = ON;        -- 强制外键约束
PRAGMA busy_timeout = 5000;      -- 减少 SQLITE_BUSY
PRAGMA temp_store = MEMORY;
```

---

## 15. Codex Adversarial Review 回应历史

### 15.1 第一轮(2026-05-15)— 已修复

| 发现 | 严重度 | 修复位置 |
|---|---|---|
| 媒体授权链条不完整(无 `media:*` Action、API Route 未强制 wrapper、`media` 缺 `uploadedBy`) | high | §3 schema、§5.4 Action 集、§5.5 调用约定、§11.3 拒绝用例 |
| 上传非原子、无清理无重试语义 | high | §6.1 staging、§6.2 两阶段流程、§3 `status`/`contentHash`、§11 reconcile 测试 |
| 备份可产生不一致快照 | medium | §10.4 SQLite Online Backup + 暂停窗口 + manifest、§14 PRAGMA WAL |

### 15.2 第二轮(2026-05-15)— 已修复

| 发现 | 严重度 | 修复位置 |
|---|---|---|
| 上传幂等返回非 ready row 导致重试卡死;failed row 永久占据 hash 坑位 | high | §3.1 partial unique index、§3 `clientUploadId` 字段、§6.2 status-aware 准入分支表、§11 用例 #12-16 |
| 媒体读取授权顺序不明(`babyId` 来源未约束、404/403 不一致泄露存在性、路径构造时机) | medium | §5.6 统一 404、§5.7 规范化路由模板、§6.3 `loadMediaForRead`、§11 用例 #4-11 |

### 15.3 同期非 Codex 增量

| 增量 | 来源 | 落点 |
|---|---|---|
| 垃圾桶功能(继承 V1 设计哲学,owner-only 硬删,无自动清理) | 用户 | §3 status 字段统一、§5.2 矩阵更新、§6A 专章、§8 `/profile/trash`、§10.4 备份排除 trashed、§11 用例 #20-29 |

### 15.4 第三轮(2026-05-15)— 已修复

| 发现 | 严重度 | 修复位置 |
|---|---|---|
| 备份漏过滤"trashed baby 下的 ready media"(隐私泄露) | high | §6A.4 父链可见性不变量、§10.4 备份查询 join babies、§11 用例 #30 |
| 备份写屏障未覆盖 trash/restore/purge,并发可让 zip 文件缺失 | high | §10.4 写屏障扩展 + Hardlink staging 解耦生产/打包、§11 用例 #31-33 |
| Ownership 与 Target 字段语义混淆(`babyId` 处理矛盾) | medium | §5.5.1 字段分类表、§6.2 step 2.2 DB loader 显式校验、§11 用例 #9, #35-36 |
| Editor 可通过直接 API 调用还原 owner 软删的内容(UI 过滤被绕过) | medium | §5.4 restore 加 `deletedBy === userId`、§5.5.2 UI 过滤 ≠ API 授权原则、§11 用例 #34 |

### 15.5 第四轮(2026-05-15)— 已修复

| 发现 | 严重度 | 修复位置 |
|---|---|---|
| 上传 `entryId` 是 target field 但缺 loader 校验,可跨宝宝/跨权限挂载 | high | §5.5.1 Target field 完整枚举表 + 通用 `loadAndAssertTarget` 模板、§6.2 step 2.4 显式 entryId loader、§11 用例 #37-41 |
| 备份只过滤文件,DB 快照仍含 trashed/purged/failed 行元数据,违反"清洁备份"承诺并可让还原一致性破坏 | high | §10.4 step 4 在 snapshot 上执行 sanitize SQL(DELETE 非干净行 + 清孤儿 + 清审计字段 + 清 sessions + VACUUM)、还原前校验清洗不变量、§11 用例 #42-45 |

**元教训沉淀**:
- **Target field 是个集合,不能漏一个**:任何客户端传入的资源 ID 都必须走相同的 loader 模板,新增字段须先扩充 §5.5.1 的枚举表
- **"清理"必须做到数据层面**:对外发布的产物(备份/导出)需在数据(DB)和文件两个出口同步净化,文件过滤了 DB 也必须过滤,否则元数据会偷渡;`VACUUM` 是防 forensic 残留的必备一步

### 15.6 第五轮(2026-05-15)— 已修复

| 发现 | 严重度 | 修复位置 |
|---|---|---|
| Sanitize SQL 误删挂在 trashed entry 上的 ready media(渐进改稿留下 DELETE+UPDATE 双逻辑) | high | §10.4 step 4.2 删除多余 DELETE 行,只保留 `UPDATE media SET entryId=NULL`;明确"父级必需(baby)删除 / 父级可选(entry)NULL 化"的处理原则;E2E 用例 #46 |
| entryId loader SQL 引用 `entries.familyId` 不存在列 | medium | §6.2 step 2.4 与 §5.5.1 枚举表同步:loader 仅 SELECT 实际存在的列;跨家庭校验由"baby 已属当前 family + entry.babyId === baby.id"联合隐含,不再单独校验 |

**元教训沉淀**:
- **渐进改稿要收尾**:spec 不是讨论稿,不允许"X 应改为 Y"这种 inline 备注与原文并存。改主意了就**真删掉旧逻辑**,留下注释只会被实现者照搬到代码里
- **Schema 与 query 必须对账**:每次新增 loader / 查询 SQL,需要扫一遍它引用的所有列是否真的存在于 schema(§3);spec 内的不同章节是独立演化的,需要 cross-check

---

## 16. 下一步

本设计经用户确认后,进入 `writing-plans` 阶段,产出可执行的实施计划(按模块/阶段拆解)。
