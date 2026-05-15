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
  contentHash: text NOT NULL,   // sha256(原文件),幂等键 + 重复检测
  status: text NOT NULL,        // 'pending' | 'processing' | 'ready' | 'failed' | 'deleted'
                                // 仅 ready 的对外可见;非 ready 由 reconcile job 清理
  takenAt: integer,             // 从 EXIF,fallback createdAt
  createdAt: integer NOT NULL,
  deletedAt: integer,           // soft delete 时间戳
  deletedBy: text FK,           // 删除者 userId
  // UNIQUE(babyId, contentHash) — 同一宝宝下同一文件不重复入库
}

// 会话(better-auth 自动管理)
sessions { id, userId, expiresAt, ipAddress, userAgent, ... }
```

**索引**:
- `entries`: `(babyId, occurredAt DESC)` 用于时间线
- `media`: `(babyId, takenAt DESC)` 用于画廊
- `media`: `(babyId, contentHash)` UNIQUE,幂等去重
- `media`: `(status)` 用于 reconcile job 扫描
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
// 完整 Action 集合 —— 任何新增受保护资源必须先加到这里
type Action =
  | 'baby:read'   | 'baby:write'   | 'baby:delete'
  | 'entry:read'  | 'entry:write'  | 'entry:delete'
  | 'media:read'  | 'media:write'  | 'media:delete'   // ← 媒体一等公民
  | 'member:manage'
  | 'family:manage'
  | 'milestone:manage'
  | 'system:logs'
  | 'system:backup';

interface PermissionResource {
  babyId?: string;
  entryId?: string;
  mediaId?: string;
  targetUserId?: string;  // member:manage 时的被操作者
}

async function assertPermission(
  userId: string,
  action: Action,
  resource?: PermissionResource
): Promise<void> {
  // 1. 查 user 在 family 的 role
  // 2. 若 action 涉及 babyId,查 baby_member_permissions 覆盖
  // 3. 所有权规则(见下方矩阵):
  //    - entry:write|delete  → 非 owner 时,authorId 必须 === userId
  //    - media:delete        → 非 owner 时,uploadedBy 必须 === userId
  // 4. 不通过 → throw ForbiddenError(被统一异常处理转 403)
  // 5. 记 warn 日志(action, userId, resource, reason)
}
```

**所有权规则矩阵**(细化原 5.2):

| 资源 | viewer | editor | owner |
|---|---|---|---|
| `entry:write` | ✗ | 仅 `authorId === userId` | 任意 |
| `entry:delete` | ✗ | 仅 `authorId === userId` | 任意 |
| `media:write` | ✗ | 允许(对有 `media:write` 权限的 babyId) | 任意 |
| `media:delete` | ✗ | 仅 `uploadedBy === userId` | 任意 |
| `media:read` | 允许(有 `baby:read` 即可) | 同左 | 任意 |

### 5.5 调用约定(关键 — 不只 server action)

**所有受保护入口必须显式调用 `assertPermission`**,Codex review 指出"server action 走 wrapper、API route 漏检"是真实风险点,固化如下规则:

- **Server Actions**:用高阶函数 `withPermission(action, resolveResource)(handler)` 包裹,handler 内可直接使用受信任的 `userId`
- **API Routes**(`app/api/*/route.ts`):**必须**在 handler 起手调 `await assertPermission(userId, action, resource)`,且 lint 规则强制(自定义 ESLint rule `babyloom/api-route-must-assert`,扫描 `export async function (GET|POST|PUT|DELETE)` 内是否含 `assertPermission` 调用)
- **统一异常处理**:在 `app/(family)/layout.tsx` 和每个 `route.ts` 都包一层 `try/catch` 把 `ForbiddenError` 转成 403 + 日志
- **测试硬性要求**(见 §11.3):每个媒体 API endpoint 必须有"跨宝宝 viewer / 跨作者 editor 删除"的拒绝用例,否则视为该 endpoint 未完成

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
- **删除宝宝** = soft delete + 后台 job 清理 `data/media/<babyId>/`(避免误删,delay 7 天)
- **`_staging/`** 必须与 babyId 目录在同一文件系统挂载点 → 保证 `rename(2)` 原子

### 6.2 上传流程(两阶段、原子、幂等)

**设计原则**:
- DB 是真相源,文件系统是衍生品
- 任何步骤失败后,reconcile job 总能根据 `media.status` 清理孤儿
- 客户端可安全重试,服务端按 `contentHash` 去重

**流程**:

1. **客户端**:计算 `contentHash = sha256(file)` → `POST /api/media/upload` multipart:
   - `babyId`, `contentHash`, `filename`, `mimeType`, `sizeBytes`,文件二进制
   - 可选 `clientUploadId`(客户端生成的幂等 token,网络重试时透传)

2. **服务端 — 准入**(在 staging 任何 IO 前):
   - `assertPermission(userId, 'media:write', { babyId })` — 失败立即 403
   - 查询 `media` 表 `(babyId, contentHash)`:命中已存在记录 → 直接返回该 `mediaId`(幂等,**不重新落盘**)

3. **服务端 — Stage**:
   - 在**事务内** insert media 行 `(id=uuid, status='pending', contentHash, uploadedBy, ...)`,违反 UNIQUE 约束则降级为"已存在"分支返回
   - 流式写入 `data/media/_staging/<uploadId>/original.<ext>`,边写边算 sha256
   - 写完后**校验 hash 与请求声明一致** — 不一致删 staging 目录、把 media 行更新为 `'failed'` 并 4xx 返回

4. **服务端 — Process**(在 staging 内):
   - 更新 `media.status = 'processing'`
   - Sharp 并行生成 large/thumb;视频用 `ffmpeg-static` 抓 poster;提取 EXIF → `takenAt`
   - 任一步失败 → 删除整个 `_staging/<uploadId>/` → 更新 `media.status = 'failed'` → 抛错

5. **服务端 — Commit(原子移动)**:
   - 确保目标目录 `data/media/<babyId>/<year>/<month>/{original,large,thumb,poster}/` 存在
   - 用 `fs.rename` 把 staging 文件移到最终位置(同文件系统下是原子操作)
   - **事务内**更新 `media.status = 'ready'`、`relativePath`、`width/height/durationSec/takenAt`
   - 若提供 `entryId`,同事务内 update `media.entryId`

6. **失败恢复 / Reconcile Job**(应用启动 + 每天一次):
   - 扫描 `status IN ('pending','processing')` 且 `createdAt < now - 1h` 的 media 行
   - 删除对应 staging 目录(若存在)
   - 把状态标为 `'failed'`(保留行用于审计)
   - 扫描 `_staging/` 下没有对应 DB 行的目录 → 删除

7. **对外可见性**:所有查询(timeline / gallery / `GET /api/media/[id]`)默认 `WHERE status = 'ready'`,非 ready 的行对用户不可见

### 6.3 输出流程

`GET /api/media/[id]?size=thumb|large|original`:

1. **必须**起手调 `assertPermission(userId, 'media:read', { mediaId, babyId })`(API route lint 强制)
2. 查 `media` 表:`status !== 'ready'` → 404
3. 从 `relativePath` + `type` 拼绝对路径
4. 流式输出:
   - `Cache-Control: private, max-age=31536000, immutable`
   - `Content-Type` 从 mime
   - 支持 `Range` 请求(视频拖动)

### 6.4 删除流程

`DELETE /api/media/[id]`:

1. `assertPermission(userId, 'media:delete', { mediaId, babyId, uploadedBy })`
   — editor 角色时该函数内部校验 `uploadedBy === userId`
2. 事务内:`media.status = 'deleted'` + 记 `deletedAt` + `deletedBy`
3. **不立即删文件**,由 reconcile job delay 7 天后清理(允许"撤销删除")

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

### 10.4 备份(一致性快照)

**关键风险**:直接 zip 运行中的 `babyloom.db` 会拿到损坏快照(WAL 未合并、读写中);DB 行已写但 media 文件未 commit 时打包会丢文件 → 必须用一致性方案。

**SQLite 启停态**:启用 WAL 模式(`PRAGMA journal_mode=WAL`)。WAL 给读者快照隔离,允许在线备份。

**备份流程**(Owner 在 `/profile/data` 点"导出全部"触发):

1. **进入备份模式**:设置全局 `BACKUP_IN_PROGRESS` 标志
   - 所有**新上传**返回 503 + Retry-After(短暂拒绝,5-30 秒,家用场景可接受)
   - **进行中的上传**等待其完成(最多 30 秒,超时强杀并清 staging)
   - 读流量(timeline / 媒体输出)不受影响
2. **DB 快照**:调用 `better-sqlite3` 的 `db.backup(targetPath)`(底层是 SQLite Online Backup API,锁页拷贝,与并发读兼容,写入会被自然串行化)
3. **WAL Checkpoint**:`PRAGMA wal_checkpoint(TRUNCATE)` 把 WAL 合并进主库,确保备份完整自包含
4. **冻结媒体清单**:对快照库执行 `SELECT id, relativePath, contentHash, sizeBytes FROM media WHERE status = 'ready'` → 写 `manifest.json`,字段:
   - `version`、`createdAt`、`appVersion`、`dbSha256`
   - `media[]: { id, path, contentHash, sizeBytes }`(实际进归档的文件列表)
5. **流式打包 zip**:`babyloom.db`(快照副本)+ `manifest.json` + `media/` 目录(只打包 manifest 列出的文件,跳过 staging、failed、deleted)
6. **校验**:边打包边计算 zip 整体 sha256 → 写入 zip 注释 + 单独 `babyloom-backup-<ts>.sha256` 文件
7. **解除备份模式**,标志清除
8. **响应**:zip 流式下载,文件名 `babyloom-backup-<YYYY-MM-DD-HHMM>.zip`

**还原流程**(后续迭代,先把"导出可还原"作为设计前提):
1. 上传 zip → 校验整体 sha256
2. 校验 `manifest.dbSha256` 与 zip 内 db 一致
3. 校验每个 media 文件的 sha256 与 manifest 一致
4. 任何不一致 → 拒绝还原并报告差异
5. 通过后停服 → 替换 `babyloom.db` + `media/` → 启动 → reconcile job 自检

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
- **备份 manifest**:正确反映 `status='ready'` 的子集、sha256 计算稳定

### 11.2 组件 (Vitest + RTL)

- 每个 UI 组件 1-2 个核心用例(渲染 + 主要交互)
- 业务组件覆盖关键状态(loading / empty / error)

### 11.3 E2E (Playwright)

**核心正向流程**:
1. **首次部署**:挂载 config.yaml → 启动 → 登录 → 添加宝宝 → 进入时光
2. **创建记录**:登录 → 新建 entry → 上传 1 张照片 → 选 2 个里程碑 → 保存 → 时光线可见
3. **成员协作**:owner 创建 editor 成员 → 切登录 → editor 创建一条记录 → 切回 owner → 看见 editor 的记录

**安全 / 权限拒绝用例**(必须全部存在,缺一个视为该 endpoint 未完成):

4. **跨宝宝媒体拒绝**:配置两个宝宝 A、B;给 viewer 用户单独配置 `baby_member_permissions` 只能看 A → viewer `GET /api/media/<B 的 mediaId>` 返回 403,且**响应体不泄露资源是否存在**(统一 403,不区分"无权"和"不存在")
5. **跨作者媒体删除拒绝**:editor1 上传 mediaX → editor2 调用 `DELETE /api/media/<X>` 返回 403 → mediaX 仍 `status = 'ready'`
6. **viewer 写入拒绝**:viewer 调用 `POST /api/media/upload` 返回 403
7. **未认证拒绝**:无 cookie 直接 `GET /api/media/<id>` 返回 401
8. **直接路径遍历拒绝**:`GET /api/media/../../config.yaml` 等异常 mediaId 一律 404,不暴露文件系统
9. **配置文件改 owner 密码生效**:重写 config.yaml + 重启容器 → 旧密码登录失败、新密码成功
10. **上传幂等**:同一文件(同 contentHash)上传两次 → 只一条 `ready` 记录、磁盘只一份原图

**故障注入用例**(可用 mock 实现,不必真实崩 ffmpeg):

11. **Sharp 失败 → 无孤儿**:mock Sharp 抛错 → staging 被清空、media 行 `status = 'failed'`、目标目录无文件
12. **进程中途崩 → reconcile 清理**:手动建一条 `status='processing'` + 1h 前的脏行 + 一个 staging 目录 → 触发 reconcile → 行变 `failed`、目录被删
13. **备份一致性**:并发上传中点击备份 → 上传被短暂拒绝(503)→ 备份完成 → zip 内 manifest 与文件一一对应、sha256 校验通过

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
| 媒体 API Route 漏写 `assertPermission` | 自定义 ESLint rule `babyloom/api-route-must-assert` 在 CI 拦截;E2E 测试覆盖跨权限拒绝 |
| 上传过程崩溃产生孤儿文件/脏行 | 两阶段上传 + staging 隔离 + `status` 状态机 + reconcile job 兜底 |
| 备份取到不一致快照(并发上传期间) | SQLite Online Backup API + 短暂上传冻结 + manifest 校验 + 还原前 sha256 验证 |
| WAL 模式下意外丢失未 checkpoint 的写入 | 启动启用 `journal_mode=WAL` + `synchronous=NORMAL`,备份前显式 `wal_checkpoint(TRUNCATE)` |

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

## 15. Codex Adversarial Review 回应

本 spec 在 2026-05-15 经 Codex 评审,verdict 为 `needs-attention`,三个 high/medium 级发现已逐项修复:

| 发现 | 严重度 | 修复位置 |
|---|---|---|
| 媒体授权链条不完整(无 `media:*` Action、API Route 未强制 wrapper、`media` 缺 `uploadedBy`) | high | §3 schema、§5.4 Action 集、§5.5 调用约定、§11.3 拒绝用例 |
| 上传非原子、无清理无重试语义 | high | §6.1 staging 目录、§6.2 两阶段流程、§3 `status`/`contentHash`、§11 reconcile 测试 |
| 备份可产生不一致快照 | medium | §10.4 SQLite Online Backup + 暂停窗口 + manifest、§14 PRAGMA WAL |

---

## 16. 下一步

本设计经用户确认后,进入 `writing-plans` 阶段,产出可执行的实施计划(按模块/阶段拆解)。
