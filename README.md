# BabyLoom

BabyLoom 是一个自托管的家庭宝宝成长记录 PWA。它把时间线、照片/视频、日历、里程碑、家庭成员和权限管理放在一个 Next.js 应用里，适合部署在家用服务器或 NAS 上。

当前实现是单体应用：Next.js App Router 提供页面和 API，SQLite 存储业务数据，媒体文件保存在本地数据目录。没有独立后端服务，也不依赖 PostgreSQL。

## 功能

- 宝宝成长记录：创建、编辑、查看文字记录，支持关联里程碑。
- 媒体上传：支持照片和视频，生成图片变体、视频封面和基础媒体信息。
- 时间线：按日期展示记录，支持多宝宝筛选。
- 画廊：按月份浏览照片和视频。
- 日历：查看每月哪些日期有记录。
- 家庭成员：由 owner 创建成员账号，重置密码，管理成员。
- 权限控制：按宝宝配置成员的查看、编辑、管理能力。
- 软删除与垃圾桶：宝宝、记录、媒体可移入垃圾桶、恢复或清空。
- 个人资料：修改昵称、上传头像。
- 数据面板：查看数据统计、导出备份、浏览日志。
- PWA 离线页：离线时提供只读体验；新增、编辑、上传、删除和备份导出需要在线。

## 技术栈

- Next.js 15 + React 19 + TypeScript
- SQLite + Drizzle ORM + better-sqlite3
- better-auth
- Serwist PWA / Service Worker
- sharp、ffmpeg-static、ffprobe-static、fluent-ffmpeg、file-type、formidable
- Vitest、Playwright、ESLint
- Docker + Nginx

## 快速开始

需要 Node.js 22 和 pnpm。

```bash
pnpm install
mkdir -p data
cp config.yaml.example data/config.yaml
```

编辑 `data/config.yaml`，至少修改 owner 密码和 `app.secret`：

```yaml
owner:
  username: babyloom
  password: change-me-on-first-login
  nickname: 家长
family:
  name: 我的家
app:
  baseUrl: http://localhost:3000
  secret: change-me-to-at-least-32-random-characters
  timezone: Asia/Shanghai
log:
  level: info
media:
  maxPhotoBytes: 50000000
  maxVideoBytes: 500000000
```

建议限制配置文件权限：

```bash
chmod 600 data/config.yaml
```

启动开发服务：

```bash
pnpm dev
```

打开 `http://localhost:3000`，使用 `data/config.yaml` 里的 owner 账号密码登录。

## 数据目录

默认运行数据放在 `data/` 下。也可以用 `BABYLOOM_DATA_DIR` 指向其他目录。

典型结构：

```text
data/
├── config.yaml
├── db/
│   └── babyloom.sqlite
├── logs/
│   └── app-YYYY-MM-DD.log
└── media/
```

应用启动时会读取 `config.yaml`，打开 SQLite 数据库，并应用待执行的数据库迁移。owner 密码以配置文件为准；修改 `data/config.yaml` 后重启应用即可重置 owner 密码。

## 常用脚本

```bash
pnpm dev          # 本地开发
pnpm build        # 生产构建，输出 Next.js standalone
pnpm start        # 启动生产服务
pnpm lint         # ESLint
pnpm typecheck    # TypeScript 类型检查
pnpm test         # Vitest 单元/集成测试
pnpm test:e2e     # Playwright 端到端测试
pnpm build:icons  # 重新生成 PWA 图标
pnpm db:generate  # 根据 schema 生成 Drizzle migration
pnpm db:migrate   # 执行数据库迁移
```

## Docker 部署

构建并启动：

```bash
pnpm docker:build
pnpm docker:up
```

查看日志：

```bash
pnpm docker:logs
```

`docker-compose.yml` 会把本地 `./data` 挂载到容器 `/app/data`，Nginx 默认监听宿主机 80 端口并转发到应用容器。

## NAS / QNAP 部署要点

1. 在 NAS 上克隆仓库。
2. 创建 `data/config.yaml`，可从 `config.yaml.example` 复制。
3. 设置强密码和至少 32 字符的 `app.secret`。
4. 把 `app.baseUrl` 改成局域网或域名可访问的地址，例如 `http://192.168.1.10` 或 `https://baby.example.local`。不要保留成 `localhost`，否则其他设备登录会出问题。
5. 执行 `pnpm docker:build` 和 `pnpm docker:up`。
6. 访问 NAS 地址并用 owner 账号登录。

BabyLoom 本身不负责 HTTPS 证书终止。需要 HTTPS 时，放在 NAS 反向代理、Caddy、Traefik 或其他 TLS 入口后面。

## 备份与恢复

owner 可以在 `/profile/data` 导出备份。备份用于手动恢复：停止应用后，将备份内容恢复到新的空数据目录，确保数据库文件和 `media/` 目录放回对应位置，再用该数据目录启动服务。

当前没有自动恢复 UI。恢复前建议先保留原数据目录副本。

## 配置说明

`data/config.yaml` 支持这些主要配置：

- `owner.username`：owner 登录用户名，只能包含字母、数字、下划线和短横线。
- `owner.password`：owner 密码，至少 6 位。
- `owner.nickname`：owner 昵称。
- `family.name`：家庭名称。
- `app.baseUrl`：应用对外访问地址。
- `app.secret`：认证密钥，至少 32 字符。
- `app.timezone`：应用时区，默认 `Asia/Shanghai`。
- `log.level`：日志级别，默认 `info`。
- `media.maxPhotoBytes`：单张照片大小上限，默认 50MB。
- `media.maxVideoBytes`：单个视频大小上限，默认 500MB。

## 项目结构

```text
app/                 Next.js 页面、API Route、PWA service worker
components/          UI、移动端壳、业务组件
lib/                 数据库、权限、媒体处理、日志、配置、备份等服务代码
styles/              设计 token 和字体样式
public/              字体、manifest、PWA 图标
tests/               Vitest 与 Playwright 测试
docs/                项目文档和历史设计资料
lib/db/migrations/   Drizzle 数据库迁移
```

## 注意事项

- `public/sw.js` 是构建生成物，可重新生成，不需要手写。
- `test-data/` 是 Playwright 测试数据目录，不应作为生产数据使用。
- 上传、删除、备份导出等写操作需要在线。
- 生产部署前务必更换 `owner.password` 和 `app.secret`。
