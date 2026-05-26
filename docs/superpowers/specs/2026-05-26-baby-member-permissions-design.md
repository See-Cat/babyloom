# 成员管理与宝宝权限重设计

**日期**：2026-05-26
**状态**：草案，待用户复核
**作者**：与主理人共同 brainstorm

## 1. 背景与动机

当前"家庭成员"页（`/profile/members`）将成员的权限表达为一个一维的 `editor / viewer` 角色，所有宝宝共享同一档权限。在多宝宝家庭里这不够用 —— 比如"爷爷对哥哥可编辑、对妹妹仅查看"这种真实诉求无法表达。

数据库层早已支持每"成员 × 宝宝"的三 bit 权限（`baby_member_permissions.canRead / canWrite / canDelete`），并配有一张独立的矩阵管理页 `/profile/members/permissions`。该矩阵页移动端窄屏体验不佳，且只能"先建成员再配权限"，与"建成员"这一最常见动机割裂。

本设计将权限管理**内联进成员管理页**，采用"记录式"组织：每条 `baby_member_permissions` 行被呈现为一条可读的关联记录。同时退役旧矩阵页。

## 2. 设计铁律

1. **主理人 = 全局最高权限**，对所有宝宝拥有所有权限，永远不出现在 `baby_member_permissions` 表里
2. **新宝宝加入时默认不关联任何非主理人成员**
3. **关联记录是显式的**：行的存在 = 关联存在；行不存在 = 未关联（无任何权限）

## 3. 数据模型

### 3.1 `baby_member_permissions`（无变更）

```ts
{
  id, babyId, familyMemberId,
  canRead, canWrite, canDelete  // 三个 0/1 bit
}
// uniqueIndex (babyId, familyMemberId)
```

UI 暴露的权限只有两档，DB 编码如下：

| UI 档位 | canRead | canWrite | canDelete |
|---|---|---|---|
| 仅查看 | 1 | 0 | 0 |
| 可编辑 | 1 | 1 | 1 |
| 未关联 | （行不存在） | | |

三个 bit 全保留，为未来细分留口子，UI 不动表。

### 3.2 `family_members.role` 收敛为二态

**变更**：取值从 `'owner' | 'editor' | 'viewer'` 收敛为 `'owner' | 'member'`。

理由：旧 `editor / viewer` 的权限语义已完全由 `baby_member_permissions` 表达；保留双语义会造成"一个成员两处权限来源"，徽章和实际权限可能不符，误导用户。

迁移：当前非主理人成员表为空（用户确认"还没创建成员"），无数据迁移成本。

附带逻辑变更：
- 旧 `defaultBits(role)` 兜底（缺失行 → 按 role 推断权限）**删除**
- 所有权限断言改为"严格查表"：`baby_member_permissions` 没有对应行 = 无权限（主理人除外，断言代码遇 owner 直接放行）

## 4. 页面与路由

### 4.1 重命名

- 页面标题 `家庭成员` → **`成员管理`**
- "我的"页里指向该页的入口卡片名同步改为 `成员管理`
- 路由 `/profile/members` 保持不变

### 4.2 退役旧矩阵页

删除：
- `app/profile/members/permissions/page.tsx`
- `app/profile/members/permissions/actions.ts`
- `MembersAdminClient.tsx` 中指向 `/profile/members/permissions` 的"宝宝权限" Link 入口

### 4.3 成员管理页结构（自上而下）

1. AppShell 顶栏：← 返回 + 标题"成员管理"
2. 成员列表（**过滤掉主理人** — `role !== 'owner'`）
3. "+ 添加成员"按钮（沿用现有 Card + 展开式表单）

空状态：列表为空时显示"还没有家人加入"+ 图标，"+ 添加成员"按钮照常显示。

## 5. 成员卡片（A 方案：内联展开）

### 5.1 视觉结构

```
┌─────────────────────────────────────────┐
│ [头像] 爷爷                          ⋯ │
│        @grandpa                          │
│  ────────────────────────────────────   │
│  [宝宝头像] 哥哥        [可编辑]         │
│  [宝宝头像] 妹妹        [仅查看]         │
│                                          │
│  [+ 关联宝宝]                            │
└─────────────────────────────────────────┘
```

- 卡片顶部不显示权限徽章（避免 §3.2 提到的"两处真相"误导）
- 关联记录区按 `baby_member_permissions` 行渲染，仅包含 `babies.status='active'` 的宝宝
- 无关联记录时该区为空，仅留"+ 关联宝宝"按钮

### 5.2 交互

| 触点 | 行为 |
|---|---|
| 点单条关联记录 | 弹底部 `ActionSheet`：「改为 仅查看 / 可编辑」（当前档隐藏）+「解除关联」（destructive） |
| 点 "+ 关联宝宝" | 弹底部 sheet（详见 §7） |
| 点右上角 ⋯ | 弹底部 `ActionSheet`：「重置密码」+「移除成员」（destructive） |

### 5.3 "+ 关联宝宝" 按钮的 disabled 条件

- 家里 0 个 active 宝宝 → disabled + 灰字"请先在『宝宝管理』中添加宝宝"
- 该成员已关联全部 active 宝宝 → disabled + 灰字"已关联全部宝宝"

## 6. 创建成员表单

`Card` 内展开的表单字段（自上而下）：

1. 用户名 `Input`（regex `^[a-zA-Z0-9_-]{3,50}$`）
2. 昵称 `Input`（非空）
3. 初始密码 `PasswordInput`（≥ 8）
4. **关联宝宝区块**（新增，详见 §6.1）
5. 操作按钮："创建" / "取消"

**移除**：原表单顶部那个 `可编辑 / 仅查看` SegmentedControl（语义随 role 字段收敛被剥离）。

### 6.1 关联宝宝区块

根据家里 active 宝宝数量呈现：

- **0 个宝宝**：整个区块隐藏。仅创建账号，不写关联。
- **1 个宝宝**：一行 checkbox（默认勾选）+ 全局权限 SegmentedControl（`仅查看 / 可编辑`，默认 `可编辑`）。
- **N 个宝宝**：多选 checkbox 列表 + 单一全局权限 SegmentedControl（应用于所有勾选的宝宝）。

用户取消勾选所有宝宝时，仅创建账号、不写任何关联记录。

> 决定：批量关联时**一个全局权限**应用到所选宝宝，不支持逐宝宝独立配权。事后想细分到卡片里逐条改即可（YAGNI 取舍）。

## 7. 关联 Sheet（添加场景）

底部弹出 sheet（沿用现有 sheet 模式），用于成员卡片上点 "+ 关联宝宝" 时：

- 标题"关联宝宝"
- 显示该成员**尚未关联**的 active 宝宝列表（checkbox 多选）
- 全局权限 SegmentedControl（`仅查看 / 可编辑`，默认 `可编辑`）
- "确认"（disabled 当未勾选任何宝宝）/ "取消"

> 编辑场景不走此 sheet，直接用 §5.2 的 ActionSheet 改档/解除。

## 8. API

新增三条 REST endpoint（替代旧 server action）：

```
POST   /api/family-members/:memberId/baby-permissions
  body: { babyIds: string[], permission: 'viewer' | 'editor' }
  → 批量创建或 upsert 关联记录（对应 §6 创建表单与 §7 添加 sheet 的批量提交）

PATCH  /api/family-members/:memberId/baby-permissions/:babyId
  body: { permission: 'viewer' | 'editor' }
  → 单条权限改档

DELETE /api/family-members/:memberId/baby-permissions/:babyId
  → 解除单条关联（删行）
```

### 8.1 权限与校验

- 所有 endpoint 均经 `assertPermission(userId, 'member:manage')` —— 仅主理人可执行
- 入参 Zod 校验；失败 → 400 `{ error: 'invalid_request' }`
- 试图操作 `role='owner'` 的目标成员 → 400 `{ error: 'invalid_request' }`（不允许给主理人写关联记录）
- 试图操作非 active 宝宝 → 400 `{ error: 'invalid_request' }`
- 未认证 → 401；认证但非主理人 → 403

### 8.2 现有 endpoint 扩展

`POST /api/family-members`（创建成员）body 扩展，可选字段：

```ts
babyAssociations?: {
  babyIds: string[];
  permission: 'viewer' | 'editor';
}
```

服务端在同一事务内完成"建账号 + 写关联记录"，避免账号建成但关联写失败的中间态。`babyAssociations` 缺省或 `babyIds` 为空数组时，仅建账号。

`GET /api/family-members` 响应每个 member 附带：

```ts
babyPermissions: Array<{
  babyId: string;
  babyName: string;
  babyAvatarUrl: string | null;
  permission: 'viewer' | 'editor';
}>
```

仅包含 `babies.status='active'` 的宝宝，按 `babies.createdAt` 升序。

### 8.3 副作用

- 所有写操作后 `revalidatePath('/profile/members')`
- 关键操作（建立关联 / 解除关联 / 改档）写 info 日志：`actorUserId, familyMemberId, babyId, permission`

## 9. 权限断言改造

`lib/permissions/assert.ts` 及相关 query 中所有依赖 `defaultBits(role)` 的兜底逻辑删除。

新规则统一为：

```ts
if (member.role === 'owner') return; // 全局放行
const row = await db.select().from(babyMemberPermissions)
  .where(and(
    eq(babyMemberPermissions.familyMemberId, member.id),
    eq(babyMemberPermissions.babyId, babyId)
  )).get();
if (!row) throw new ForbiddenError(); // 未关联 = 无权限
// 然后根据 canRead/canWrite/canDelete bit 判定具体动作
```

### 9.1 "可编辑"的语义边界

`canWrite=1, canDelete=1`（即 UI 上的"可编辑"）= **该宝宝下所有内容的全权限**，**不限制内容作者**。

具体地：
- 爷爷对哥哥"可编辑" → 可以编辑/删除任何家人（包括妈妈、其他成员）创建的关于哥哥的 entry、上传的关于哥哥的 media
- 旧 `checkOwnershipMatrix` 里 `authorId === userId`、`uploadedBy === userId`、`deletedBy === userId` 这类"只能动自己的"限制全部删除

理由：
- 家庭场景信任度高，"可编辑"应符合用户对字面意思的直觉
- 删除走 trash 软删，主理人随时可恢复，误删风险可承受
- 主理人始终可通过日志审计

### 9.2 owner-only 操作不受影响

`OWNER_ONLY_ACTIONS`（`baby:write`、`baby:trash`、`baby:purge`、`member:manage`、`family:manage`、`milestone:manage`、`system:logs`、`system:backup`、`entry:purge`、`media:purge`、`trash:empty` 等）仍然只允许主理人执行，与 per-baby 权限无关。

## 10. 组件复用与新增

**复用现有**：
- `AppShell`、`Card`、`Input`、`PasswordInput`、`Button`、`SegmentedControl`
- `ActionSheet`（用于卡片 ⋯ 菜单与关联记录编辑）
- `Dialog`（用于重置密码、移除成员的二次确认）
- `FamilyMemberList` —— 需要改造为支持渲染关联记录区与 "+ 关联宝宝" 按钮

**新增**：
- 关联宝宝多选 sheet 组件（包于 `FamilyMemberList` 旁，复用 `ActionSheet` 底部 sheet 模式或新建 `BabyAssociationSheet`）
- 单条关联记录小行组件（头像 + 名字 + 权限 chip）

## 11. 测试策略

### 单元
- `lib/db/queries/permissions.ts` 新增/扩展的 upsert / delete / list 函数
- Zod schema 入参校验
- 权限断言新规则（无行 → 拒绝；主理人 → 放行；bit 不足 → 拒绝）

### 集成
- 三条 API endpoint 的 happy path
- 非主理人 → 403
- 校验失败 → 400
- 主理人作为 target → 400
- 非 active 宝宝作为 target → 400
- 成员被删除 → CASCADE 清除其所有关联
- 宝宝被 purge → CASCADE 清除其所有关联

### 组件
- `FamilyMemberList` 在 0 / 1 / 多关联三种状态下的渲染
- 关联记录点击 → ActionSheet 选项正确
- "+ 关联宝宝" 在 0 active 宝宝 / 已关联全部 / 仍有可选 三状态的呈现
- 创建表单关联区块在 0 / 1 / N 宝宝下的形态

### E2E（Playwright）
- 登录主理人 → 进入"成员管理" → 创建带关联的成员（多选 + 全局权限）→ 验证列表显示
- 点关联记录改档 → 验证持久化
- 解除关联 → 验证卡片回到无关联状态
- 非主理人登录 → 进入 `/profile/members` → 验证 403 或自动重定向

## 12. 范围外（明确不做）

- 反向视图（"宝宝设置"页里管理"谁能访问这个宝宝"）—— 留作未来反向入口
- 批量关联时逐宝宝独立配权限 —— YAGNI，事后逐条改即可
- 权限审计日志的 UI 浏览 —— 日志已记录，UI 浏览功能不在本期
- 主理人转移
- 三档及以上权限粒度（DB 已留口子）
- 主理人在 app 内修改自己账号密码（按用户决定，密码来源于 `data/config.yaml`）

## 13. 迁移与回滚

### 迁移
1. SQL：`ALTER TABLE family_members` —— 将 role 列的应用层约束收敛到 `'owner' | 'member'`（无需 schema-level CHECK 改动，应用层校验即可）。当前非主理人记录为空，无数据回填。
2. 删除旧矩阵页路由与 actions 文件。
3. 移除旧 `defaultBits(role)` 兜底逻辑。

### 回滚
设计为可独立部署。如需回滚：
1. 恢复 `/profile/members/permissions` 路由与 actions
2. 恢复 `MembersAdminClient` 的旧"宝宝权限"链接
3. role 字段保留 `editor / viewer` 取值即可继续工作（已有数据兼容）

## 14. 关键决定汇总

| 决定 | 取值 |
|---|---|
| 权限维度 | 成员 × 宝宝（多对多 + 每对一档权限） |
| 主入口 | 成员维度（在成员卡片里展开关联记录） |
| 权限档位 | 仅查看 / 可编辑（DB 三 bit 保留） |
| UI 形态 | 卡片内联展开 + 单条关联记录 |
| 主理人在列表 | 完全隐藏 |
| 创建流程 | 表单内嵌关联区块，一步到位 |
| 批量关联 | 多选宝宝 + 一个全局权限 |
| 新宝宝默认关联 | 不关联任何非主理人成员 |
| `role` 字段 | 收敛为 `owner / member` 二态 |
| 旧矩阵页 | 删除 |
| 页面标题 | "成员管理" |
