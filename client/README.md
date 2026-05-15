# BabyLoom 客户端APP

基于 React + PWA + TypeScript 构建的移动端应用

## 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **状态管理**: Zustand
- **数据获取**: TanStack Query (React Query)
- **UI组件**: 自定义组件（保持原型设计风格）
- **路由**: React Router
- **PWA**: Vite PWA Plugin
- **HTTP客户端**: Axios

## 项目结构

```
client/
├── public/
│   ├── manifest.json           # PWA配置
│   └── icons/                  # 应用图标
├── src/
│   ├── main.tsx                # 应用入口
│   ├── App.tsx                 # 根组件
│   ├── components/             # 公共组件
│   │   ├── BottomNav.tsx       # 底部导航
│   │   ├── TimelineCard.tsx    # 时间线卡片
│   │   ├── PhotoCarousel.tsx   # 照片轮播
│   │   ├── Calendar.tsx        # 日历组件
│   │   └── BottomSheet.tsx     # 底部弹窗
│   ├── pages/                  # 页面
│   │   ├── Timeline.tsx        # 时光页面
│   │   ├── Gallery.tsx         # 画廊页面
│   │   ├── CalendarPage.tsx    # 日历页面
│   │   ├── Profile.tsx         # 我的页面
│   │   ├── Milestones.tsx      # 里程碑页面
│   │   └── Detail.tsx          # 详情页面
│   ├── hooks/                  # 自定义Hooks
│   ├── stores/                 # 状态管理
│   ├── services/               # API服务
│   └── styles/                 # 全局样式
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── Dockerfile
```

## 功能模块

### 1. 时光页面 (Timeline)
- 按日期分组展示记录
- 支持文字、照片、视频
- 照片轮播（手势滑动）
- 里程碑标签展示
- 下拉刷新、上拉加载更多

### 2. 画廊页面 (Gallery)
- 照片/视频网格展示
- 按月份分组
- 瀑布流布局
- 点击查看大图

### 3. 日历页面 (Calendar)
- 月历视图
- 标记有记录的日子
- 点击日期查看当日记录

### 4. 我的页面 (Profile)
- 宝宝信息展示
- 数据统计
- 里程碑入口
- 家庭成员管理
- 设置入口

### 5. 添加记录
- 底部弹窗
- 文字输入
- 照片/视频上传（相机/相册）
- 里程碑标签选择

## PWA 功能

- **离线访问**: Service Worker缓存核心资源
- **添加到主屏幕**: manifest.json配置
- **推送通知**: 记录提醒（可选）
- **后台同步**: 离线记录同步

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
