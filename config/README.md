# BabyLoom 应用配置文件

## 配置文件位置

`config/app.json`

## 配置说明

```json
{
  "admin": {
    "username": "admin",
    "password": "admin123",
    "nickname": "管理员"
  },
  "app": {
    "name": "小日子",
    "description": "宝宝生活记录",
    "maxUploadSize": 52428800,
    "allowRegistration": false,
    "defaultLanguage": "zh-CN"
  },
  "storage": {
    "uploadPath": "/app/uploads",
    "backupEnabled": true,
    "backupInterval": "daily"
  },
  "features": {
    "enableTrash": true,
    "trashRetentionDays": 30,
    "enableNotifications": false
  }
}
```

### admin - 管理员配置

| 字段 | 说明 | 默认值 |
|------|------|--------|
| username | 管理员登录账号 | admin |
| password | 管理员密码 | admin123 |
| nickname | 显示昵称 | 管理员 |

**注意：**
- 首次启动时自动创建管理员账号
- 修改后**重启容器**即可生效（无需重新部署）
- 系统会自动同步配置到数据库

### app - 应用配置

| 字段 | 说明 | 默认值 |
|------|------|--------|
| name | 应用名称 | 小日子 |
| description | 应用描述 | 宝宝生活记录 |
| maxUploadSize | 最大上传文件大小（字节） | 52428800 (50MB) |
| allowRegistration | 是否允许自注册 | false |
| defaultLanguage | 默认语言 | zh-CN |

### storage - 存储配置

| 字段 | 说明 | 默认值 |
|------|------|--------|
| uploadPath | 上传文件存储路径 | /app/uploads |
| backupEnabled | 是否启用自动备份 | true |
| backupInterval | 备份间隔 | daily |

### features - 功能开关

| 字段 | 说明 | 默认值 |
|------|------|--------|
| enableTrash | 是否启用垃圾桶 | true |
| trashRetentionDays | 垃圾桶保留天数 | 30 |
| enableNotifications | 是否启用通知 | false |

## 修改配置后生效

### 方式1：重启容器（推荐）

```bash
# 修改 config/app.json 后
docker-compose restart api
```

### 方式2：重新部署

```bash
# 如果修改了环境变量
docker-compose up -d
```

## 安全建议

1. **首次部署前**修改默认管理员密码
2. 定期备份 `config/app.json` 文件
3. 不要将真实密码提交到代码仓库

## 目录结构

部署后NAS上的目录结构：

```
/share/Container/babyloom/          # NAS_MOUNT_PATH
├── config/                          # 配置文件
│   ├── app.json                     # 应用配置（当前文件）
│   └── README.md                    # 配置说明
├── uploads/                         # 宝宝照片/视频
│   ├── {baby-id-1}/
│   │   └── 2024/01/
│   └── {baby-id-2}/
│       └── 2024/02/
├── data/                            # 数据文件
│   └── postgres/                    # 数据库
└── ssl/                             # SSL证书（可选）
    ├── cert.pem
    └── key.pem
```

## 未来扩展

可能添加的配置项：

```json
{
  "email": {
    "smtpHost": "smtp.example.com",
    "smtpPort": 587,
    "smtpUser": "user@example.com",
    "smtpPassword": "password"
  },
  "security": {
    "maxLoginAttempts": 5,
    "lockoutDuration": 900,
    "passwordMinLength": 8
  },
  "appearance": {
    "theme": "default",
    "primaryColor": "#FF6B6B",
    "logo": "/assets/logo.png"
  }
}
```
