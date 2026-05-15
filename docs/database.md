# BabyLoom 数据库设计文档

## 实体关系图

```
User (1) ───< (N) BabyUser (N) >─── (1) Baby
                │
                └── 权限：canCreate/canDelete/canEdit

Baby (1) ───< (N) Entry (N) >─── (1) User
                │
                └──< (N) Media

Milestone (1) ───< (N) Entry
```

## 数据表

### 1. users（用户表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 主键 |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 登录账号 |
| password | VARCHAR(255) | NOT NULL | 加密密码 |
| nickname | VARCHAR(50) | NOT NULL | 显示昵称 |
| avatar | VARCHAR(255) | NULL | 头像URL |
| role | ENUM | DEFAULT 'member' | 角色：admin/member |
| isActive | BOOLEAN | DEFAULT true | 是否启用 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updatedAt | TIMESTAMP | AUTO UPDATE | 更新时间 |
| deletedAt | TIMESTAMP | NULL | 软删除时间 |

**索引：**
- PRIMARY KEY (id)
- UNIQUE INDEX (username)
- INDEX (role)
- INDEX (deletedAt)

---

### 2. babies（宝宝表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 主键 |
| name | VARCHAR(50) | NOT NULL | 宝宝姓名 |
| avatar | VARCHAR(255) | NULL | 头像URL |
| birthDate | DATE | NOT NULL | 出生日期 |
| gender | ENUM | NULL | 性别：boy/girl |
| storagePath | VARCHAR(255) | DEFAULT '/uploads' | 存储路径 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updatedAt | TIMESTAMP | AUTO UPDATE | 更新时间 |

**索引：**
- PRIMARY KEY (id)

---

### 3. baby_users（宝宝用户关联表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 主键 |
| babyId | UUID | FK, NOT NULL | 宝宝ID |
| userId | UUID | FK, NOT NULL | 用户ID |
| relation | ENUM | NULL | 关系：mom/dad/grandma/grandpa/other |
| canCreate | BOOLEAN | DEFAULT true | 可创建 |
| canDelete | BOOLEAN | DEFAULT false | 可删除 |
| canEdit | BOOLEAN | DEFAULT true | 可编辑 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |

**索引：**
- PRIMARY KEY (id)
- UNIQUE INDEX (babyId, userId)
- INDEX (babyId)
- INDEX (userId)

**外键：**
- babyId → babies(id) ON DELETE CASCADE
- userId → users(id) ON DELETE CASCADE

---

### 4. entries（记录表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 主键 |
| babyId | UUID | FK, NOT NULL | 宝宝ID |
| content | TEXT | NOT NULL | 记录内容 |
| tags | TEXT[] | NULL | 标签数组 |
| createdBy | UUID | FK, NOT NULL | 创建者ID |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updatedAt | TIMESTAMP | AUTO UPDATE | 更新时间 |
| deletedAt | TIMESTAMP | NULL | 软删除时间 |
| deletedBy | UUID | NULL | 删除者ID |

**索引：**
- PRIMARY KEY (id)
- INDEX (babyId)
- INDEX (createdBy)
- INDEX (createdAt)
- INDEX (deletedAt)
- INDEX (tags) USING GIN

**外键：**
- babyId → babies(id) ON DELETE CASCADE
- createdBy → users(id)

---

### 5. media（媒体表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 主键 |
| entryId | UUID | FK, NOT NULL | 记录ID |
| babyId | UUID | FK, NOT NULL | 宝宝ID（冗余） |
| type | ENUM | NOT NULL | 类型：photo/video |
| url | VARCHAR(500) | NOT NULL | 文件URL |
| thumbnail | VARCHAR(500) | NULL | 缩略图URL |
| duration | INT | NULL | 视频时长（秒） |
| size | BIGINT | NULL | 文件大小（字节） |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| deletedAt | TIMESTAMP | NULL | 软删除时间 |

**索引：**
- PRIMARY KEY (id)
- INDEX (entryId)
- INDEX (babyId)
- INDEX (type)
- INDEX (deletedAt)

**外键：**
- entryId → entries(id) ON DELETE CASCADE
- babyId → babies(id)

---

### 6. milestones（里程碑表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 主键 |
| name | VARCHAR(100) | NOT NULL | 里程碑名称 |
| description | TEXT | NULL | 描述 |
| icon | VARCHAR(50) | NULL | 图标 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updatedAt | TIMESTAMP | AUTO UPDATE | 更新时间 |

**索引：**
- PRIMARY KEY (id)

---

## 关系说明

### 用户与宝宝（多对多）
- 通过 `baby_users` 关联表实现
- 一个用户可以关注多个宝宝
- 一个宝宝可以有多个关联用户
- 关联表中包含权限字段

### 宝宝与记录（一对多）
- 一个宝宝有多条记录
- 记录通过 `babyId` 关联
- 删除宝宝级联删除记录

### 记录与媒体（一对多）
- 一条记录可以有多个媒体文件
- 媒体通过 `entryId` 关联
- 删除记录级联删除媒体

### 用户与记录（一对多）
- 一个用户可以创建多条记录
- 记录通过 `createdBy` 关联

### 里程碑与记录（一对多）
- 一个里程碑可以有多条记录
- 通过 `tags` 字段关联（记录中的标签匹配里程碑名称）

## 软删除机制

### 支持软删除的表
- `users`
- `entries`
- `media`

### 实现方式
- 添加 `deletedAt` 字段
- 删除时设置当前时间
- 查询时过滤 `deletedAt IS NULL`
- 恢复时设置 `deletedAt = NULL`

### 垃圾桶功能
- 管理后台可以查看已删除数据
- 通过 `includeDeleted=true` 参数查询
- 支持恢复操作

## 存储设计

### 文件存储路径
```
/uploads/{babyId}/{year}/{month}/{filename}
```

### 示例
```
/uploads/baby-uuid-1/2024/01/1234567890.jpg
/uploads/baby-uuid-1/2024/01/1234567891.mp4
/uploads/baby-uuid-2/2024/02/1234567892.jpg
```

### NAS挂载
```yaml
volumes:
  - ${NAS_MOUNT_PATH}/uploads:/app/uploads
  - ${NAS_MOUNT_PATH}/config:/app/config
  - ${NAS_MOUNT_PATH}/data:/app/data
```

## 性能优化

### 索引策略
1. 主键索引：所有表
2. 外键索引：关联查询
3. 时间索引：时间范围查询
4. 标签索引：GIN索引（数组类型）
5. 软删除索引：过滤已删除数据

### 查询优化
1. 使用分页（limit/offset）
2. 按需加载关联数据
3. 避免N+1查询问题
4. 使用数据库级联删除

## 备份策略

### 数据库备份
```bash
# 手动备份
docker exec babyloom-db pg_dump -U babyloom babyloom > backup.sql

# 自动备份（通过配置）
# backupInterval: daily/weekly/monthly
```

### 文件备份
```bash
# 备份上传目录
rsync -av /share/Container/babyloom/uploads/ /backup/uploads/

# 备份配置文件
rsync -av /share/Container/babyloom/config/ /backup/config/
```

## 扩展建议

### 未来可能添加的表

#### 1. notifications（通知表）
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  userId UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  isRead BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

#### 2. backups（备份记录表）
```sql
CREATE TABLE backups (
  id UUID PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  filePath VARCHAR(500),
  size BIGINT,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

#### 3. settings（系统设置表）
```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  updatedAt TIMESTAMP DEFAULT NOW()
);
```
