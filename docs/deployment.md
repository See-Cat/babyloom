# BabyLoom 部署指南

## 系统要求

- **NAS**: QNAP (Container Station)
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **内存**: 至少 2GB RAM
- **存储**: 根据照片/视频数量决定

## 目录结构

在NAS上创建以下目录：

```bash
/share/Container/babyloom/
├── config/          # 配置文件
├── uploads/         # 宝宝照片/视频
├── data/            # 数据文件
│   └── postgres/    # 数据库
└── ssl/             # SSL证书（可选）
```

## 快速部署

### 1. 准备配置文件

创建 `config/app.json`：

```json
{
  "admin": {
    "username": "admin",
    "password": "your-strong-password",
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

### 2. 准备环境变量

创建 `.env` 文件：

```bash
# 数据库配置
DB_PASSWORD=your-secure-db-password

# JWT密钥（生成随机字符串）
JWT_SECRET=$(openssl rand -base64 32)

# NAS挂载路径
NAS_MOUNT_PATH=/share/Container/babyloom
```

### 3. 部署

```bash
# 进入项目目录
cd babyloom

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f api
```

### 4. 验证部署

```bash
# 检查容器状态
docker-compose ps

# 测试API
curl http://your-nas-ip/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

## 访问应用

| 服务 | URL | 说明 |
|------|-----|------|
| 客户端APP | `http://your-nas-ip` | PWA应用 |
| 管理后台 | `http://your-nas-ip/admin` | PC管理后台 |
| API文档 | `http://your-nas-ip/api/docs` | Swagger文档 |

## 日常维护

### 修改管理员密码

1. 编辑 `config/app.json`
2. 重启API服务：

```bash
docker-compose restart api
```

### 配置热更新

BabyLoom支持配置热更新，无需重建容器：

1. 修改 `config/app.json` 文件
2. 重启API容器：

```bash
docker-compose restart api
```

注意：配置更改会在容器重启时自动同步到数据库

### 备份数据

```bash
# 备份数据库
docker exec babyloom-db pg_dump -U babyloom babyloom > backup.sql

# 备份上传文件
rsync -av /share/Container/babyloom/uploads/ /backup/uploads/
```

### 恢复数据

```bash
# 恢复数据库
docker exec -i babyloom-db psql -U babyloom babyloom < backup.sql

# 恢复上传文件
rsync -av /backup/uploads/ /share/Container/babyloom/uploads/
```

### 更新应用

```bash
# 拉取最新代码
git pull

# 重新构建
docker-compose build

# 重启服务
docker-compose up -d
```

## 故障排查

### 容器无法启动

```bash
# 查看日志
docker-compose logs api

# 检查端口占用
netstat -tlnp | grep 3001
```

### 数据库连接失败

```bash
# 检查数据库容器
docker-compose ps db

# 进入数据库容器
docker exec -it babyloom-db psql -U babyloom
```

### 文件上传失败

```bash
# 检查目录权限
ls -la /share/Container/babyloom/uploads/

# 检查磁盘空间
df -h
```

## 安全建议

1. **修改默认密码**
   - 首次部署后立即修改管理员密码
   - 使用强密码（12位以上，包含大小写+数字+符号）

2. **启用HTTPS**
   - 准备SSL证书
   - 放置到 `ssl/` 目录
   - 配置Nginx使用HTTPS

3. **定期备份**
   - 数据库每日备份
   - 文件每周备份
   - 备份存储到不同位置

4. **防火墙配置**
   - 仅开放必要端口（80/443）
   - 限制管理后台访问IP

## 性能优化

### 数据库优化

```sql
-- 定期清理软删除数据
DELETE FROM entries WHERE deletedAt < NOW() - INTERVAL '30 days';
DELETE FROM media WHERE deletedAt < NOW() - INTERVAL '30 days';
```

### 文件存储优化

```bash
# 压缩旧图片
find /share/Container/babyloom/uploads -name "*.jpg" -mtime +90 -exec jpegoptim {} \;

# 清理临时文件
find /share/Container/babyloom/uploads -name "*.tmp" -delete
```

## 扩展配置

### 自定义域名

编辑 `nginx.conf`：

```nginx
server {
    listen 80;
    server_name baby.yourdomain.com;
    
    location / {
        proxy_pass http://client:80;
    }
    
    # ...
}
```

### 邮件通知

编辑 `config/app.json`：

```json
{
  "email": {
    "smtpHost": "smtp.qq.com",
    "smtpPort": 587,
    "smtpUser": "your-email@qq.com",
    "smtpPassword": "your-password"
  }
}
```

## 卸载

```bash
# 停止服务
docker-compose down

# 删除数据（谨慎操作）
rm -rf /share/Container/babyloom/data
rm -rf /share/Container/babyloom/uploads
```

## 支持

- **文档**: `/docs`
- **API文档**: `http://your-nas-ip/api/docs`
- **Issues**: GitHub Issues
