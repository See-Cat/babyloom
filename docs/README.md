# BabyLoom 项目文档

## 文档目录

- [API文档](./api.md) - 完整的API接口文档
- [数据库设计](./database.md) - 数据模型和表结构
- [部署指南](./deployment.md) - Docker部署和运维

## 快速开始

### 开发环境

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/babyloom.git
cd babyloom

# 2. 启动后端
cd server
npm install
npm run start:dev

# 3. 启动客户端
cd ../client
npm install
npm run dev

# 4. 启动管理后台
cd ../admin
npm install
npm run dev
```

### 生产部署

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 2. 配置管理员账号
cp config/app.json.example config/app.json
# 编辑 config/app.json 文件

# 3. 部署
docker-compose up -d
```

## 项目结构

```
babyloom/
├── client/                 # 客户端APP (PWA)
├── admin/                  # 管理后台PC
├── server/                 # 后端服务
├── config/                 # 配置文件
├── docs/                   # 文档
├── docker-compose.yml      # Docker编排
└── README.md               # 项目说明
```

## 技术栈

- **客户端**: React + TypeScript + PWA
- **管理后台**: React + Ant Design + TypeScript
- **后端**: NestJS + PostgreSQL + TypeScript
- **部署**: Docker + Docker Compose

## 功能特性

- 多宝宝支持
- 照片/视频记录
- 时间线展示
- 日历视图
- 里程碑追踪
- 家庭成员协作
- 权限控制
- 软删除+垃圾桶
- NAS文件存储

## 贡献指南

1. Fork 项目
2. 创建分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

MIT License
