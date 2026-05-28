# API

Babyloom 没有独立 API 服务。所有接口都是 Next.js Route Handlers，定义在 [`app/api/`](../app/api/) 下，与页面共享同一个进程和数据库连接。

本文档不枚举每条路由的入参和出参——源码就是事实来源。它只描述：认证模型、权限矩阵、路由分区索引、错误规范。

## 认证模型

使用 [better-auth](https://better-auth.com/)，cookie session。

- 认证端点是 better-auth 的 catch-all：[`app/api/auth/[...all]/route.ts`](../app/api/auth/)，具体子路径（如登录、登出）由 better-auth 约定
- 登录后 `Set-Cookie` 写入 session token，后续请求自动携带
- session 与凭据记录在 `session` / `account` 表（见 [database.md](./database.md)）
- 签名密钥来自 `app.secret`（[configuration.md](./configuration.md)）
- 写类操作要求在线（PWA 离线时被前端阻止）

适配代码在 [`lib/server/auth/`](../lib/server/auth/)。

## 权限模型

两层角色 × per-baby 权限：

- **owner**：从 `data/config.yaml` 写入；对所有 baby 拥有全部权限；唯一可以创建 / 重置成员账号
- **member**：由 owner 创建；对每个 baby 的权限独立配置（存在 `babyMemberPermissions`，见 [database.md](./database.md#权限字段语义)）

判定逻辑集中在 [`lib/server/permissions/`](../lib/server/permissions/)。

### 权限矩阵

| 操作 | owner | member（依赖的 per-baby 权限位） |
|---|---|---|
| 查看 baby 的时间线 / 画廊 / 日历 | ✅ | 需查看权限 |
| 创建 / 编辑 entry | ✅ | 需编辑权限 |
| 上传媒体 | ✅ | 需编辑权限 |
| 软删除 entry / media | ✅ | 需编辑权限 |
| 创建 / 编辑 / 软删除 baby | ✅ | 需管理权限 |
| 修改成员对该 baby 的权限位 | ✅ | 需管理权限 |
| 垃圾桶恢复 / 清空 | ✅ | 需对应 baby 的管理权限 |
| 创建 / 重置成员账号 | ✅ | ❌（仅 owner） |
| 数据面板 / 导出备份 / 查看日志 | ✅ | ❌（仅 owner） |

权限位字段定义见 [database.md](./database.md#权限字段语义)。

## 路由分区

每条只标用途；具体路径、方法、入参出参以源码为准。

| 分区 | 源码 | 用途 |
|---|---|---|
| `/api/auth/*` | [`app/api/auth/`](../app/api/auth/) | better-auth 登录 / 登出 / session 查询 |
| `/api/babies/*` | [`app/api/babies/`](../app/api/babies/) | 宝宝 CRUD、per-baby 权限管理、软删除 |
| `/api/entries/*` | [`app/api/entries/`](../app/api/entries/) | 记录 CRUD、按宝宝筛选、按日期/月份聚合 |
| `/api/media/*` | [`app/api/media/`](../app/api/media/) | 媒体上传、读取变体、删除；流程见 [architecture.md](./architecture.md#媒体上传) |
| `/api/milestones/*` | [`app/api/milestones/`](../app/api/milestones/) | 里程碑定义与关联 |
| `/api/family-members/*` | [`app/api/family-members/`](../app/api/family-members/) | owner 管理成员账号、重置密码 |
| `/api/trash/*` | [`app/api/trash/`](../app/api/trash/) | 垃圾桶列出 / 恢复 / 清空 |
| `/api/backup/*` | [`app/api/backup/`](../app/api/backup/) | 备份导出（仅 owner） |
| `/api/avatar/*` | [`app/api/avatar/`](../app/api/avatar/) | 头像上传与读取 |
| `/api/log/*` | [`app/api/log/`](../app/api/log/) | 日志浏览（仅 owner） |
| `/api/health` | [`app/api/health/`](../app/api/health/) | 健康检查 |

## 错误响应

服务端错误返回 JSON，`error` 是一个字符串错误码，必要时附 `detail`：

```json
{ "error": "not_found" }
{ "error": "bad_request", "detail": "..." }
```

常见 HTTP 状态码：

- `400`：入参校验失败
- `401`：未登录
- `403`：登录但无权限（owner 限定 / 缺少 per-baby 权限位）
- `404`：资源不存在或对当前用户不可见
- `409`：状态冲突（例如恢复已被物理删除的项）
- `413`：上传超过 `media.max*Bytes`
- `500`：服务端错误（详情写日志，不回传堆栈）

## 在线 / 离线

所有 `POST` / `PATCH` / `DELETE` 接口在前端会先经过 `lib/client/require-online` 拦截。离线状态下这些请求不发出，只读 `GET` 接口由 service worker 提供缓存或离线 fallback（见 [architecture.md](./architecture.md#离线策略)）。
