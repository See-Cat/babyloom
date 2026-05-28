# 文档体系重构设计

**日期**：2026-05-28
**作者**：协作产出（用户 + Claude）
**状态**：待实施

## 1. 背景

根 `README.md` 与当前实现（Next.js 单体 + SQLite + better-auth + `data/config.yaml`）基本一致，需要的只是轻度优化。

`docs/` 目录则**严重过时**：除 `DESIGN.md` 之外，所有文档描述的是已废弃的三层架构（NestJS + PostgreSQL + 三端分离 + JWT）。直接保留会持续误导自托管用户和潜在贡献者。

## 2. 目标读者

1. **自托管部署用户** —— NAS / 家用服务器使用者，关心部署、配置、备份恢复。
2. **未来代码贡献者** —— 需要架构、数据模型、API 索引、设计系统等参考。

文档维护人力有限，原则上**不写易过时的细节枚举**，让源码（schema 文件、route handler）成为事实来源。

## 3. 总体结构

```
README.md                 # 项目门面：TL;DR + 文档导航
docs/
├── README.md             # 文档入口：按读者推荐阅读路径
├── architecture.md       # 系统架构、模块边界、关键流程
├── deployment.md         # Docker / NAS / 反代 / HTTPS / 升级 / 备份恢复
├── configuration.md      # config.yaml + 环境变量逐项说明
├── database.md           # Drizzle schema 总览 + 迁移流程 + ER 图
├── api.md                # 认证模型 + 权限矩阵 + 路由分区索引
├── design-system.md      # 由 DESIGN.md 改名（保留并补充用法示例）
└── archive/              # 旧文档归档
    ├── README.md         # 简短说明：以下文档描述已废弃的三层架构，仅作历史参考
    ├── features.legacy.md
    ├── api.legacy.md
    ├── database.legacy.md
    └── deployment.legacy.md
```

**不保留 `features.md`**：产品功能列表已在根 `README.md`，重复维护无意义。

## 4. 单一信息源（SSoT）—— 反冗余规则

每个主题**只在一个文档详写**，其它文档需要引用时只链接，不复述。下表是权威分配：

| 主题 | 权威文档 | 其它文档如何处理 |
|---|---|---|
| 项目定位 / 功能清单 | 根 `README.md` | docs 不重复 |
| 安装与首次启动 | 根 `README.md`（TL;DR）+ `deployment.md`（完整） | 其它文档只链 |
| `config.yaml` 字段表 | `docs/configuration.md` | 根 README 给最小示例 + 链；deployment 引用字段时不再列表 |
| 环境变量 (`BABYLOOM_DATA_DIR` 等) | `docs/configuration.md` | 其它文档只链 |
| Docker / NAS 部署步骤 | `docs/deployment.md` | 根 README 给 3 步 TL;DR + 链 |
| 备份与恢复 | `docs/deployment.md` | 根 README 给一句话 + 链 |
| 数据目录结构 | `docs/deployment.md` | 根 README 给最小示例 + 链 |
| 运行时架构 / 模块边界 / 关键流程 | `docs/architecture.md` | api/database 文档引用流程时链回此处 |
| 数据模型 / 表结构 / ER 图 / 迁移 | `docs/database.md` | architecture 只画模块层级的"数据"框；api 列权限矩阵时不重复字段 |
| 权限模型（owner/member、per-baby 位） | `docs/api.md`（执行视角的矩阵） + `docs/database.md`（数据视角的字段） | 两边交叉链：database 写"语义见 api.md 矩阵"，api 写"字段定义见 database.md" |
| 路由索引 | `docs/api.md` | 不再在 architecture / README 列具体路径 |
| 认证模型 (better-auth, cookie session) | `docs/api.md` | 其它文档只链 |
| 设计 token / 字体 / 颜色 | `docs/design-system.md` | architecture 提及 UI 层时链 |
| 常用 npm/pnpm 脚本 | 根 `README.md` | docs 不重复 |
| 技术栈清单 | 根 `README.md` | docs 不重复 |

**冲突检测口径**：写每篇文档时，凡涉及上表非本文档权威的主题，**必须**用链接形式引用，不允许复制说明文字。

## 5. 各文档详细骨架

### 5.1 根 `README.md`（保留并轻度优化）

只做以下增量改动：

1. 顶部加一行 tagline（一句话英文 + 中文）
2. "功能"前预留**截图占位区**：`<!-- 截图 TODO -->`（不阻塞文档落地）
3. "配置说明"小节缩短：3 行 TL;DR + 链 `docs/configuration.md`
4. "NAS / QNAP 部署要点"长段缩短为 3 步要点 + 链 `docs/deployment.md`
5. "备份与恢复"缩短为一句话 + 链 `docs/deployment.md`
6. 新增末尾 **📖 文档** 区块：分自托管 / 开发两组链 docs/ 文件
7. 末尾补充 License、Issues、贡献入口（最小化，3~5 行）

**不动**：功能列表、技术栈、快速开始、数据目录最小示例、常用脚本、项目结构、注意事项。

### 5.2 `docs/README.md`（≤80 行）

- 一句话项目定位 + 链回根 README
- **阅读路径**：
  - 「我要部署」→ `deployment.md` → `configuration.md` → 备份小节
  - 「我要理解代码」→ `architecture.md` → `database.md` → `api.md` → `design-system.md`
- **文档维护准则**（写明给未来贡献者）：
  - API 字段、表字段以源码为准，文档只写概念
  - 一处修改一处发布，避免跨文档拷贝
  - 旧文档放 `archive/`

### 5.3 `docs/architecture.md`（200~300 行）

- **运行时拓扑**：浏览器/PWA ↔ Next.js（Route Handlers + Server Components）↔ SQLite + 本地媒体目录；无独立后端
- **模块边界**（基于实际目录）：
  - `app/`：页面 + Route Handlers
  - `components/`：UI / 移动端壳 / 业务组件
  - `lib/server/`：服务端模块（db、auth、media、backup、logger、config）
  - `lib/client/`：浏览器侧工具
  - `lib/db/`：Drizzle schema 与迁移
- **启动初始化序列**：加载 `config.yaml` → 打开 SQLite → 应用 migration → 注入/更新 owner
- **关键流程**（时序图，Mermaid）：
  1. 登录 / 会话
  2. 媒体上传（生成图片变体、视频封面、写入 media 表）
  3. 备份导出
  4. 软删除 → 垃圾桶 → 清空
- **离线策略**：Serwist SW 的只读 fallback 语义
- 跨文档引用：表字段链 database.md；路由链 api.md；UI token 链 design-system.md

### 5.4 `docs/deployment.md`（150~200 行）

- 系统要求（Node 22、Docker 版本、内存/磁盘建议）
- **Docker 部署**：`pnpm docker:build` / `pnpm docker:up` / 日志查看
- **数据目录映射**：宿主机 `./data` ↔ 容器 `/app/data`
- **NAS 部署**（QNAP/群晖通用，去 QNAP 专属表述）
- **Nginx / 反向代理**：HTTPS 终止由外层承担；示例片段（最小化）
- **升级**：拉新镜像 → 数据目录优先备份 → 重启；迁移自动应用
- **备份与恢复**：导出位置、停机要求、`snapshot.db` → `db/babyloom.sqlite` 与 `media/` 的还原流程
- 跨文档引用：`config.yaml` 字段链 configuration.md；表结构链 database.md

### 5.5 `docs/configuration.md`（100~150 行）

- `config.yaml` 全字段表（owner / family / app / log / media）含默认值、约束、修改后影响
- 环境变量表（`BABYLOOM_DATA_DIR`、`NODE_ENV` 等）
- 安全建议：`chmod 600`、强 `app.secret`、`baseUrl` 不能用 localhost
- 重启/迁移触发条件（owner 密码改动需重启等）
- 跨文档引用：部署上下文链 deployment.md

### 5.6 `docs/database.md`（150~200 行）

- 表清单与一句话描述（owner、user、baby、baby_user、entry、media、milestone、log 等以源码为准）
- **ER 图**（Mermaid）
- 关键字段约定：软删除字段、时间戳约定、媒体变体记录方式
- **Drizzle 迁移工作流**：`pnpm db:generate` / `pnpm db:migrate` / 迁移文件命名
- **权限字段语义**：仅描述 `baby_user` 表 per-baby 权限位的"字段"层面；矩阵执行行为链 api.md
- 跨文档引用：流程时序链 architecture.md

### 5.7 `docs/api.md`（200~250 行）

- **认证模型**：better-auth、cookie session 生命周期、CSRF 策略（如有）
- **权限矩阵**：owner / member × 操作（创建宝宝、编辑记录、上传、删除、备份导出…）；每行注明依赖的字段（链 database.md）
- **路由分区索引**（按功能分区，每条只写：方法 / 路径 / 一句话用途；具体入参出参指向源码）：
  - `/api/auth/*`
  - `/api/babies/*`
  - `/api/entries/*`
  - `/api/media/*`
  - `/api/milestones/*`
  - `/api/backup/*`
  - `/api/profile/*`
  - `/api/admin/*`（数据面板 / 日志）
- **错误响应规范**：统一信封形式、状态码语义
- 写操作的在线/离线限制（链 architecture 离线策略小节）
- 跨文档引用：流程链 architecture.md；字段链 database.md

### 5.8 `docs/design-system.md`

- 把现有 `DESIGN.md` 改名迁入
- 保留 token / 字体 / 阴影 / 圆角 / 间距 / 层级表
- 补充 **用法示例**（≤30 行）：如何在新组件中正确使用 token、如何避免被 `babyloom/no-raw-color` lint 拦截
- 不复述根 README 的"技术栈"

### 5.9 `docs/archive/`

- `archive/README.md`：一段警示语，明确这些文档描述已废弃的 NestJS + PostgreSQL 三层架构，仅作历史参考；并指向 `docs/README.md`
- 将旧 `features.md`、`api.md`、`database.md`、`deployment.md` 整体重命名为 `*.legacy.md` 移入
- 旧 `docs/README.md` 直接被新版覆盖（不进 archive，避免读者误入）

## 6. 落地次序（实施时）

1. 新建 `docs/archive/`，移入旧文档并加 README 警示
2. 写 `docs/architecture.md`（其它文档要链它）
3. 写 `docs/database.md`、`docs/configuration.md`（被其它文档引用）
4. 写 `docs/api.md`、`docs/deployment.md`
5. 改名 `DESIGN.md` → `docs/design-system.md` 并补用法示例
6. 重写 `docs/README.md`（最后写，因为要链所有兄弟文档）
7. 修订根 `README.md`（最后改，避免链断）
8. 全量检查：跨文档主题是否违反 SSoT 表；所有相对链接是否可点

## 7. 不做的事

- 不重写 features.md（合并到根 README "功能"）
- 不写 CONTRIBUTING.md（暂无外部贡献流程，YAGNI）
- 不在 api.md 列具体入参出参（避免和源码漂移）
- 不在 database.md 列每个字段类型（让 schema 文件做权威）
- 不在根 README 截图区放真实图片（占位，等用户提供）
- 不动 lint / 测试 / 代码

## 8. 验收标准

- `docs/` 中所有非 `archive/` 的文档不出现 "NestJS"、"PostgreSQL"、"JWT"、"client/"、"admin/"、"server/" 这类与现实不符的术语
- SSoT 表中每个主题在非权威文档中只以链接形式出现
- 根 README 不再含 `config.yaml` 全字段表和 NAS 部署长段
- 旧文档在 `archive/` 中且有警示 README
- 所有相对链接可解析
