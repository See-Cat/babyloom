# BabyLoom 后端服务

基于 NestJS + PostgreSQL + TypeScript 构建的 RESTful API 服务

## 技术栈

- **框架**: NestJS 10.x
- **数据库**: PostgreSQL 15
- **ORM**: TypeORM
- **认证**: JWT + Passport
- **文件上传**: Multer + Sharp
- **文档**: Swagger

## 项目结构

```
server/
├── src/
│   ├── main.ts                 # 应用入口
│   ├── app.module.ts           # 根模块
│   ├── config/                 # 配置
│   │   ├── database.config.ts
│   │   └── swagger.config.ts
│   ├── modules/                # 业务模块
│   │   ├── auth/               # 认证
│   │   ├── baby/               # 宝宝信息
│   │   ├── entry/              # 记录
│   │   ├── media/              # 媒体文件
│   │   ├── milestone/          # 里程碑
│   │   └── user/               # 用户
│   ├── entities/               # 数据实体
│   └── utils/                  # 工具函数
├── uploads/                    # 上传文件目录
└── Dockerfile
```

## API 模块

### 认证模块 (Auth)
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/refresh` - 刷新Token

### 宝宝模块 (Baby)
- `GET /api/baby` - 获取宝宝信息
- `PUT /api/baby` - 更新宝宝信息
- `POST /api/baby` - 创建宝宝信息

### 记录模块 (Entry)
- `GET /api/entries` - 获取记录列表（支持分页、筛选）
- `POST /api/entries` - 创建记录
- `GET /api/entries/:id` - 获取单条记录
- `PUT /api/entries/:id` - 更新记录
- `DELETE /api/entries/:id` - 删除记录

### 媒体模块 (Media)
- `POST /api/upload` - 上传文件
- `GET /api/media` - 获取媒体列表
- `DELETE /api/media/:id` - 删除媒体

### 日历模块 (Calendar)
- `GET /api/calendar` - 获取日历数据
- `GET /api/calendar/:year/:month` - 获取指定月份日历

### 里程碑模块 (Milestone)
- `GET /api/milestones` - 获取里程碑列表
- `GET /api/milestones/:id` - 获取里程碑详情
- `POST /api/milestones` - 创建里程碑

### 用户模块 (User)
- `GET /api/users` - 获取用户列表
- `POST /api/users` - 添加用户
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户

## 数据实体

### Baby（宝宝）
```typescript
{
  id: UUID
  name: string
  avatar: string
  birthDate: Date
  gender: 'boy' | 'girl'
  createdAt: Date
  updatedAt: Date
}
```

### User（用户）
```typescript
{
  id: UUID
  name: string
  avatar: string
  email: string
  role: 'admin' | 'member'
  relation: 'mom' | 'dad' | 'grandma' | 'grandpa' | 'other'
  createdAt: Date
}
```

### Entry（记录）
```typescript
{
  id: UUID
  babyId: UUID
  content: string
  createdAt: Date
  createdBy: UUID
  tags: string[]
  media: Media[]
}
```

### Media（媒体）
```typescript
{
  id: UUID
  entryId: UUID
  type: 'photo' | 'video'
  url: string
  thumbnail: string
  duration: number  // 视频时长（秒）
  size: number
  createdAt: Date
}
```

### Milestone（里程碑）
```typescript
{
  id: UUID
  name: string
  description: string
  icon: string
  entries: Entry[]
}
```

## 环境变量

```env
# 数据库
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=babyloom
DB_PASSWORD=your_password
DB_NAME=babyloom

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRATION=7d

# 文件上传
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=50MB

# 应用
PORT=3001
NODE_ENV=development
```

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式
npm run start:dev

# 构建
npm run build

# 生产模式
npm run start:prod

# 数据库迁移
npm run migration:generate
npm run migration:run

# 测试
npm run test
npm run test:e2e
```

## Docker 部署

```bash
# 构建镜像
docker build -t babyloom-server .

# 运行容器
docker run -p 3001:3001 \
  -e DB_HOST=db \
  -e DB_PASSWORD=password \
  -v ./uploads:/app/uploads \
  babyloom-server
```
