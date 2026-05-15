# BabyLoom API 文档

## 基础信息

- **Base URL**: `http://your-nas-ip/api`
- **认证方式**: Bearer Token (JWT)
- **Content-Type**: `application/json`

## 认证

所有 API（除了登录）都需要在请求头中携带 Token：

```
Authorization: Bearer {your-jwt-token}
```

---

## 1. 认证模块

### 1.1 用户登录

```http
POST /api/auth/login
```

**请求体：**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**响应：**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "nickname": "管理员",
    "username": "admin",
    "role": "admin",
    "avatar": null
  }
}
```

**错误响应：**
```json
{
  "statusCode": 401,
  "message": "Invalid credentials"
}
```

---

## 2. 用户模块

### 2.1 获取用户列表

```http
GET /api/users
```

**查询参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| includeDeleted | boolean | 否 | 是否包含已删除用户（默认false） |

**响应：**
```json
[
  {
    "id": "uuid",
    "username": "mom",
    "nickname": "妈妈",
    "role": "member",
    "avatar": null,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

### 2.2 获取用户详情

```http
GET /api/users/{id}
```

**响应：**
```json
{
  "id": "uuid",
  "username": "mom",
  "nickname": "妈妈",
  "role": "member",
  "avatar": null,
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### 2.3 创建用户（管理后台）

```http
POST /api/users
```

**请求体：**
```json
{
  "username": "dad",
  "password": "password123",
  "nickname": "爸爸",
  "role": "member",
  "relation": "dad"
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 登录账号，唯一 |
| password | string | 是 | 密码 |
| nickname | string | 是 | 显示昵称 |
| role | string | 否 | 角色：admin/member（默认member） |
| relation | string | 否 | 关系：mom/dad/grandma/grandpa/other |
| avatar | string | 否 | 头像URL |
| isActive | boolean | 否 | 是否启用（默认true） |

**响应：**
```json
{
  "id": "uuid",
  "username": "dad",
  "nickname": "爸爸",
  "role": "member",
  "avatar": null,
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### 2.4 更新用户

```http
PUT /api/users/{id}
```

**请求体：**
```json
{
  "nickname": "新昵称",
  "password": "newpassword",
  "isActive": true
}
```

**注意：**
- 密码修改时会自动加密
- 不能修改 username

### 2.5 软删除用户

```http
DELETE /api/users/{id}
```

**响应：** 204 No Content

### 2.6 恢复已删除用户

```http
POST /api/users/{id}/restore
```

**响应：**
```json
{
  "id": "uuid",
  "username": "dad",
  "nickname": "爸爸",
  "role": "member",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

---

## 3. 宝宝模块

### 3.1 获取宝宝列表

```http
GET /api/baby
```

**响应：**
```json
[
  {
    "id": "baby-uuid",
    "name": "小橘子",
    "avatar": null,
    "birthDate": "2025-09-15",
    "gender": "girl",
    "storagePath": "/uploads",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "babyUsers": [
      {
        "id": "relation-uuid",
        "relation": "mom",
        "canCreate": true,
        "canDelete": false,
        "canEdit": true,
        "user": {
          "id": "user-uuid",
          "nickname": "妈妈",
          "avatar": null
        }
      }
    ]
  }
]
```

### 3.2 获取宝宝详情

```http
GET /api/baby/{id}
```

### 3.3 创建宝宝

```http
POST /api/baby
```

**请求体：**
```json
{
  "name": "小橘子",
  "birthDate": "2025-09-15",
  "gender": "girl",
  "avatar": null
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 宝宝姓名 |
| birthDate | string | 是 | 出生日期（YYYY-MM-DD） |
| gender | string | 否 | 性别：boy/girl |
| avatar | string | 否 | 头像URL |

### 3.4 更新宝宝

```http
PUT /api/baby/{id}
```

**请求体：**
```json
{
  "name": "新名字",
  "avatar": "https://..."
}
```

### 3.5 删除宝宝

```http
DELETE /api/baby/{id}
```

**注意：** 删除宝宝会级联删除所有关联的记录和媒体文件

---

## 4. 宝宝成员关联模块

### 4.1 获取关联列表

```http
GET /api/baby-users
```

**查询参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| babyId | string | 否 | 按宝宝筛选 |
| userId | string | 否 | 按用户筛选 |

**响应：**
```json
[
  {
    "id": "relation-uuid",
    "babyId": "baby-uuid",
    "userId": "user-uuid",
    "relation": "mom",
    "canCreate": true,
    "canDelete": false,
    "canEdit": true,
    "baby": {
      "id": "baby-uuid",
      "name": "小橘子"
    },
    "user": {
      "id": "user-uuid",
      "nickname": "妈妈",
      "avatar": null
    }
  }
]
```

### 4.2 创建关联

```http
POST /api/baby-users
```

**请求体：**
```json
{
  "babyId": "baby-uuid",
  "userId": "user-uuid",
  "relation": "mom",
  "canCreate": true,
  "canDelete": false,
  "canEdit": true
}
```

### 4.3 更新关联（修改权限）

```http
PUT /api/baby-users/{id}
```

**请求体：**
```json
{
  "canCreate": true,
  "canDelete": true,
  "canEdit": true
}
```

### 4.4 删除关联

```http
DELETE /api/baby-users/{id}
```

---

## 5. 记录模块

### 5.1 获取记录列表

```http
GET /api/entries
```

**查询参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| babyId | string | 否 | 按宝宝筛选 |
| startDate | string | 否 | 开始日期（YYYY-MM-DD） |
| endDate | string | 否 | 结束日期（YYYY-MM-DD） |
| tags | string[] | 否 | 按标签筛选 |
| page | number | 否 | 页码（默认1） |
| limit | number | 否 | 每页数量（默认20） |
| includeDeleted | boolean | 否 | 是否包含已删除（默认false） |

**响应：**
```json
{
  "items": [
    {
      "id": "entry-uuid",
      "content": "宝宝第一次翻身了！",
      "tags": ["第一次翻身"],
      "babyId": "baby-uuid",
      "createdBy": "user-uuid",
      "createdAt": "2024-01-01T10:30:00Z",
      "updatedAt": "2024-01-01T10:30:00Z",
      "media": [
        {
          "id": "media-uuid",
          "type": "photo",
          "url": "/uploads/baby-uuid/2024/01/1234567890.jpg",
          "thumbnail": null,
          "size": 1024000
        }
      ],
      "creator": {
        "id": "user-uuid",
        "nickname": "妈妈"
      }
    }
  ],
  "total": 100
}
```

### 5.2 获取已删除记录（垃圾桶）

```http
GET /api/entries/trash
```

**查询参数：** 同 5.1

**响应：** 同 5.1，但只返回已删除的记录

### 5.3 获取记录详情

```http
GET /api/entries/{id}
```

### 5.4 创建记录

```http
POST /api/entries
```

**请求体：**
```json
{
  "babyId": "baby-uuid",
  "content": "宝宝第一次翻身了！",
  "tags": ["第一次翻身"],
  "media": [
    {
      "id": "media-uuid"
    }
  ]
}
```

**注意：**
- `createdBy` 自动从 Token 中获取
- 需要先上传媒体文件，再创建记录

### 5.5 更新记录

```http
PUT /api/entries/{id}
```

**请求体：**
```json
{
  "content": "更新后的内容",
  "tags": ["新标签"]
}
```

### 5.6 软删除记录

```http
DELETE /api/entries/{id}
```

**注意：**
- 客户端调用会软删除（记录还在，但客户端不可见）
- 记录 `deletedBy` 字段

### 5.7 恢复已删除记录

```http
POST /api/entries/{id}/restore
```

### 5.8 获取日历数据

```http
GET /api/entries/calendar/{year}/{month}
```

**示例：**
```http
GET /api/entries/calendar/2024/5
```

**响应：**
```json
[
  "2024-05-01T10:30:00Z",
  "2024-05-03T14:20:00Z",
  "2024-05-07T09:00:00Z"
]
```

---

## 6. 媒体模块

### 6.1 获取媒体列表

```http
GET /api/media
```

**查询参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| entryId | string | 否 | 按记录筛选 |
| babyId | string | 否 | 按宝宝筛选 |
| type | string | 否 | 类型：photo/video |

### 6.2 上传文件

```http
POST /api/media/upload
```

**请求类型：** `multipart/form-data`

**请求参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | 文件（图片或视频） |
| babyId | string | 是 | 宝宝ID |
| entryId | string | 否 | 关联的记录ID |

**响应：**
```json
{
  "id": "media-uuid",
  "type": "photo",
  "url": "/uploads/baby-uuid/2024/01/1234567890.jpg",
  "babyId": "baby-uuid",
  "entryId": null,
  "size": 1024000,
  "createdAt": "2024-01-01T10:30:00Z"
}
```

**注意：**
- 文件存储路径：`/uploads/{babyId}/{year}/{month}/{filename}`
- 最大文件大小：50MB（可在配置中修改）

### 6.3 软删除媒体

```http
DELETE /api/media/{id}
```

### 6.4 恢复已删除媒体

```http
POST /api/media/{id}/restore
```

---

## 7. 里程碑模块

### 7.1 获取里程碑列表

```http
GET /api/milestones
```

**响应：**
```json
[
  {
    "id": "milestone-uuid",
    "name": "第一次翻身",
    "description": "宝宝第一次自己翻身",
    "icon": "🔄",
    "entries": [
      {
        "id": "entry-uuid",
        "content": "宝宝第一次翻身了！",
        "createdAt": "2024-01-01T10:30:00Z"
      }
    ]
  }
]
```

### 7.2 创建里程碑

```http
POST /api/milestones
```

**请求体：**
```json
{
  "name": "第一次翻身",
  "description": "宝宝第一次自己翻身",
  "icon": "🔄"
}
```

### 7.3 更新里程碑

```http
PUT /api/milestones/{id}
```

### 7.4 删除里程碑

```http
DELETE /api/milestones/{id}
```

---

## 数据模型

### User（用户）
```json
{
  "id": "uuid",
  "username": "登录账号",
  "nickname": "显示昵称",
  "role": "admin|member",
  "avatar": "头像URL",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z",
  "deletedAt": null
}
```

### Baby（宝宝）
```json
{
  "id": "uuid",
  "name": "宝宝姓名",
  "avatar": "头像URL",
  "birthDate": "2025-09-15",
  "gender": "boy|girl",
  "storagePath": "/uploads",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### BabyUser（关联）
```json
{
  "id": "uuid",
  "babyId": "baby-uuid",
  "userId": "user-uuid",
  "relation": "mom|dad|grandma|grandpa|other",
  "canCreate": true,
  "canDelete": false,
  "canEdit": true,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Entry（记录）
```json
{
  "id": "uuid",
  "babyId": "baby-uuid",
  "content": "记录内容",
  "tags": ["标签1", "标签2"],
  "createdBy": "user-uuid",
  "media": [Media],
  "createdAt": "2024-01-01T10:30:00Z",
  "updatedAt": "2024-01-01T10:30:00Z",
  "deletedAt": null,
  "deletedBy": null
}
```

### Media（媒体）
```json
{
  "id": "uuid",
  "entryId": "entry-uuid",
  "babyId": "baby-uuid",
  "type": "photo|video",
  "url": "/uploads/baby-uuid/2024/01/123.jpg",
  "thumbnail": "缩略图URL",
  "duration": 0,
  "size": 1024000,
  "createdAt": "2024-01-01T10:30:00Z",
  "deletedAt": null
}
```

### Milestone（里程碑）
```json
{
  "id": "uuid",
  "name": "里程碑名称",
  "description": "描述",
  "icon": "图标",
  "entries": [Entry],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

---

## 错误码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 204 | 删除成功 |
| 400 | 请求参数错误 |
| 401 | 未授权（Token无效或过期） |
| 403 | 禁止访问（权限不足） |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 开发建议

### 前端请求封装示例

```typescript
// api/client.ts
const API_BASE = 'http://your-nas-ip/api';

async function request(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

// 使用示例
const entries = await request('/entries?babyId=xxx&page=1');
```

### 文件上传示例

```typescript
async function uploadFile(file: File, babyId: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('babyId', babyId);
  
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE}/media/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
  
  return response.json();
}
```
