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

// 条目 ↔ 媒体(多对多 — Codex 第七轮 finding #2 修法)
// 一张照片可同时挂多个 entry(全家福既是"今日记录"也是"百日里程碑");
// 也可不挂(裸照片仅在画廊出现)。dedupe 命中已存在媒体时,
// 通过此表 INSERT OR IGNORE 实现幂等 attach,不破坏现有关联。
entry_media {
  entryId: text NOT NULL FK,
  mediaId: text NOT NULL FK,
  attachedBy: text NOT NULL FK,
  attachedAt: integer NOT NULL,
  // PRIMARY KEY (entryId, mediaId)
}

// 媒体文件
// 状态分两段:
//   阶段 1(pending/processing/failed):服务端尚未完成嗅探/落盘,派生字段允许 NULL
//   阶段 2(ready/trashed/purged):服务端已 commit,派生字段必须齐(CHECK 约束)
media {
  id: text PK,                  // uuid,同时作为文件名
  babyId: text NOT NULL FK,
  uploadedBy: text NOT NULL FK, // 上传者 userId,用于"editor 仅可删自己上传的"判定
  filename: text NOT NULL,      // 用户原始文件名(展示用),sanitize 后存
  status: text NOT NULL,        // 完整状态机见 §6.5
                                // 'pending' | 'processing' | 'ready' | 'trashed' | 'purged' | 'failed'
                                // 仅 ready 对外可见;trashed 仅在垃圾桶 UI 可见
  clientUploadId: text,         // 客户端幂等 token(仅 pending/processing 阶段使用)
  createdAt: integer NOT NULL,
  deletedAt: integer,           // 进入 trashed 的时间
  deletedBy: text FK,           // 软删触发者
  purgedAt: integer,            // 进入 purged 的时间
  purgedBy: text FK,            // 硬删触发者(owner 或 system)

  // —— 派生字段:pending/processing/failed 阶段允许 NULL,由服务端在 §6.2 step 3-6 填充 ——
  type: text,                   // 'photo' | 'video' — 嗅探后定
  mimeType: text,               // 服务端嗅探结果(见 §6.2 step 3 白名单)
  sizeBytes: integer,           // 服务端流式累计结果
  contentHash: text,            // 服务端流式 sha256 结果,幂等键
  width: integer,
  height: integer,
  durationSec: integer,         // 仅视频
  relativePath: text,           // 'media/<babyId>/<year>/<month>/<mediaId>' — commit 时定
  takenAt: integer,             // 从 EXIF,fallback createdAt

  // —— Status-aware 完整性约束(Codex 第九轮 finding #1 修法) ——
  CHECK (
    status IN ('pending', 'processing', 'failed')
    OR (
      -- ready / trashed / purged 必须字段齐全
      type         IS NOT NULL
      AND mimeType     IS NOT NULL
      AND sizeBytes    IS NOT NULL
      AND contentHash  IS NOT NULL
      AND relativePath IS NOT NULL
    )
  )
  // 见 §3.1 索引:partial UNIQUE 仅对 status='ready' 生效(且因 ready 必有 contentHash,索引可正常构建)
}

// 会话(better-auth 自动管理)
sessions { id, userId, token, expiresAt, ipAddress, userAgent, ... }

// 凭据账户(better-auth 拆出来的实施细节,§3.2 物理布局)
accounts {
  id, userId, providerId,    // providerId='credential' 表示账号密码登录
  password,                  // bcrypt/scrypt hash — 这才是密码真实存储位置
  createdAt, updatedAt
}

// 验证票据(better-auth 用于忘密码/邮件验证等;V2 不实际使用)
verifications { id, identifier, value, expiresAt }
```

### 3.2 物理布局 vs 概念模型(better-auth 实施细节)

上面 `users { ..., passwordHash }` 是**概念模型**(便于权限矩阵讨论)。**实际物理 schema 必须遵守 better-auth 拆 4 表布局**(Codex 第十轮 finding #3 修法):

| 概念字段 | 物理位置 | 备注 |
|---|---|---|
| 用户 ID / username / nickname / role | `users` 表 | better-auth 要求 `name`/`email`,V2 把 `name` 用作 nickname,`email` 用 `${username}@local.babyloom` 内部派生(用户从不见到) |
| 密码 hash | `accounts.password`,`providerId='credential'`,`userId` FK 回 users | better-auth login flow 从此处读 + 校验 |
| 会话 | `sessions` 表(`token` 必须存在,better-auth 强制) | 含 cookie token |
| 验证票据 | `verifications` 表 | V2 暂不用,但 better-auth 要求建表 |

**bootstrap 永久原则**:任何写 owner 的代码必须**同事务**写两张表——`users`(身份)+ `accounts.password`(凭据)。只写 `users` → owner 无法登录;只写 `accounts` → 没有 user 来挂账。改密码同理:更新 `accounts.password` 而**不**改 `users` 上任何"密码字段"(因为概念上的 `passwordHash` 不在 users 表上)。

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
- `entry_media`: PRIMARY KEY (entryId, mediaId) — 天然防重复 attach
- `entry_media`: `(mediaId)` 用于"找出这张照片挂在哪些 entry 下"
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
  password: "your-password-here"  # 明文密码,启动时 scrypt 哈希进 DB
  nickname: "爸爸"                # 显示名

family:
  name: "我们家"                  # 家庭显示名(可在 App 内改)

app:
  baseUrl: "http://nas.local"     # 用于生成绝对 URL(可选)
  secret: "change-me-at-least-32-chars" # better-auth session/signing secret,生产必填
  timezone: "Asia/Shanghai"       # 默认 Asia/Shanghai
```

P0 使用 better-auth 的 email/password provider,但产品语义仍是**用户名登录**:
- UI 与 `config.yaml` 只暴露 `owner.username`。
- better-auth 需要的 email 是内部实现细节,由服务端派生:`<username>@local.babyloom`。
- `username` 改动时,启动 bootstrap 同步更新 owner 的 internal email 与 credential accountId。
- 用户永远不需要知道或输入这个 internal email。

### 4.3 启动行为

应用启动时(`lib/config/bootstrap.ts`):

1. **读取 `data/config.yaml`**
   - 文件不存在 → 写 `config.example.yaml` 到 data 目录 → 打印错误并退出
   - YAML 解析失败 → 打印错误并退出(`level: fatal`)
2. **Zod 校验**(`username` 非空、密码长度 ≥ 6、`app.secret` 长度 ≥ 32 等)
3. **与 DB 对账**:
  - DB 无 owner → 创建 owner user + family
  - DB 已有 owner 且 username 相同 → 更新 credential password hash 和 `nickname`(实现"改文件重置密码")
  - DB 已有 owner 但 username 不同 → 更新现有 owner 的 username 与 internal email(保持身份连续)
4. **启动完成**,记录 `info` 日志

### 4.4 配置文件改动不热加载

仅启动时生效。改完需 `docker compose restart`。**不监听 fs 变化(YAGNI)**。

### 4.5 安全

- 文件应 `chmod 600`(部署文档说明)
- 启动后立即 scrypt 哈希进 DB,DB 中只有 hash
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

`baby_member_permissions` 是**范围闸门**(scope gate),不是授权机制(authorization grant)。语义:

- **作用**:在某个 baby 上**收窄或维持**某个非 owner 成员的能力,例如让二宝的奶奶只能看二宝(其他宝宝拿不到 `canRead`)
- **不作用**:无法**扩大**该成员的角色权限边界——任何 owner-only action(`*:purge`、`baby:trash/restore/purge`、`member:manage`、`family:manage`、`milestone:manage`、`system:*`)即便 `canDelete=1` 也**不**给非 owner 解锁
- 未配置 → 默认走 family role(等价"全部 babies 都按 role 允许")

**实现要求**(Codex 第十轮 finding #1 修法):
- override 命中后**不能**早 return / 跳过 role+ownership 矩阵;override 只决定"是否允许进入该 baby 的 action 域",最终 allow/deny 仍走 §5.4 矩阵
- override 的 `canRead/canWrite/canDelete` 仅映射到对应**非 owner-only** 子集(read/write/trash);purge 和 baby-scope 管理类 action **不参考 override**,直接由 §5.4 矩阵裁决

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

**关键信任边界**(Codex 第八轮 finding #1/#2 修法):
- **客户端声明的 `contentHash` 永不作权威**:服务端必须自己流式 hash 上传字节,以服务端计算结果为准。若客户端 `contentHash` 与服务端结果不一致 → 422,**绝不进入 dedupe 分支**
- **客户端声明的 `mimeType` 永不作权威**:服务端必须用 Sharp / ffprobe 嗅探真实容器格式 + 校验白名单。存入 DB 的 `mimeType` 是服务端嗅探结果,服务输出时 `Content-Type` 也以此为准(见 §6.3)
- **Dedupe 副作用必须在服务端验证哈希之后**:任何 `INSERT OR IGNORE INTO entry_media`、`200 deduplicated: true` 这类"承认你拥有此文件"的响应,只能在服务端已收完整字节并 hash 对账后才允许发出
- **以 mediaId attach 不走 upload**:若客户端已知某 mediaId 想挂到 entry 上(不重新上传字节),走 §6.2.1 专用端点;upload 端点不接受"只声明哈希不上传字节"的语义

**MIME 白名单**(实现端硬编码,任何不在表内的格式 → 422):

| 类型 | 允许的容器 / 嗅探结果 | 备注 |
|---|---|---|
| photo | `image/jpeg` / `image/png` / `image/webp` / `image/heic` / `image/heif` | Sharp `metadata()` 读出的 `format` 反推 |
| video | `video/mp4` / `video/quicktime` | ffprobe `format_name` 反推 |

**显式拒绝**:`image/svg+xml`(SVG = 可执行 XML)、`text/html`、`application/*`、任何 `*/x-*` 实验类型、扩展名为 `.htm/.html/.svg/.xml/.js/.wasm` 的文件(即便嗅探说是图片也拒绝,因双重保险)。

**流程**:

1. **客户端**:
   - 生成 `clientUploadId = uuidv4()`(本次上传任务的稳定 token,**网络层重试必须复用同一个**;不再传 `contentHash`,服务端权威)
   - `POST /api/media/upload` multipart:
     - **Target 字段**(用户选择,必传):`babyId`(目标宝宝)、可选 `entryId`(若关联记录)
     - **请求字段**:`clientUploadId`, `filename`(仅展示用,服务端会单独 sanitize), 文件二进制
     - **绝不接受**(出现一律忽略,见 §5.5.1):`uploadedBy / authorId / familyId / status / contentHash / mimeType / sizeBytes / width / height / durationSec` — 这些都是服务端权威派生字段

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
   - 至此 `entry` row 可信,后续用 `entry.id`(绝不用 multipart 原值)写入 `entry_media.entryId`

   **2.5 准入分支(基于 `clientUploadId`,不基于哈希)**:
   ```sql
   SELECT id, status, uploadedBy FROM media
   WHERE clientUploadId = ? AND uploadedBy = ?
   ```
   仅按"同一上传任务的网络重试"识别。**不在此处做基于 contentHash 的 dedupe**(因为还没收字节、还没拿到服务端权威 hash)。

   | 命中状态 | 处理 |
   |---|---|
   | `pending` / `processing` | **同请求重试**:202 `{ mediaId, status, pollUrl }`,客户端轮询,**不再次接收字节** |
   | `ready` | 上次已成功,直接 200 `{ mediaId, deduplicated: false }`(此次为幂等重发) |
   | `failed` | 旧行保留作审计,继续走新 row(下面步骤 3) |
   | 无命中 | 走新 row |

3. **服务端 — Stream + Stage + 服务端权威 hash + MIME 嗅探**(对"走新 row"分支):
   - 在事务内 `INSERT INTO media (id=uuid, status='pending', babyId, clientUploadId, uploadedBy, filename, createdAt)` —— 派生字段 `type / mimeType / sizeBytes / contentHash / width / height / durationSec / relativePath` 留 NULL,符合 §3 schema 中 status-aware CHECK(pending/processing/failed 阶段允许 NULL)
   - 流式接收 multipart body 文件部分写入 `data/media/_staging/<mediaId>/raw.bin`(扩展名先用中性 `.bin`,等嗅探后再决定),**边写边算 sha256 + 累计 bytes**
   - 落字节上限阈值(从 config 读,默认 photo 50MB / video 500MB);流式累计超限 → 中止 + 删 staging + `status='failed'` + 413
   - 写完后:
     - 服务端 `contentHash := streamingHashResult`、`sizeBytes := streamingBytesResult`
     - **MIME 嗅探**:
       - 用 `file-type` 库读首部 magic bytes(避免任何 trust on filename / declared mime)
       - 若嗅探类型 ∈ MIME 白名单中 photo 集合 → 用 Sharp `metadata()` 二次确认 + 拿 `width/height`,失败 → 422
       - 若嗅探类型 ∈ video 集合 → 用 ffprobe 确认 + 拿 `width/height/durationSec`,失败 → 422
       - 不在白名单 → 422,删 staging,`status='failed'`
     - 服务端 `mimeType := sniffResult`、写 `width/height/durationSec`
     - 服务端按 sniffMime 派生真实扩展(`.jpg/.png/.webp/.heic/.mp4/.mov`),将 `raw.bin` 改名为 `original.<ext>`
     - `filename` 字段做 sanitize:strip 路径分隔符 + 截断到 255 字符 + 替换不可打印字符;**注意 `filename` 仅是展示用元数据,服务输出绝不用它构造 Content-Disposition 的 path part 或落盘路径**(落盘路径只用 `mediaId`)

4. **服务端 — 服务端权威 hash 完成后的 dedupe 检查**(关键修法位置):

   现在我们手里持有的是**自己算的** `contentHash`,可以安全 dedupe:
   ```sql
   SELECT id, status, uploadedBy FROM media
   WHERE babyId = ? AND contentHash = ? AND status = 'ready' AND id != ?
   LIMIT 1
   ```
   (`id != ?` 排除本次插入的 pending row)

   | 结果 | 处理 |
   |---|---|
   | 命中已有 `ready` row(mediaId = X) | **真 dedupe**(此时已证明持有字节):删 staging、把本次 pending row 标 `status='failed'`(或直接 DELETE,保留 row 也可)。**若提供 entryId**:同事务 `INSERT OR IGNORE INTO entry_media (entryId=entry.id, mediaId=X, attachedBy=userId, attachedAt=now)`。返回 200 `{ mediaId: X, deduplicated: true }` |
   | 无命中 | 继续步骤 5 处理 |

5. **服务端 — Process**(仅"走新 row 且非 dedupe"分支,在 staging 内):
   - `status='processing'`
   - Sharp 并行生成 large/thumb(从 `original.<ext>` 派生);视频抓 poster;提取 EXIF → `takenAt`
   - 任一步失败 → 删 `_staging/<mediaId>/` → `status='failed'` → 5xx 抛错

6. **服务端 — Commit(原子)**:
   - 确保目标目录存在(`data/media/<babyId>/<year>/<month>/<mediaId>/`)
   - 用 `fs.rename` 把 staging 目录所有文件(`original.<ext>` + `large.webp` + `thumb.webp`,视频则 + `poster.webp`)移到最终位置(同文件系统原子)
   - 事务内一次性写齐 §3 status-aware CHECK 要求的所有派生字段:
     - `status='ready'`
     - `type`(photo/video,从步骤 3 嗅探派生)
     - `mimeType`(步骤 3 嗅探结果)
     - `sizeBytes`、`contentHash`(步骤 3 流式结果)
     - `width`、`height`、`durationSec`(步骤 3 metadata)
     - `relativePath`(`media/<babyId>/<year>/<month>/<mediaId>`)
     - `takenAt`(EXIF 或 createdAt)
   - **若提供 entryId**:同事务 `INSERT OR IGNORE INTO entry_media (entryId=entry.id, mediaId, attachedBy=userId, attachedAt=now)`
   - 此刻 partial unique index 才生效;**若此时检测到约束冲突**(极端并发:两个独立请求同一文件同时 commit),保留一个 `ready`,另一个回滚为 `failed`、删 staging,客户端可重试(下次走步骤 4 dedupe 分支 + attach)

7. **进度轮询端点**:`GET /api/media/[id]/status` — 返回 `{ status, progress? }`,供步骤 2.5 表中 202 场景使用,同样走 §5.7 模板

8. **失败恢复 / Reconcile Job**(应用启动 + 每天一次):
   - `status IN ('pending','processing')` 且 `createdAt < now - 1h` → 删 staging、标 `failed`
   - `_staging/` 内无对应 DB row 的目录 → 删
   - 不处理 `trashed`(用户主导,见 §6.5)

9. **对外可见性**:所有业务查询默认 `WHERE status = 'ready'`;`trashed` 仅在垃圾桶 endpoint 可见;`failed` / `purged` / `pending` / `processing` 对用户完全隐藏

### 6.2.1 Attach existing media to entry(独立端点,Codex 第八轮 finding #1 修法)

不重新上传字节,把**已有的 mediaId** 挂到一个 entry 上,是一个独立语义,不应通过 upload + 客户端哈希实现。

`POST /api/entries/[entryId]/media/[mediaId]/attach`

走 §5.7 `withAuthorizedResource` 模板,**两个 target 都走 loader**:

1. **认证** → 401
2. **mediaId loader**(§6.3 同款 JOIN babies):`SELECT m.id, m.babyId, m.status, m.uploadedBy, b.status AS babyStatus FROM media m JOIN babies b ON b.id = m.babyId WHERE m.id = ?`;`m.status != 'ready'` OR `b.status != 'active'` → 404;`assertPermission(userId, 'media:read', { mediaId, babyId: m.babyId })`,失败 → 404
3. **entryId loader**:`SELECT id, babyId, status, authorId FROM entries WHERE id = ?`;非 active → 404;跨宝宝(`entry.babyId !== media.babyId`)→ 404;`assertPermission(userId, 'entry:write', { entryId, authorId, babyId })`,失败 → 404
4. **写**:`INSERT OR IGNORE INTO entry_media (entryId, mediaId, attachedBy=userId, attachedAt=now)`,返回 200 `{ attached: true, alreadyExisted: <bool> }`

**关键不变量**:此端点**完全不接受 contentHash**,也不能用任何客户端声明字段决定授权。哈希只在 §6.2 的服务端流式计算中出现,从不作为身份/可见性证明。

`DELETE /api/entries/[entryId]/media/[mediaId]/attach`(detach):同上两个 loader + `assertPermission(userId, 'entry:write', ...)` → `DELETE FROM entry_media WHERE entryId=? AND mediaId=?`。媒体本身不动(只断关联)。

### 6.3 输出流程(走 §5.7 模板 + 父链 join)

`GET /api/media/[id]?size=thumb|large|original`:

走 §5.7 `withAuthorizedResource('media:read', loadMediaForRead, ...)`,其中:
- `loadMediaForRead(id)` **必须 JOIN babies**(Codex 第六轮 finding #2 修法):
  ```sql
  SELECT m.id, m.babyId, m.status, m.uploadedBy, m.type, m.relativePath,
         b.status AS babyStatus
  FROM media m
  JOIN babies b ON b.id = m.babyId
  WHERE m.id = ?;
  ```
  **绝不读客户端 babyId**
- **联合状态闸门**:必须同时 `m.status === 'ready'` **AND** `b.status === 'active'` → 任一失败走 §5.6 统一 404
  > 关键:防止 baby 被软删后,持有 mediaId 的客户端通过直链绕过 timeline/gallery 的父链过滤继续下载照片
- `size` 参数白名单校验(`thumb|large|original|poster`),非法 → 400
  - 视频 media 的 `?size=thumb|large` 自动等价于 `?size=poster`(画廊封面)
  - 图片 media 的 `?size=poster` → 400(无此变体)
- 通过授权后才拼绝对路径(从 DB `relativePath` + size 决定文件名),流式输出。

**响应头硬性要求 — Per-variant Content-Type**(Codex 第八轮 finding #2 + 第九轮 finding #2 修法):

派生文件(thumb/large/poster)固定为 WebP(由 Sharp 在 §6.2 step 5 生成,见 §6.2 处理流程),与原图 MIME 解耦。**响应头按 size 派生**:

| `size` 参数 | 实际文件名 | `Content-Type` | `Content-Disposition` |
|---|---|---|---|
| `original`(photo) | `original.<sniffed-ext>` | **DB `media.mimeType`**(原图嗅探结果,如 `image/jpeg`) | `attachment; filename*=UTF-8''<sanitized>` |
| `original`(video) | `original.<sniffed-ext>` | **DB `media.mimeType`**(如 `video/mp4`) | `attachment; filename*=UTF-8''<sanitized>` |
| `large`(photo only) | `large.webp` | **硬编码 `image/webp`** | `inline; filename*=UTF-8''<sanitized>.webp` |
| `thumb`(photo only) | `thumb.webp` | **硬编码 `image/webp`** | `inline; filename*=UTF-8''<sanitized>.webp` |
| `poster`(video only) | `poster.webp` | **硬编码 `image/webp`** | `inline; filename*=UTF-8''<sanitized>.webp` |

> **关键不变量**:`Content-Type` **不是** per-media 属性,而是 **per-variant** 属性。同一个 mediaId 在不同 `size` 下返回不同字节、不同 MIME,缓存键也因此天然分离(URL 里的 `size` 参数即缓存键的一部分)。

**其余响应头**(对所有 variant 通用):
- `X-Content-Type-Options: nosniff`:阻断浏览器内容嗅探兜底
- `Content-Security-Policy: default-src 'none'; sandbox`:即便某个 MIME 失误被歧义解释,沙箱化阻断脚本执行(媒体响应不需要任何 JS 上下文)
- `Cache-Control: private, max-age=31536000, immutable`
- 支持 `Range` 请求(视频 `original` 必备;图片派生也支持 — Sharp 输出的 WebP 可被 byte range 访问)

> filename sanitize:strip 控制字符、CR/LF、双引号;按 RFC 5987 用 `filename*=UTF-8''<percent-encoded>` 兼容非 ASCII。绝不让 filename 进入路径拼接(落盘只用 `mediaId`)。派生变体的 filename 在用户 filename 后拼 `.webp` 后缀(便于下载场景识别)。

### 6.3.1 所有 media route loader 统一要求

凡是 `/api/media/[id]/*` 的 endpoint,其 loader **必须**遵循同一模式:JOIN babies + 联合状态闸门。具体每个 endpoint 接受的状态集合不同:

| Endpoint | Action | 接受的 `m.status` | 接受的 `b.status` |
|---|---|---|---|
| `GET /api/media/[id]` | `media:read` | `ready` | `active` |
| `GET /api/media/[id]/status` | `media:read` | 任意非 purged(用于轮询上传进度) | `active` |
| `POST /api/media/[id]/trash` | `media:trash` | `ready` | `active` |
| `POST /api/media/[id]/restore` | `media:restore` | `trashed` | `active`(还原前提是父 baby 必须 active) |
| `DELETE /api/media/[id]` | `media:purge` | `trashed` | `active` 或 `trashed`(允许 owner 在 trashed baby 下硬删媒体) |

不符合上述状态组合 → 统一 404。

### 6.3.2 entries / babies 路由同样要求

`entry:*` 系列 endpoint 的 loader 同样 JOIN babies 校验 `b.status='active'`;`baby:*` 自身无父级,跳过 join 但仍校验自身 status。详见 §6A.4 父链可见性检查清单。

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
- 关联清理(同事务):
  - 硬删 entry → 关联 `entry_milestones` 删除;**`entry_media` 中 entryId=该 entry 的行全部删除**(媒体本身保留,仅断关联)
  - 硬删 media → **`entry_media` 中 mediaId=该 media 的行全部删除**(entry 本身保留)
  - 硬删 baby → 该宝宝下所有 `entries` 和 `media` **必须先**全部进 trashed 状态(否则拒绝),硬删 baby 时不级联硬删它们(避免一键销毁)— 由 owner 显式批量硬删
- DB 行保留为 `purged`(审计用),业务查询全不可见

**N:M attach/detach 语义**:
- attach:上传或 dedupe 命中 ready 时,若提供 entryId 则 `INSERT OR IGNORE INTO entry_media`(幂等)
- detach:暂不暴露独立 UI(YAGNI),由 entry/media 的软删/硬删流程间接处理
- attach 权限:`entry:write` for entry + `media:read` for media(同 baby 内已默认成立)
- attach 跨 baby 不允许:upload step 2.4 已保证 entry.babyId === target baby.id

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

**"对外出口"逐项检查清单**(Codex 第六轮强化 — 不再依赖记忆,实现端逐行打勾):

| # | 出口 | 必 JOIN 父级 | 父级接受状态 | 自身接受状态 |
|---|---|---|---|---|
| 1 | `/timeline` RSC 查询 | babies | active | entries: active |
| 2 | `/gallery` RSC 查询 | babies | active | media: ready |
| 3 | `/calendar` RSC 查询 | babies | active | entries: active |
| 4 | `/entry/[id]` RSC(entry 本身) | babies | active | entries: active |
| 4b | `/entry/[id]` 关联媒体列表(JOIN entry_media → media)| babies(对 m.babyId)| active | media: ready;entry_media 行无 status |
| 5 | `GET /api/media/[id]` | babies | active | media: ready |
| 6 | `GET /api/media/[id]/status` | babies | active | media: 非 purged |
| 7 | `POST /api/media/[id]/trash` | babies | active | media: ready |
| 8 | `POST /api/media/[id]/restore` | babies | active | media: trashed |
| 9 | `DELETE /api/media/[id]` (purge) | babies | active 或 trashed | media: trashed |
| 10 | `POST /api/entries/[id]/trash` | babies | active | entries: active |
| 11 | `POST /api/entries/[id]/restore` | babies | active | entries: trashed |
| 12 | `DELETE /api/entries/[id]` (purge) | babies | active 或 trashed | entries: trashed |
| 13 | `GET /api/trash` 列表(垃圾桶页) | babies | active 或 trashed(不显示 purged 下的) | media: trashed / entries: trashed |
| 14 | 备份 manifest 查询(§10.4 step 5) | babies | active | media: ready / entries: active |
| 15 | 媒体物理路径计算(§6.3 拼绝对路径) | 已经过 5/6/7/8/9 校验 | — | — |
| 16 | RSS / 分享(若后续添加)| 必须 JOIN | active | active/ready |

**实现端要求**:每个出口的 SQL/loader 都必须显式 join babies 表并 WHERE 双重过滤。**自定义 ESLint rule 检查**:任何对 `media` / `entries` 表的查询若没出现 `babies` join,需有 `// PARENT-CHAIN-EXEMPT: <reason>` 注释豁免,否则 CI 拦截。

清单内每一项对应一个 §11 测试用例,缺一即视为该出口未完成。

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
- 关联的 `entry_media` 行**不**删除(还原时需要恢复关系);仅当 entry **硬删(purge)** 时才级联 `DELETE FROM entry_media WHERE entryId=?`(见 §6A.3)
- 软删期间 entry detail 查询走父链可见性过滤(`status='active'`),其 entry_media 行自然不被读到
- 若 entry 还原 → 关联 media 自动重新挂上(因 entry_media 行还在)

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

   在 snapshot DB(**不动生产 DB**)上执行,全部在单一事务内,失败立即中止备份。

   **SQL 顺序约束**(Codex 第六/第七轮综合修法):snapshot 启用 `PRAGMA foreign_keys = ON` 与生产一致。完整 inbound FK 拓扑:
   ```
   entry_milestones.entryId → entries.id   (inbound 到 entries)
   entry_media.entryId      → entries.id   (inbound 到 entries)
   entry_media.mediaId      → media.id     (inbound 到 media)
   media.babyId             → babies.id    (inbound 到 babies)
   entries.babyId           → babies.id    (inbound 到 babies)
   baby_member_permissions.babyId → babies.id  (inbound 到 babies)
   ```

   **永久原则**:删任何表 T 前,先扫整个 schema 找出所有引用 T 的 FK 列,清空它们后再删 T。

   ```sql
   BEGIN;

   -- ========== Stage A:处理"将被删的 entries"集合 ==========
   -- "将被删的 entries" = (status != 'active') OR (父 baby trashed)
   -- 这些 entries 的 inbound 持有者:entry_milestones、entry_media

   -- A1. 切断 entries 的 inbound:entry_milestones
   DELETE FROM entry_milestones WHERE entryId IN (
     SELECT id FROM entries
     WHERE status != 'active'
        OR babyId IN (SELECT id FROM babies WHERE status != 'active')
   );

   -- A2. 切断 entries 的 inbound:entry_media(那些指向将被删 entry 的行)
   DELETE FROM entry_media WHERE entryId IN (
     SELECT id FROM entries
     WHERE status != 'active'
        OR babyId IN (SELECT id FROM babies WHERE status != 'active')
   );

   -- A3. 现在可以安全删 entries
   DELETE FROM entries
   WHERE status != 'active'
      OR babyId IN (SELECT id FROM babies WHERE status != 'active');

   -- ========== Stage B:处理"将被删的 media"集合 ==========
   -- "将被删的 media" = (status != 'ready') OR (父 baby trashed)
   -- 这些 media 的 inbound 持有者:entry_media

   -- B1. 切断 media 的 inbound:entry_media(指向将被删 media 的行)
   DELETE FROM entry_media WHERE mediaId IN (
     SELECT id FROM media
     WHERE status != 'ready'
        OR babyId IN (SELECT id FROM babies WHERE status != 'active')
   );

   -- B2. 删 media
   DELETE FROM media
   WHERE status != 'ready'
      OR babyId IN (SELECT id FROM babies WHERE status != 'active');

   -- ========== Stage C:处理"将被删的 babies"集合 ==========
   -- "将被删的 babies" = status != 'active'
   -- inbound 持有者已在 A/B 全清,还剩 baby_member_permissions

   -- C1. 切断 babies 的 inbound:baby_member_permissions
   DELETE FROM baby_member_permissions
   WHERE babyId IN (SELECT id FROM babies WHERE status != 'active');

   -- C2. 删 babies
   DELETE FROM babies WHERE status != 'active';

   -- ========== Stage D:清理审计字段(保留行不留痕迹)==========
   UPDATE media   SET deletedAt=NULL, deletedBy=NULL, purgedAt=NULL, purgedBy=NULL;
   UPDATE entries SET deletedAt=NULL, deletedBy=NULL;
   UPDATE babies  SET deletedAt=NULL, deletedBy=NULL;
   -- clientUploadId 上传期间幂等 token,ready 之后无用
   UPDATE media   SET clientUploadId=NULL;

   -- ========== Stage E:不进备份的表 ==========
   DELETE FROM sessions;

   COMMIT;

   -- ========== Stage F:VACUUM 物理释放,防 forensic 残留 ==========
   VACUUM;
   ```

   **执行后不变量**(每条都是 §11 测试断言):
   - `SELECT COUNT(*) FROM media   WHERE status != 'ready'`  = 0
   - `SELECT COUNT(*) FROM entries WHERE status != 'active'` = 0
   - `SELECT COUNT(*) FROM babies  WHERE status != 'active'` = 0
   - `SELECT COUNT(*) FROM media   WHERE deletedAt IS NOT NULL OR purgedAt IS NOT NULL` = 0
   - `SELECT COUNT(*) FROM sessions` = 0
   - 每条 media.babyId 都在 babies.id 集合内
   - 每条 entries.babyId 都在 babies.id 集合内
   - 每条 entry_media.entryId 都在 entries.id 集合内
   - 每条 entry_media.mediaId 都在 media.id 集合内
   - 每条 entry_milestones.entryId 都在 entries.id 集合内
   - 每条 baby_member_permissions.babyId 都在 babies.id 集合内

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
4. **校验清洗不变量**(对解压后的 DB 执行 — 与 §10.4 step 4 后置不变量一致):
   - 所有 status 干净、所有审计字段 NULL、sessions 空
   - 所有跨表引用闭合(media→baby、entry→baby、entry_media→entry/media、entry_milestones→entry、baby_member_permissions→baby)
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
40. **合法 entryId 上传成功**:editor 上传带自己作者的 active entryId → `entry_media (entryId, mediaId)` 行被写入(attachedBy=editor)、可在该 entry 详情看到该 media
41. **无 entryId 上传成功**:multipart 不传 entryId → 上传成功、`SELECT COUNT(*) FROM entry_media WHERE mediaId=<新 media>` = 0;该 media 仅在画廊可见
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
46. **Media 挂 trashed entry 在备份中被保留**(Codex 第五轮 finding #1,N:M 模型下):
    - editor1 上传 mediaX 到 entryY(active),`entry_media` 有 (Y, X) 行
    - owner 软删 entryY → `entries.status='trashed'`,mediaX 不动
    - 触发备份 → 解压 zip 检查:
      - **mediaX 文件仍在 zip 内**(媒体不跟随 entry 删除)
      - DB 内**无** `entry_media` 中 entryId=Y 的行(被 sanitize Stage A2 删)
      - DB 内**无** entryY 行(Stage A3 删)
      - DB 内 mediaX 行存在且 status='ready'

**Codex 第六轮新增**:

47. **Sanitize SQL 在带 trashed baby + ready media 时不违反 FK**(finding #1):
    - 设置 `PRAGMA foreign_keys = ON`(与生产一致)
    - 制造数据:babyA `status='trashed'`,babyA 下 mediaX `status='ready'`,entryY `status='active'`,babyB `status='active'` 下 entryZ `status='trashed'` 挂着 mediaW `status='ready'`
    - 触发备份 → snapshot sanitize 应**成功提交事务**,不抛 FK 错误
    - 验证备份后 DB:
      - babyA、mediaX、entryY 均不在(随父链清理)
      - babyB 在,mediaW 在;`SELECT COUNT(*) FROM entry_media WHERE mediaId=W` = 0(挂载关系被 Stage A2 切;其 entry 被 Stage A3 删;媒体本身保留)
48. **直链下载越过软删 baby 被拒**(finding #2):
    - editor 持有 mediaX 的 URL,babyA 是 mediaX 的父
    - owner 软删 babyA → `babies.status='trashed'`,mediaX 自身仍 `ready`(独立生命周期)
    - editor 直接 `GET /api/media/X?size=large` → loader JOIN babies → `b.status != 'active'` → **统一 404**
    - 同理 `GET /api/media/X/status` 也 404
49. **软删 baby 后媒体软删 endpoint 拒绝**:editor 知道 mediaX ID,babyA 已 trashed → editor `POST /api/media/X/trash` → 404(父级非 active)
50. **还原 trashed baby 后媒体直链恢复**:接 #48,owner 还原 babyA → `babies.status='active'` → editor 重新 `GET /api/media/X` → 200
51. **父链清单全量覆盖**:对 §6A.4 清单 16 项中的每一项,各写一个用例,验证其 SQL 已带 babies JOIN + 双重 status 过滤

**Codex 第七轮新增**:

52. **Sanitize 处理 trashed entry + ready media + entry_milestones**(finding #1):
    - 制造数据:active babyA 下,entryY `status='trashed'`,通过 `entry_media` 挂 mediaX `status='ready'`,关联 2 个 milestone
    - 启用 `PRAGMA foreign_keys=ON`,触发备份
    - 验证:事务**成功提交**(不抛 FK 错误);zip 内 mediaX 文件在;DB 内无 entryY、无 `entry_media (entryY,*)`、无 `entry_milestones (entryY,*)`、mediaX 行 status='ready'

53. **N:M attach 幂等性**(finding #2):
    - editor 上传 fileF 挂 entryA → `entry_media (A, mediaX)` 行存在
    - editor 同 fileF 再上传一次挂同 entryA(相同 contentHash + 相同 entryId)→ dedupe 命中 ready → `INSERT OR IGNORE` → `entry_media` 仍只有 1 行 (A, mediaX)、磁盘只一份

54. **N:M attach 跨 entry**(finding #2 — 核心场景):
    - editor 上传 fileF 挂 entryA → `entry_media (A, mediaX)`
    - editor 同 fileF 再上传一次挂 entryB(同 baby 下另一个 active entry)→ dedupe 命中 ready → INSERT entry_media (B, mediaX) 成功
    - 验证:`entry_media` 有两行 `(A, mediaX) (B, mediaX)`、磁盘仍只一份 fileF
    - 进入 entryA 详情 → 看到 mediaX;进入 entryB 详情 → 同样看到 mediaX

55. **N:M attach 跨家庭被拒**:editor 上传 fileF 挂 entry,entry 来自别人家庭 → §6.2 step 2.4 跨宝宝校验失败 → 404,无 entry_media 行写入

56. **硬删 entry 时 entry_media 级联**:owner purge entryY → 事务内 `DELETE FROM entry_media WHERE entryId=Y`、entry 状态变 purged、相关 media 不受影响(仍 ready,可在画廊看到)

57. **硬删 media 时 entry_media 级联**:owner purge mediaX → 事务内 `DELETE FROM entry_media WHERE mediaId=X`、media 状态变 purged、相关 entries 仍 active(详情页不再列出该 media)

58. **裸照片(无 entry)上传与查询**:editor 上传不带 entryId → media 写入,`entry_media` 无新行;画廊正常显示;进入任何 entry 详情都看不到它

**Codex 第八轮新增**(上传信任边界):

59. **客户端伪造 contentHash 不能伪冒拥有**(finding #1 关键):
    - 现有 ready mediaX 内容 hash = H_real(只有真实文件持有者能算出)
    - 攻击者 editor2(无 mediaX 访问历史)POST upload,multipart 带 `filename=evil.jpg` + 任意字节内容(其真实 hash ≠ H_real)
    - **当前 spec 接受**:无 `contentHash` 字段;服务端必收字节流式 hash;不会去查 H_real → 无 dedupe 副作用、无 `entry_media` 行被插入
    - 即便攻击者凑出了真碰撞文件 → 等同于"持有该字节",dedupe 合法
60. **不上传字节仅声明哈希被拒**(finding #1):构造 multipart 请求只有 `clientUploadId`/`babyId` 但 file part 为空 → 400 "missing file"
61. **服务端 hash 与 client 声明 hash 概念分离**:multipart 即便混入 `contentHash` 字段也会被忽略(见 §6.2 step 1 ownership-style 字段列表);抓 DB 中 `media.contentHash` 验证 = sha256(磁盘 original 文件)
62. **MIME 嗅探拒 SVG**(finding #2):上传一个真 SVG(含 `<script>`)claim 任意 mimeType → file-type 嗅探 → `image/svg+xml` 不在白名单 → 422,无 DB 行(或 row 标 failed),无 staging 残留
63. **MIME 嗅探拒 HTML 伪装图片**:上传 `<html><script>alert(1)</script></html>` 字节但声明 `mimeType=image/jpeg` + `filename=evil.jpg` → file-type 嗅探得 `text/html` → 422
64. **MIME 嗅探拒可疑扩展名**:上传真 JPEG 但 filename=`evil.html` → 后处理 sanitize filename + 派生扩展从嗅探 → 最终落盘 `original.jpg` + `media.mimeType='image/jpeg'`;后续 Content-Disposition 也用 sanitized filename
65. **响应头 nosniff + sandbox + sniffed Content-Type**(finding #2):
    - 上传一张合法 JPEG → `GET /api/media/X?size=original`
    - 断言响应头存在:`X-Content-Type-Options: nosniff`、`Content-Security-Policy: default-src 'none'; sandbox`、`Content-Disposition: attachment; filename=...`、`Content-Type: image/jpeg`(从 DB 嗅探结果)
    - 同一 media `?size=thumb` → `Content-Disposition: inline; ...`(画廊渲染需要)
66. **Attach 端点独立、拒 contentHash**(finding #1 / §6.2.1):
    - editor 在两个 entry A、B 间想共享 mediaX(不重传字节)→ `POST /api/entries/B/media/X/attach` → 200
    - 同一请求若 body 含 `contentHash` 字段 → 被忽略(服务端不读)
    - editor 对**别人家庭**的 entryC 调 attach → entry loader 404
    - editor 对**别人宝宝**的 entryD 调 attach(媒体 babyId ≠ entry babyId)→ 404
    - editor 对 trashed media 调 attach → media loader 联合状态闸门 → 404
67. **Attach 幂等**:同一 attach 调两次 → 第二次 `alreadyExisted: true`、`entry_media` 仍 1 行
68. **Detach 端点**:`DELETE /api/entries/A/media/X/attach` → `entry_media` 行没了、media 本体不动、画廊仍可见
69. **流式上传超限**:在上传中途累计字节超 `maxPhotoBytes` → 中止连接、删 staging、`status='failed'`、返回 413(防止攻击者用大文件耗尽磁盘)

**Codex 第九轮新增**(schema/flow 对账 + per-variant 输出):

70. **Pending row 可插入**(finding #1 反例):用 better-sqlite3 真实 schema + `PRAGMA foreign_keys=ON` + status-aware CHECK 启用,执行 §6.2 step 3 的 `INSERT (id, status='pending', babyId, clientUploadId, uploadedBy, filename, createdAt)` → 成功(派生字段 NULL 被 CHECK 放行)
71. **Ready row 缺字段被 CHECK 拒**(status-aware CHECK 反向验证):直接 SQL `INSERT (id, status='ready', babyId, uploadedBy, filename, createdAt)`(派生字段全 NULL)→ `SQLITE_CONSTRAINT_CHECK` 抛错,行未插入
72. **Failed/trashed/purged row 字段完整性矩阵**:
    - failed 阶段允许 NULL(因为可能在 step 3 嗅探失败时就停)→ INSERT 成功
    - 由 ready → trashed 转移:派生字段保留(只动 `status` + `deletedAt` + `deletedBy`)→ CHECK 通过
    - 由 ready → purged 转移:派生字段保留(审计需要)+ 文件被物理删除 → DB CHECK 通过、磁盘 `data/media/<babyId>/.../original.*` 不存在
73. **Per-variant Content-Type — JPEG 原图**(finding #2 核心):上传 1×1 JPEG → 服务端嗅探 `image/jpeg`,Sharp 派生 `large.webp` / `thumb.webp`
    - `GET /api/media/X?size=original` → `Content-Type: image/jpeg`、字节是 JPEG 头
    - `GET /api/media/X?size=large` → `Content-Type: image/webp`、字节是 WebP 头
    - `GET /api/media/X?size=thumb` → `Content-Type: image/webp`、字节是 WebP 头
    - 所有三个响应都有 `X-Content-Type-Options: nosniff`
74. **Per-variant Content-Type — HEIC 原图**:上传 HEIC → DB `mimeType='image/heic'`、Sharp 派生 WebP
    - `?size=original` → `image/heic`;`?size=thumb` → `image/webp`
    - 验证 macOS Safari 不会因 nosniff + 错误 MIME 拒绝渲染缩略图
75. **Per-variant Content-Type — MP4 视频**:上传 MP4 → DB `mimeType='video/mp4'`、ffmpeg 抓 `poster.webp`
    - `?size=original` → `video/mp4`、支持 Range
    - `?size=poster` → `image/webp`
    - `?size=thumb`(视频别名)→ `image/webp`(等同 poster)
    - `?size=large`(视频别名)→ `image/webp`(等同 poster)
76. **Per-variant 非法组合 — 图片请求 poster**:`GET /api/media/<photoId>?size=poster` → 400(无此变体)
77. **缓存键隔离**:对同一 mediaId 连续请求 `?size=original` 和 `?size=thumb` → 客户端缓存(Cache-Control: immutable)按完整 URL key,两份缓存互不污染

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
| **Sanitize SQL 误删挂在 trashed entry 上的 ready media** | §10.4 Stage A2 仅 `DELETE FROM entry_media WHERE entryId IN <将删 entry>`(N:M 模型下断关联不动媒体);媒体本体仅在父 baby trashed 时随 Stage B 走;E2E 用例 #46 |
| **entryId loader SQL 引用 entries 中不存在的列** | §6.2 step 2.4 & §5.5.1 表统一:entry loader 仅 SELECT `id, babyId, status, authorId`,跨家庭由跨宝宝隐含 |
| **Sanitize SQL 顺序违反 FK 约束(在 trashed baby 有 ready media 时备份失败)** | §10.4 step 4 重排:先删 trashed baby 下的子,再删自身非干净的子,最后删父 babies;E2E 用例 #47 |
| **媒体直链下载越过软删 baby**(已外泄 URL 仍可访问 trashed baby 的照片) | §6.3 `loadMediaForRead` 改为 JOIN babies + 联合状态闸门;§6.3.1 所有 media route loader 同款统一;§6A.4 引入 16 项父链强制清单 + 自定义 ESLint rule 拦截;E2E 用例 #48-51 |
| **Sanitize SQL 漏切 entries 的 inbound FK(entry_milestones / 旧 media.entryId)→ 普通 trashed entry 备份失败** | §10.4 step 4 改为按 **inbound FK 拓扑分 Stage A/B/C** 删除,删每张表前先扫所有引用它的 FK 列;E2E 用例 #52 |
| **Dedupe 命中 ready 后丢失 entryId attachment 意图(`media.entryId` 单字段限制)** | §3 schema 改为 N:M:新增 `entry_media` join table,删 `media.entryId` 字段;§6.2 dedupe 分支加 `INSERT OR IGNORE INTO entry_media`(幂等 attach);§6A.3 硬删时级联清理 entry_media;一张照片可同时挂多个 entry;E2E 用例 #53-58 |
| **客户端声明的 contentHash 被当成"持有该文件的证据"→ Dedupe 攻击 oracle / 跨权限挂载** | §6.2 完全删除客户端 `contentHash` 字段,服务端必须流式收字节后自己 hash;dedupe 分支移到 step 4(服务端 hash 完成后);"已有 mediaId 挂 entry"独立成 §6.2.1 `POST /api/entries/[entryId]/media/[mediaId]/attach`,要求 `media:read + entry:write` 双 loader;E2E 用例 #59-61, #66-68 |
| **客户端声明的 mimeType 被原样存 + 服务输出 → XSS / 内容混淆**(SVG 含 script、HTML 伪装图片) | §6.2 step 3 加 file-type magic-byte 嗅探 + Sharp/ffprobe 二次确认 + 严格白名单(SVG/HTML/JS 一律 422);`media.mimeType` 存服务端嗅探结果;§6.3 输出 `Content-Type` 从 DB sniffed 字段;响应头加 `X-Content-Type-Options: nosniff` + `Content-Security-Policy: default-src 'none'; sandbox` + `original` 下载强制 `Content-Disposition: attachment`;扩展名也从嗅探派生;E2E 用例 #62-65 |
| **媒体 schema NOT NULL 派生字段与两阶段上传冲突(pending row 插不进)** | §3 schema 把 `type/mimeType/sizeBytes/contentHash/relativePath/width/height/durationSec` 改为 NULLABLE;加 status-aware `CHECK`:ready/trashed/purged 必须字段齐;§6.2 step 3 显式说明 INSERT 时派生字段留 NULL;step 6 commit 时一次性写齐;E2E 用例 #70-72 |
| **派生 WebP 缩略图被以原图 MIME 返回 → 浏览器拒渲染 + 缓存污染** | §6.3 输出契约改为 **per-variant Content-Type 表**:`original` 用 DB `mimeType`,`thumb/large/poster` 硬编码 `image/webp`;视频 `?size=thumb\|large` 自动等价 poster;图片请求 poster → 400;E2E 用例 #73-77 |

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

### 15.7 第六轮(2026-05-15)— 已修复

| 发现 | 严重度 | 修复位置 |
|---|---|---|
| Sanitize SQL 顺序违反 FK 约束(trashed baby 有 ready media 时备份失败) | high | §10.4 step 4 重排:先切子(trashed baby 下的子)→ 删自身非干净的子 → NULL 化 entry 引用 → 删父 baby → 清孤儿权限;E2E 用例 #47 |
| 媒体直链下载越过软删 baby(父链可见性原则在 §6.3 没落地) | high | §6.3 `loadMediaForRead` JOIN babies + 联合状态闸门;§6.3.1 所有 media route loader 接受状态组合表;§6A.4 16 项父链强制检查清单 + ESLint rule 拦截裸查询;E2E 用例 #48-51 |

**元教训沉淀**:
- **抽象原则必须降阶为机械清单**:"父链可见性"作为原则不够,要逐项列出**所有对外出口** + 每个出口对应的 SQL/loader 必须 join 父表。不依赖记忆、不依赖纪律,靠清单 + ESLint rule 强制
- **FK 约束顺序敏感**:任何对多张关联表的批量 DELETE 必须按依赖方向排序(先子后父);用 `PRAGMA foreign_keys=ON` 的测试环境验证

### 15.8 第七轮(2026-05-15)— 已修复

| 发现 | 严重度 | 修复位置 |
|---|---|---|
| Sanitize 仍漏 entries 的 inbound FK(entry_milestones / 旧 media.entryId 引用未先切就删 entries → 普通 trashed entry 备份失败) | high | §10.4 step 4 按 inbound FK 拓扑重写为 Stage A/B/C:删任一表前先 DELETE/UPDATE 其所有 inbound 引用;明确"删表 T 前先扫整个 schema 找所有引用 T 的 FK 列"为永久原则;E2E 用例 #52 |
| Dedupe 命中 ready 后丢失 entryId attachment 意图(单字段 `media.entryId` 无法表达"同一文件挂多个 entry") | medium | **数据模型变更**:§3 schema 删 `media.entryId`,新增 `entry_media` join table 表达 N:M;§6.2 dedupe ready 命中后 `INSERT OR IGNORE INTO entry_media` 实现幂等 attach;§6A.3 硬删 entry/media 时级联清理 entry_media;§6A.4 父链清单加入 entry detail 的 entry_media JOIN;E2E 用例 #53-58 |

**元教训沉淀**:
- **inbound FK 全扫**:任何要删的表 T,删除前必须扫整个 schema 找出所有 `FK → T.id` 的列,事先 DELETE / UPDATE 它们;这是"先切子后删父"原则的完整版,不只看 outbound 而要看 inbound
- **单字段表达 N:M 是 spec 级别错误**:任何"客户端可能同时引用资源 A 和 B 的同一份"的语义,必须用 join table。当出现"dedupe + 不同 target"的冲突时,根因往往是 schema 强制了 1:1
- **大改 schema 趁早**:N:M 改造在 spec 阶段是改几行 SQL,实施后再改是噩梦;Codex review 把"语义 vs 实现冲突"早暴露出来,值回票价

### 15.9 第八轮(2026-05-16)— 已修复

| 发现 | 严重度 | 修复位置 |
|---|---|---|
| Ready dedupe 信任客户端声明的 `contentHash`(攻击 oracle:可探测哈希存在、跨权限把不属于自己的 media 挂到自己的 entry) | high | §6.2 完全移除客户端 `contentHash` 字段、dedupe 改为服务端流式 hash 完成**之后**才执行(step 4);新增 §6.2.1 `POST /api/entries/[entryId]/media/[mediaId]/attach` 独立端点处理"已有 mediaId 挂载到 entry"语义,要求 `media:read + entry:write` 双 loader,完全不接受哈希;E2E 用例 #59-61, #66-68 |
| 上传接受客户端声明的 `mimeType` 原样存,服务输出时 `Content-Type` 也用同一字段(SVG/HTML 伪装图片 → XSS / 内容混淆) | high | §6.2 step 3 加 file-type magic-byte 嗅探 + Sharp/ffprobe 二次确认 + 硬编码白名单(SVG/HTML/JS 一律 422);扩展名从嗅探派生;`media.mimeType` 存服务端结果;§6.3 输出头加 `X-Content-Type-Options: nosniff` + `Content-Security-Policy: default-src 'none'; sandbox` + `size=original` 强制 `Content-Disposition: attachment`;E2E 用例 #62-65 |
| 残留 `media.entryId` 引用(N:M 改造后 §6.2 loader 文字、§6A.5 软删 entry、E2E 用例 #40/#41/#46 还在写老字段) | medium | 全部改为对 `entry_media` 行的操作:§6.2 step 2.4 末尾改"写入 `entry_media.entryId`";§6A.5 改"`entry_media` 行不删除,仅 entry hard purge 时级联";E2E #40/#41/#46 改断言 join 表行而非 media 列 |

**元教训沉淀**:
- **客户端声明的哈希不是 capability,不是 authorization token**:任何"承认你拥有这份字节"的副作用(dedupe 命中、attach、200 with mediaId)必须等服务端自己流式 hash 之后才允许发出。哈希在客户端只能用作"我猜这是同一个"的提示,在服务端只能作为**已收字节后**的查表键
- **MIME 嗅探 + 白名单 + nosniff + sandbox 是四件套**,缺一不可。任何一个绕过都可能让浏览器执行存储型 XSS:
  - 嗅探:阻断 SVG/HTML 伪装图片
  - 白名单:正向圈定,而非黑名单
  - `nosniff`:阻断浏览器嗅探兜底
  - `sandbox`/`Content-Disposition: attachment`:即便前三层失误也不让 JS 在主域执行
- **上传与挂载是两个语义**:`upload`(送字节)和 `attach`(声明引用)合并到同一个端点必然产生"用客户端字段做权威"的诱惑。拆开后,attach 端点只能用 mediaId 作 target field,与所有其他 target field 走相同的 loader 模板,概念清晰、可审计
- **"渐进改稿"必须收尾验证(第 3 次出现同类问题)**:第五轮、第七轮、第八轮都暴露过同一模式的残留引用。决定永久原则:**任何数据模型变更必须在提交前做全文 grep**(`grep -n "media\.entryId" spec.md`),且这个 grep 命令本身写进 §10.4 的"Spec 提交前 checklist"

### 15.10 第九轮(2026-05-16)— 已修复

| 发现 | 严重度 | 修复位置 |
|---|---|---|
| `media` schema 派生字段(`type/mimeType/sizeBytes/contentHash/relativePath`)NOT NULL,但 §6.2 两阶段上传在 step 3 就 INSERT pending row(派生字段尚未生成)→ 第一次 INSERT 即 NOT NULL violation,整个上传流程跑不起来 | high | §3 schema 派生字段改 NULLABLE + status-aware `CHECK(status IN pending/processing/failed OR <派生字段全非空>)`;§6.2 step 3 显式声明 INSERT 时派生字段留 NULL;step 6 commit 时一次性写齐;E2E 用例 #70-72 |
| §6.3 规定 `Content-Type` 单读 `media.mimeType`,但 §6.2 step 5 用 Sharp 派生 WebP 缩略图 → JPEG 原图的 `?size=thumb` 会返回 WebP 字节配 `image/jpeg` 头 + nosniff → 浏览器拒渲染、缓存被污染 | high | §6.3 输出契约改为 **per-variant 表**:`original` 用 DB `mimeType`,`thumb/large/poster` 硬编码 `image/webp`;视频 thumb/large 自动等价 poster;图片请求 poster → 400;E2E 用例 #73-77 |

**元教训沉淀**:
- **Schema 与 flow 必须双向对账,不只是字段名**:每加一个 status 值或改一个写入路径,都要列出该路径在 INSERT/UPDATE 时填的字段集合,与 schema 的 NOT NULL/CHECK 约束对账。`grep` 不够,要把 "INSERT (字段集合) for status X" 列成表,逐项核对。永久原则:**spec 内任何 status 状态机必须配一张"该状态下必填字段表"**
- **派生资源是独立资源,输出契约必须 per-variant**:`media` 行代表的是 `{original, large, thumb, poster}` 一组字节,不是一份字节。任何"单值"的输出契约(Content-Type、Cache-Control、Content-Disposition)必须先问"这值在派生间是否相同"。若不同,就必须用表格列出来,而不是写一个"`Content-Type` 从 DB 读"的笼统规则
- **CHECK 约束是免费的不变量**:SQLite CHECK 约束几乎无开销,能把"业务逻辑保证的不变量"提升到 DB 层强制。每次发现"业务上某状态必须有某字段"时,优先用 CHECK,不要靠应用层纪律

### 15.11 第十轮(2026-05-16)— P1 plan 复查,已修复

> 第十轮评审目标是 P1 permissions plan 文档,但暴露的根因在 SPEC,因此同步在此沉淀。

| 发现 | 严重度 | 修复位置 |
|---|---|---|
| `baby_member_permissions` 覆盖语义被实现成"早 return 即授权",非 owner 持 `canDelete=1` 可意外解锁 `*:purge` / `baby:trash/restore/purge` 等 owner-only action(spec §5.3 原文"覆盖 default role"措辞歧义) | **critical** | §5.3 重写为"范围闸门 vs 授权机制"二分:override 只能收窄/维持,不能扩大;owner-only action 无视 override;P1 plan Task 8 改 assert.ts 去掉早 return + Task 9 增 canDelete-不能解锁-purge 的回归用例 |
| ESLint `api-route-must-assert` 规则用 substring 文本检索 (`includes('withAuthorizedResource')`) → 注释 / unused import / unrelated helper 均可绕过,CI 主防线被空心化 | high | P1 plan Task 16 重写为真 AST 规则:对每个 HTTP method 导出节点检查其初始化器/body 内**实际存在** `withAuthorizedResource(...)` 调用或 `await assertPermission(...)` 调用;加 3 个负向 fixture(注释装样、unused import、unrelated helper) |
| P1 plan Task 3 bootstrap 按 SPEC §3 概念模型(单 `users.passwordHash`)写,与 P0 实施的 better-auth 4 表布局冲突(`users` 无 passwordHash 字段、密码在 `accounts.password`),照搬会 typecheck 挂 + 密码重置失效 | high | SPEC §3.2 新增"物理布局 vs 概念模型"小节明确 better-auth 4 表事实;P1 plan Task 3 改为同事务双写 `users`(身份)+ `accounts.password`(凭据);新增 acceptance 用例"改 config → bootstrap → 用新密码 sign-in 成功" |

**元教训沉淀**:
- **"覆盖"不是"授权"——可选规则的语义动词必须精确**:`baby_member_permissions` 这种 "细粒度规则" 文档必须明确动词是 *gate*(闸门:决定是否允许) vs *grant*(授予:决定能做什么)。混用导致实现者读成"override 命中即放行"。永久原则:**spec 描述每个可选规则时必须显式声明它是 narrowing 还是 widening**,默认 narrowing
- **CI 规则用文本检索是反模式**:任何"静态防线"必须走 AST(或类型系统),substring 检测的判断面无限大、抗噪能力为零。永久原则:**lint rule 一律 AST 实现 + 负向 fixture 套**
- **Spec ↔ Impl ↔ Plan 三方对账**:写新 plan 前必须 grep 当前真实 schema/接口,不能只读 spec。SPEC 是"应当如此",P0 实施可能已经偏离;P1 plan 若只对 SPEC 写,会与 impl 撕裂。永久原则:**plan 落笔前先 `grep -rn <关键 schema 字段> lib/` 对账真实状态**,并在 plan 头部声明"基于 P0 实施层 X 假设"

---

## 16. 下一步

本设计经用户确认后,进入 `writing-plans` 阶段,产出可执行的实施计划(按模块/阶段拆解)。
