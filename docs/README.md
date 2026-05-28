# BabyLoom 文档

项目说明、功能列表与技术栈在仓库根 [`README.md`](../README.md)。本目录是面向部署用户和代码贡献者的参考文档。

## 阅读路径

### 我想部署 / 自托管

1. [deployment.md](./deployment.md) —— Docker、NAS、反向代理、升级、备份恢复
2. [configuration.md](./configuration.md) —— `config.yaml` 与环境变量
3. [deployment.md#备份](./deployment.md#备份) —— 备份与恢复流程

### 我想读懂代码

1. [architecture.md](./architecture.md) —— 系统架构、模块边界、关键流程
2. [database.md](./database.md) —— 表清单、ER 图、迁移流程
3. [api.md](./api.md) —— 认证模型、权限矩阵、路由分区
4. [design-system.md](./design-system.md) —— 设计 token 与用法示例

## 文档维护准则

写之前先读这几条，免得旧的错误再次堆积。

1. **以源码为准**。API 字段、表字段不在文档里枚举，文档只写概念、关系和不变量。具体字段去 [`lib/server/db/schema.ts`](../lib/server/db/schema.ts) 和 [`app/api/`](../app/api/) 找。
2. **单一信息源（SSoT）**。每个主题只在一个文档详写，其它文档需要引用时只链接，不复述。重复出现的内容是文档漂移的主要来源。
3. **跨文档引用用相对链接**。`./other.md` 或 `../<root-file>`，方便 GitHub 与本地阅读器都能跳转。
4. **删旧不留**。文档失效时直接删除并在 commit message 说明，依赖 git 历史回溯，不在仓库里养 `legacy.md`。
5. **简短优先**。本目录长期目标是控制在每篇 300 行以内；长度膨胀往往意味着该拆分或下沉到源码注释。
