# 部署

BabyLoom 是一个 Next.js 单体应用 + SQLite + 本地媒体目录，没有外部依赖服务。生产部署推荐 Docker。

整体架构与运行时模型见 [architecture.md](./architecture.md)。所有运行参数来自 [`data/config.yaml`](./configuration.md)。

## 系统要求

- Node.js 22（仅本地开发需要）
- Docker 20.10+ 与 Docker Compose v2（生产部署）
- 至少 1 GB 可用内存
- 磁盘按预期照片 / 视频量预留

## 数据目录

应用所有持久化数据都在一个目录里：

```text
data/
├── config.yaml          # 配置（见 configuration.md）
├── db/babyloom.sqlite   # SQLite 数据库
├── logs/                # 按天滚动的日志
└── media/               # 上传的原始文件与变体
```

容器部署时 `docker-compose.yml` 把宿主机 `./data` 挂载到容器 `/app/data`。这个目录是**唯一**需要备份的东西。

数据目录可以由环境变量 `BABYLOOM_DATA_DIR` 改写（[configuration.md](./configuration.md#环境变量)）。

## Docker 部署

```bash
# 第一次部署
cp config.yaml.example data/config.yaml
# 编辑 data/config.yaml，至少改 owner.password 和 app.secret
chmod 600 data/config.yaml

pnpm docker:build
pnpm docker:up
pnpm docker:logs    # 跟随日志
```

`docker-compose.yml` 默认将 Nginx 监听宿主机 80 端口并代理到应用容器。配置字段说明见 [configuration.md](./configuration.md)。

## NAS / 家用服务器部署

适用于 QNAP / 群晖 / 自建小主机。

1. SSH 登录到 NAS，克隆仓库到一个稳定路径，例如 `/share/Container/babyloom`
2. 创建并编辑 `data/config.yaml`：
   - 设置 `owner.password` 为强密码
   - 设置 `app.secret` 为 ≥ 32 字符的随机串（`openssl rand -hex 32`）
   - **`app.baseUrl` 改成局域网或域名地址**（例如 `http://192.168.1.10` 或 `https://baby.example.local`）；不能保留 `localhost`，否则其它设备登录会失败
3. `chmod 600 data/config.yaml`
4. 执行 `pnpm docker:build && pnpm docker:up`
5. 浏览器访问 NAS 地址，用 owner 账号密码登录

## HTTPS / 反向代理

BabyLoom 本身不做 TLS 终止。建议把它放在反向代理后面：

- NAS 自带反向代理（QNAP / 群晖控制面板）
- 独立的 Caddy / Traefik / Nginx
- Cloudflare Tunnel（如果家宽无公网）

无论哪种，**对外用 HTTPS 的话需要把 `app.baseUrl` 改成 `https://...`**，否则 cookie 不会在 secure 上下文生效。

## 升级

```bash
# 1. 备份数据目录（强烈建议）
cp -a data data.bak-$(date +%F)

# 2. 拉新代码
git pull

# 3. 重建并重启
pnpm docker:build
pnpm docker:up
```

数据库迁移在容器启动时自动应用（见 [architecture.md](./architecture.md#启动初始化)）。

回滚：停止容器 → 用备份恢复 `data/` → 切回旧 git 版本 → 重新 `docker:up`。

## 备份

owner 在 `/profile/data` 触发导出，浏览器下载一个 zip。包含 SQLite 快照（`snapshot.db`）和 `media/` 目录。

也可以直接备份整个数据目录：

```bash
# 停止应用以确保 SQLite 一致
pnpm docker:down
tar -czf babyloom-backup-$(date +%F).tar.gz data/
pnpm docker:up
```

## 恢复

当前没有自动恢复 UI。恢复流程是手动的：

1. 停止应用（`pnpm docker:down`）
2. 把**当前**数据目录改名留底，例如 `mv data data.before-restore`
3. 准备一个空 `data/`
4. 解压备份到 `data/`：
   - 浏览器导出的 zip：把 `snapshot.db` 放到 `data/db/babyloom.sqlite`，把 zip 中的 `media/` 整个放到 `data/media/`
   - 整目录 tar 备份：直接解压覆盖
5. 复制或编辑 `data/config.yaml`（owner 密码以 yaml 为准）
6. `chmod 600 data/config.yaml`
7. `pnpm docker:up`，用 owner 账号登录验证

如果恢复失败，删除新建的 `data/`，把 `data.before-restore` 改回 `data/`，原状重启。

## 健康检查

`/api/health` 返回简单的 OK 响应，可用于反向代理或容器编排的存活探针。

## 常见问题

- **登录后立刻被踢出**：通常是 `app.baseUrl` 与浏览器实际访问的地址不一致导致 cookie domain 不匹配。改 yaml 与 baseUrl 对齐，再重启。
- **HTTPS 下 cookie 丢失**：`app.baseUrl` 必须以 `https://` 开头。
- **上传超大视频被拒**：调整 `media.maxVideoBytes`（[configuration.md](./configuration.md)）并重启。
- **想换数据目录**：设置 `BABYLOOM_DATA_DIR` 指向新路径，把现有 `data/` 拷过去后再启动。
