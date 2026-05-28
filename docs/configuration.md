# 配置

BabyLoom 在启动时读取 `data/config.yaml`。本文档描述每个字段的语义、默认值和修改影响。

- **示例**：[`config.yaml.example`](../config.yaml.example)
- **校验源**：[`lib/server/config/schema.ts`](../lib/server/config/schema.ts)

## 文件位置

默认从 `<数据目录>/config.yaml` 读取。数据目录由环境变量 `BABYLOOM_DATA_DIR` 决定，未设置时为项目根的 `data/`。

容器部署中，`docker-compose.yml` 把宿主机 `./data` 挂载到 `/app/data`（见 [deployment.md](./deployment.md)）。

建议：

```bash
chmod 600 data/config.yaml
```

避免同主机其它用户读取 secret。

## 字段

### `owner.*`

| 字段 | 必填 | 约束 | 修改后影响 |
|---|---|---|---|
| `owner.username` | 是 | 字母、数字、下划线、短横线 | **重启**后写回 `user` 表 |
| `owner.password` | 是 | ≥ 6 位 | **重启**后重置 owner 密码（这是 owner 改密码的唯一方式） |
| `owner.nickname` | 是 | 任意字符串 | **重启**后写回 |

> owner 凭据不能在 UI 改，只能改 yaml + 重启。详见 [database.md](./database.md#配置文件-vs-数据库)。

### `family.name`

家庭名称，启动时写入 `families` 表。修改 yaml 重启后生效。

### `app.*`

| 字段 | 必填 | 默认 / 约束 | 说明 |
|---|---|---|---|
| `app.baseUrl` | 是 | 完整 URL | 对外访问地址，better-auth 用它构造 cookie domain / redirect。**不能用 `localhost`** 部署到 NAS，否则其它设备登录会失败 |
| `app.secret` | 是 | ≥ 32 字符随机串 | 会话与签名密钥；泄漏需立即更换 |
| `app.timezone` | 否 | `Asia/Shanghai` | IANA 时区；影响日历、按日期分组等展示 |

### `log.*`

| 字段 | 默认 | 取值 |
|---|---|---|
| `log.level` | `info` | `debug` / `info` / `warn` / `error` |

日志文件位于 `<数据目录>/logs/app-YYYY-MM-DD.log`，按天滚动。

### `media.*`

| 字段 | 默认 | 说明 |
|---|---|---|
| `media.maxPhotoBytes` | `50000000`（50 MB） | 单张图片上传上限 |
| `media.maxVideoBytes` | `500000000`（500 MB） | 单个视频上传上限 |

超过上限的上传会被拒绝。上限只在服务端校验。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `BABYLOOM_DATA_DIR` | 项目根 `data/` | 数据目录（包含 `config.yaml`、`db/`、`media/`、`logs/`） |
| `NODE_ENV` | 由 Next.js 决定 | 标准 Next.js 行为 |
| `PORT` | `3000` | Next.js 监听端口 |

## 安全清单

- [ ] `app.secret` 至少 32 个随机字符（生成示例：`openssl rand -hex 32`）
- [ ] `owner.password` 改为强密码
- [ ] `app.baseUrl` 是其它设备实际能访问的地址，不是 `localhost`
- [ ] `chmod 600 data/config.yaml`
- [ ] 反向代理终止 HTTPS（见 [deployment.md](./deployment.md)）

## 修改后的生效方式

| 修改 | 生效方式 |
|---|---|
| owner.* / family.name | 重启进程 |
| app.* / log.* / media.* | 重启进程 |

容器部署可直接 `pnpm docker:up` 重新拉起，或 `docker compose restart`。
