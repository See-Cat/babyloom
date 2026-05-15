# BabyLoom 管理后台

基于 React + Ant Design + TypeScript 构建的PC端管理后台

## 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI组件库**: Ant Design 5.x
- **状态管理**: Zustand
- **数据获取**: TanStack Query
- **路由**: React Router
- **图表**: Ant Design Charts

## 项目结构

```
admin/
├── public/
├── src/
│   ├── main.tsx                # 应用入口
│   ├── App.tsx                 # 根组件
│   ├── layouts/                # 布局组件
│   │   └── MainLayout.tsx      # 主布局
│   ├── pages/                  # 页面
│   │   ├── Dashboard.tsx       # 数据看板
│   │   ├── Entries.tsx         # 记录管理
│   │   ├── Media.tsx           # 媒体管理
│   │   ├── Milestones.tsx      # 里程碑管理
│   │   ├── Users.tsx           # 用户管理
│   │   └── Settings.tsx        # 系统设置
│   ├── components/             # 公共组件
│   ├── hooks/                  # 自定义Hooks
│   ├── stores/                 # 状态管理
│   └── services/               # API服务
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── Dockerfile
```

## 功能模块

### 1. 数据看板 (Dashboard)
- 统计卡片：总记录数、照片数、视频数、用户数
- 最近活动列表
- 数据趋势图表

### 2. 记录管理 (Entries)
- 记录列表（表格展示）
- 搜索、筛选、分页
- 查看详情
- 编辑/删除记录

### 3. 媒体管理 (Media)
- 照片/视频网格展示
- 批量上传
- 批量删除
- 缩略图预览

### 4. 里程碑管理 (Milestones)
- 里程碑列表
- 创建/编辑/删除
- 查看里程碑下的记录

### 5. 用户管理 (Users)
- 用户列表
- 添加用户
- 编辑用户权限
- 删除用户

### 6. 系统设置 (Settings)
- 备份设置
- 存储管理
- 通知设置

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 预览生产构建
npm run preview
```

## 环境变量

```env
VITE_API_URL=http://localhost:3001/api
```
