# BabyLoom - 小日子

宝宝生活记录应用 - 三端完整解决方案

## 项目结构

```
babyloom/
├── docker-compose.yml          # 三端统一部署
├── .env                        # 环境变量
├── client/                     # 客户端APP (PWA)
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── Dockerfile
├── admin/                      # 管理后台PC
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── Dockerfile
└── server/                     # 后端服务
    ├── src/
    ├── package.json
    └── Dockerfile
```

## 技术栈

- **客户端APP**: React + PWA + TypeScript
- **管理后台**: React + Ant Design + TypeScript
- **后端服务**: NestJS + PostgreSQL + TypeScript
- **部署**: Docker + Docker Compose + Nginx

## 快速开始

### 开发环境

```bash
# 启动本地开发数据库（不需要在本机安装 PostgreSQL）
docker compose -f docker-compose.dev.yml up -d db

# 启动后端服务
cd server
npm install
npm run start:dev

# 启动客户端APP
cd client
npm install
npm run dev

# 启动管理后台
cd admin
npm install
npm run dev
```

### 生产部署

```bash
# 在QNAP Container Station中部署
docker-compose up -d
```

## 功能模块

### 客户端APP
- 时光：按时间线展示宝宝成长记录
- 画廊：照片视频网格浏览
- 日历：月历视图标记记录日
- 我的：宝宝资料、里程碑、家庭成员

### 管理后台
- 数据看板：统计概览
- 记录管理：查看/编辑/删除记录
- 媒体管理：照片视频管理
- 用户管理：家庭成员管理
- 系统设置：备份、存储、通知

## 开发顺序

1. **Phase 1**: 后端服务（API + 数据库）
2. **Phase 2**: 客户端APP（PWA）
3. **Phase 3**: 管理后台

## 文档

- [API文档](./docs/api.md)
- [数据库设计](./docs/database.md)
- [部署指南](./docs/deployment.md)
