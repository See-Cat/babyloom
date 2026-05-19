# P4 — 垃圾桶(Trash Bin)设计文档

**日期**:2026-05-17
**承接**:`2026-05-15-babyloom-v2-rebuild-design.md` §6A
**前置阶段**:P0 / P1 / P2a / P2b / P3 已完成
**面向阶段**:P4 实施计划(writing-plans 阶段输出)

---

## 1. 背景与目标

V1 已建立"移动端常规删除走软删,真删隔离到特权位置"的 UX 不变量。V2 spec §6A 已把"特权位置"挪到主 app 内的 owner-only UI,并把状态机、父链可见性不变量、API 端点全部定义清楚。

P2a / P3 已交付所有支撑 endpoint(`*:trash` / `*:restore` / `*:purge`),P4 任务是把这些 endpoint 接入用户可见的 UI,并把 §6A.4 "父链可见性"从规约升级为 CI 主防线(ESLint rule + 16-item 测试矩阵),避免任何未来 endpoint 漏 join babies 表导致存在性泄露。

**P4 目标**:
1. `/profile/trash` 页面:三 tab(entries / media / babies)+ restore + purge + 清空 tab
2. `GET /api/trash` + `POST /api/trash/empty` 两个新端点(走 §5.7 模板)
3. `babyloom/parent-chain-join` 自定义 ESLint 规则(CI 主防线)
4. §6A.4 16-item 父链矩阵全部对应到测试或显式 `test.skip + 指针注释`
5. 跨页共享 `useTrashAction` hook,统一三个软删入口的 5s 撤销 Toast

---

## 2. 范围 / Non-goals

### 2.1 In scope

| # | 模块 | 内容 |
|---|---|---|
| 1 | `app/api/trash/route.ts` | `GET /api/trash?type&cursor` — 列表,cursor 分页 50/页,editor 仅自己软删的 |
| 2 | `app/api/trash/empty/route.ts` | `POST /api/trash/empty?type` — 批量 purge,owner-only,100/事务 |
| 3 | `app/profile/trash/page.tsx` + `TrashClient.tsx` | UI:三 tab(URL `?type=`)+ 行列表 + 还原/删除 + 二次确认 Modal + 清空 tab 按钮 |
| 4 | `lib/db/queries/trash.ts` | `listTrashed({ type, cursor, viewer })` — 三类资源各一条 query,父链 INNER JOIN babies |
| 5 | `lib/trash/empty.ts` | `bulkPurgeByType` — 复用单点 purge 同一函数,100 分批,baby tab 跳过子资源未清的项 |
| 6 | `lib/hooks/useTrashAction.ts` | 共享 soft-delete + 5s 撤销 toast 调度器;timeline / gallery / `/profile/babies` / `/entry/[id]` 详情统一调它 |
| 7 | `eslint-rules/parent-chain-join.js` | AST 规则 + 8 fixtures + `--print-config` 验证 |
| 8 | `tests/e2e/trash-bin.spec.ts` | 13 个 `/profile/trash` 流程用例 |
| 9 | `tests/e2e/parent-chain-visibility.spec.ts` | §6A.4 16-item 矩阵(复用 P2a/P3 已有 + 新增缺口项) |
| 10 | `tests/integration/trash-list.test.ts` + `trash-empty.test.ts` | 端点级回归 |
| 11 | `tests/unit/parent-chain-join.test.ts` | 8 fixtures + rule loaded 证明 |
| 12 | `actions.ts` + `assert.ts` | 新增 `trash:empty` action(owner-only)+ 矩阵测试一行 |
| 13 | `withAuthorizedResource` wrapper | 加 `kind: 'global'` target 分支(非资源型),7 个回归 |

### 2.2 Non-goals(留 P5+)

- ❌ `baby_member_permissions` 细粒度 override UI
- ❌ 设计打磨 / 暗色模式 / 字号 / 空状态插画
- ❌ 备份/部署(P6)
- ❌ N 天后自动清(spec §6A.1 永久不做)
- ❌ `entry_media` detach 独立 endpoint(spec §6A.3 显式 YAGNI)
- ❌ RSS / 分享出口(spec §12 YAGNI,§6A.4 item 16 不实现)

---

## 3. 架构与数据流

### 3.1 新增文件

```text
app/
├── api/trash/
│   ├── route.ts                       # GET /api/trash
│   └── empty/route.ts                 # POST /api/trash/empty
├── profile/trash/
│   ├── page.tsx                       # RSC, 初始 fetch first page per tab
│   └── TrashClient.tsx                # Client: tab + 翻页 + Modal 状态
lib/
├── db/queries/trash.ts                # listTrashed
├── trash/empty.ts                     # bulkPurgeByType
└── hooks/useTrashAction.ts            # 共享 soft-delete + undo toast
eslint-rules/
└── parent-chain-join.js               # AST rule
tests/
├── e2e/trash-bin.spec.ts
├── e2e/parent-chain-visibility.spec.ts
├── integration/trash-list.test.ts
├── integration/trash-empty.test.ts
└── unit/parent-chain-join.test.ts
```

### 3.2 数据流(restore 路径示意)

```text
TrashClient (tab=media, cursor=null)
  → fetch GET /api/trash?type=media
      → withAuthorizedResource('trash:view', loadTarget={kind:'global'})
          → listTrashed({ type:'media', viewer })
              SELECT m.*, b.name as babyName, u.name as deletedByName
                FROM media m
                INNER JOIN babies b ON b.id = m.babyId         -- §6A.4 父链
                LEFT  JOIN users  u ON u.id = m.deletedBy
                WHERE m.status = 'trashed'
                  AND b.status IN ('active','trashed')
                  AND b.familyId = viewer.familyId
                  AND (viewer.role='owner' OR m.deletedBy = viewer.id)
                ORDER BY m.deletedAt DESC, m.id DESC
                LIMIT 51                                       -- 50 + 1 lookahead
      ← { rows, nextCursor }

User clicks 还原 on a row
  → POST /api/media/[id]/restore          (P3 已有,action='media:restore')
      → 409 if hash collision → { error:'duplicate_in_trash', conflictingMediaId }
  ← 200: 行 removed,success toast '已还原'
  ← 409: toast '此照片与垃圾桶外的版本重复,请先处理'(8s)、行保留
```

### 3.3 5s 撤销 Toast 共享 hook

```ts
// lib/hooks/useTrashAction.ts 草图(真正代码进 plan)
function useTrashAction({ resource }: { resource: 'entry' | 'media' | 'baby' }) {
  return {
    softDelete: async (id: string, contextLabel: string) => {
      await api.post(`/api/${resource}s/${id}/trash`);
      toast.show({
        message: `已删除 · ${contextLabel}`,
        action: {
          label: '撤销',
          onClick: () => api.post(`/api/${resource}s/${id}/restore`),
        },
        durationMs: 5000,
      });
    },
  };
}
```

调用方:
- `TimelineCard` → `useTrashAction({ resource: 'entry' })`
- `GalleryItem` → `useTrashAction({ resource: 'media' })`
- `/profile/babies` 行删除按钮 → `useTrashAction({ resource: 'baby' })`
- `/entry/[id]` 详情页删除按钮 → `useTrashAction({ resource: 'entry' })`

---

## 4. UI 细节(`/profile/trash`)

### 4.1 整体布局

```text
┌─────────────────────────────────────────────────────┐
│  ← /profile           垃圾桶                         │
│                                                     │
│  ╭───────────╮ ╭──────────╮ ╭─────────╮             │  ← 三胶囊 Tag 组
│  │ 日志 (24) │ │ 照片 (8) │ │ 宝宝(1)│            │     当前 accent 填充
│  ╰───────────╯ ╰──────────╯ ╰─────────╯             │
│                                                     │
│              [清空 "日志" 垃圾桶 (24)]              │  ← owner-only,destructive variant
│                                                     │
│  ┌────────────────────────────────────────────┐    │
│  │ 📔 baby-A · 妈妈 · 3 小时前                 │    │
│  │ "今天她第一次说话..."                       │    │
│  │ ╭──────╮  ╭──────╮                          │    │
│  │ │ 还原 │  │ 删除 │                          │    │
│  │ ╰──────╯  ╰──────╯                          │    │
│  └────────────────────────────────────────────┘    │
│  ...                                                │
│                                                     │
│       [加载更多]                                    │
└─────────────────────────────────────────────────────┘
```

### 4.2 设计语言

100% 沿用 spec §7 / animal-island-ui 设计 token:`Button` / `Card` / `Modal` / `Tag` / `Toast` / `BottomSheet` 直接复用 `components/ui/`,P2b 的 `/profile/babies | members | milestones` 已经全部跑在这套体系上,P4 不引入新组件库、不改 token。

### 4.3 Tab 实现

- 不引第三方 Tabs;三个胶囊 `Button` + URL search param `?type=entries|media|babies`(URL-as-state,刷新保留、可分享)
- 默认 tab = `entries`
- Tab 切换 → 客户端重新 fetch `/api/trash?type=...&cursor=null`
- 计数 badge 与初始 fetch 同请求(loader 返回 `total: number` 之外,各 tab 计数也一起出)

### 4.4 行渲染(三 tab polymorphic)

外层共享 `Card`,内部根据 type 分支:

| Tab | 第一行 meta | 第二行内容 | 第三行 |
|---|---|---|---|
| entries | `📔` + baby 名 · deletedBy 名 · 相对时间 | 文案首 80 字符(空时 `text-muted` 占位) | `还原` + `删除`(error variant) |
| media | `📷` + baby 名 · deletedBy 名 · 相对时间 | 64×64 thumb 圆角 + 文件名 | `还原` + `删除` |
| babies | `🐣` + deletedBy 名 · 相对时间 | baby 头像 + 名字 + 子资源未清 count badge(若 > 0) | `还原` + `删除`(子资源未清时灰) |

### 4.5 两个 Modal

1. **单行 purge 确认**:`Modal` 标题"永久删除",副文`此操作不可撤销。"<资源描述>" 将从垃圾桶中移除。`,按钮 `取消`(focus 默认)+ `永久删除`(error variant)
2. **清空 tab 确认**:同上,副文`将永久删除当前 tab 下的 N 项 <类型>。此操作不可撤销。`

### 4.6 Empty state(tab 下 0 项)

```text
   🗑️
当前没有已删除的 <类型>
软删除的 <类型> 会在这里出现,owner 可永久删除或还原
```

### 4.7 Toast 类型

| 触发 | 文案 | 时长 |
|---|---|---|
| 软删发起(timeline / gallery / babies / entry-detail) | `已删除 · <ctx>` + 撤销按钮 | 5s |
| restore 成功(/profile/trash) | `已还原` | 3s |
| purge 成功 | `已永久删除` | 3s |
| restore 409(仅 media) | `此照片与垃圾桶外的版本重复,请先处理` | 8s |
| empty 部分成功 | `已永久删除 N 项,M 项被跳过(原因:子资源未清理)` | 8s |
| purge baby pre-flight 失败(UI 灰按钮跑漏的兜底) | `该宝宝还有 N 项数据未清理,请先清理后再删除` | 5s |

### 4.8 移动端适配

- 顶部 Tag 组 horizontal scroll-snap(防 narrow viewport 溢出)
- 单行 purge Modal → `BottomSheet`(spec §7.3)
- 行按钮组 → 在 < 480px 折叠为右上角 `⋮` 触发 `ActionSheet`(还原 / 永久删除),减少行高、密集列表更舒服

### 4.9 可达性

- Tab 用 `role="tablist"` + `aria-controls`,键盘 ← / → 切换
- Modal 自动 focus 取消按钮(防误触永久删除)
- 列表 `aria-live="polite"`:还原/删除后行移除播报"已还原"/"已永久删除"
- color contrast:purge 灰按钮 + 错误 toast 满足 spec §7 设计 token 的 ≥ 4.5:1 对比度

---

## 5. 后端 API + 父链 ESLint Rule

### 5.1 `GET /api/trash`

```ts
// app/api/trash/route.ts(草图)
export const GET = withAuthorizedResource({
  action: 'trash:view',
  loadTarget: async () => ({ kind: 'global', babyId: null }), // 非资源型,target=family
  allowedStatuses: null,                                      // skip status gate
})(async ({ req, viewer }) => {
  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'entries';
  const cursor = url.searchParams.get('cursor');
  if (!['entries', 'media', 'babies'].includes(type)) return json400('bad type');
  const rows = await listTrashed({ type, cursor, viewer });
  const nextCursor = rows.length > 50
    ? `${rows[50].deletedAt.toISOString()}:${rows[50].id}`
    : null;
  return Response.json({ rows: rows.slice(0, 50), nextCursor });
});
```

### 5.2 `listTrashed` query 模板

```ts
// entries(示意)
db.select({ /* … */ })
  .from(entries)
  .innerJoin(babies, eq(babies.id, entries.babyId))   // §6A.4 父链强制
  .leftJoin(users,  eq(users.id, entries.deletedBy))
  .where(and(
    eq(entries.status, 'trashed'),
    inArray(babies.status, ['active', 'trashed']),     // §6A.4 item 13: 父接受 active/trashed
    eq(babies.familyId, viewer.familyId),              // 跨家庭 404
    viewer.role === 'owner' ? undefined : eq(entries.deletedBy, viewer.id),
    cursor ? lt(entries.deletedAt, cursorDate) : undefined,
  ))
  .orderBy(desc(entries.deletedAt), desc(entries.id))
  .limit(51);
```

`babies` tab 无父链,但仍按 `familyId` 过滤,**并 LEFT JOIN 子查询拿子资源 count** 供 UI 灰按钮判断:

```ts
const activeEntries = sql<number>`
  (SELECT COUNT(*) FROM entries
    WHERE babyId = babies.id AND status = 'active')`;
const readyMedia = sql<number>`
  (SELECT COUNT(*) FROM media
    WHERE babyId = babies.id AND status = 'ready')`;
```

### 5.3 `POST /api/trash/empty`

```ts
export const POST = withAuthorizedResource({
  action: 'trash:empty',
  loadTarget: async () => ({ kind: 'global', babyId: null }),
  allowedStatuses: null,
})(async ({ req, viewer }) => {
  if (viewer.role !== 'owner') return json403();
  const type = new URL(req.url).searchParams.get('type');
  if (!['entries', 'media', 'babies'].includes(type)) return json400('bad type');
  const result = await bulkPurgeByType({ type, familyId: viewer.familyId });
  return Response.json(result); // { purged: number, skipped: { id, reason }[] }
});
```

`bulkPurgeByType`(`lib/trash/empty.ts`):

1. 查所有 `status='trashed'` 且 `familyId` 匹配的 ids
2. 按 100 一批进事务,**每批内对每个 id 调单点 purge 同一函数**(不复制 cascade 逻辑)
3. `type='babies'`:每个 baby purge 前先 assert"子资源全 trashed",失败的项加入 `skipped[]`,继续下一项
4. 单批中途抛错 → 整批回滚,响应里 partial purged count 仍正确(已 commit 的批不受影响)
5. 返回 `{ purged: number, skipped: { id: string, reason: string }[] }`

### 5.4 新增 action

`lib/permissions/actions.ts`:`trash:empty` → owner-only
`lib/permissions/assert.ts`:加 case 与 `trash:view` 同结构(非资源型)
13 矩阵测试(`tests/integration/assert-permission-matrix.test.ts`)加一行

### 5.5 `withAuthorizedResource` 扩展 `kind: 'global'`

wrapper 当前假定 target 有 `babyId` / `resourceId`,需加非资源型分支:
- `loadTarget` 返回 `{ kind: 'global', babyId: null }` → 跳过 status gate、跳过资源 404、仅做 action 权限校验 + 家庭归属
- 7 个回归测试:`trash:view` owner-pass、editor-pass、viewer-fail、`trash:empty` owner-pass、editor-fail、跨家庭 stranger-401、loader 抛错 → 500

### 5.6 ESLint Rule `babyloom/parent-chain-join`

**算法**(AST,无控制流分析):

1. 遍历每个 `CallExpression`,callee 形如 `<X>.from(<arg>)`
2. 检查 `<arg>` 标识符名是否 `media` / `entries`(import 来源是否 `@/lib/db/schema` —— 通过 ImportDeclaration scope 解析,避免同名变量误判)
3. 若是,沿 callee 链向外层 MemberExpression 走:任意 `.innerJoin(babies, ...)` 或 `.leftJoin(babies, ...)` 调用 → pass
4. 链中无 babies join → 检查同行 / 前一行注释 `PARENT-CHAIN-EXEMPT: <非空 reason>` → pass
5. 否则 `report` 节点 `<table>` 位置

**触发位置**:`lib/db/queries/**/*.{ts,tsx}` + `app/api/**/route.ts` + `app/**/page.tsx`
**白名单**:`lib/db/migrations/**` + `tests/**` + `lib/db/schema/**`

**Fixtures**(8 个,4 正向 + 4 负向):

| # | shape | expect |
|---|---|---|
| 1 | `db.select().from(entries).innerJoin(babies, ...)` | pass |
| 2 | `db.select().from(media).innerJoin(babies, ...).leftJoin(users, ...)` | pass |
| 3 | `// PARENT-CHAIN-EXEMPT: count-only aggregation\n db.select({count: ...}).from(media)` | pass |
| 4 | `db.select().from(babies)`(无父链豁免名单) | pass |
| 5 | `db.select().from(entries).where(...)`(无 join) | **fail** |
| 6 | 同文件别处有 `from(babies).innerJoin(media)`,本处 `from(media)` 单独无 join | **fail**(每查询独立) |
| 7 | `// PARENT-CHAIN-EXEMPT:\n db.select().from(entries)`(空 reason) | **fail** |
| 8 | `db.select().from(media).innerJoin(family_members, ...)`(join 错表) | **fail** |

`eslint.config.mjs`:加 `'babyloom/parent-chain-join': 'error'`
`pnpm lint --print-config app/api/trash/route.ts | grep parent-chain-join` 验证规则确实加载(P1 round-11 教训)

---

## 6. 测试矩阵

### 6.1 §6A.4 16-item 父链可见性矩阵

| # | 出口 | P4 落地 | 复用 / 新增 |
|---|---|---|---|
| 1 | `/timeline` RSC | `parent-chain-visibility.spec.ts::timeline-hides-trashed-baby` | 复用 P2a + baby trashed case |
| 2 | `/gallery` RSC | `…::gallery-hides-trashed-baby` | 复用 P3 + case |
| 3 | `/calendar` RSC | `…::calendar-hides-trashed-baby` | 复用 P2a |
| 4 | `/entry/[id]` RSC(entry 本身) | `…::entry-detail-404-when-baby-trashed` | 复用 P2a |
| 4b | `/entry/[id]` 关联媒体列表 | `…::entry-detail-hides-attached-media-when-media-baby-trashed` | **新增**(P3 未覆盖跨 baby 父链清洗) |
| 5 | `GET /api/media/[id]` | `media-route.test.ts::404-when-baby-trashed` | 复用 P3 |
| 6 | `GET /api/media/[id]/status` | 同 status route | 复用 P3 |
| 7 | `POST /api/media/[id]/trash` | 同 trash route | 复用 P3 |
| 8 | `POST /api/media/[id]/restore` | 同 restore route | 复用 P3 |
| 9 | `DELETE /api/media/[id]`(purge) | `…::purge-404-when-baby-purged-but-parent-trashed-allowed` | **新增** |
| 10 | `POST /api/entries/[id]/trash` | `entry-trash.test.ts` | 复用 P2a + missing case |
| 11 | `POST /api/entries/[id]/restore` | 同 | 复用 P2a |
| 12 | `DELETE /api/entries/[id]`(purge) | 同 | 复用 P2a |
| 13 | `GET /api/trash` | `trash-list.test.ts` | **新增**(P4 主体) |
| 14 | 备份 manifest | `backup-manifest.test.ts::skip-purged-and-trashed-parent` | **桩位 `test.skip` + 指针**(P6 backup 才有,P4 不丢挂点) |
| 15 | 媒体物理路径 | `media-path.test.ts::reject-purged-row` | 复用 P3 |
| 16 | RSS / 分享 | **N/A**,加单元注释指针说明 §12 YAGNI 决策 |

### 6.2 `/profile/trash` E2E(`tests/e2e/trash-bin.spec.ts`)

1. owner 软删 entry → toast 5s 内可撤销 → 撤销成功
2. owner 软删 entry → 5s 后 toast 消失 → /profile/trash 看到 → 还原成功
3. owner /profile/trash → 单项 purge → Modal 确认 → 行消失,DB 行 `status='purged'`
4. editor 看 /profile/trash → 仅显示 editor 自己软删的(seed:editor 删 1 + owner 删 1 → editor 视图 1,owner 视图 2)
5. editor 看 /profile/trash → 自己软删的 entry purge 行为(按 §5.2 矩阵实际决策来,见 §8 对账)
6. owner /profile/trash tab=babies → baby 行 purge 灰 + tooltip(子资源 count > 0)
7. owner 先 trash baby 下所有子资源 → babies tab → purge 亮 → 成功
8. owner /profile/trash tab=media → restore 同 hash 已重传的图 → 409 toast + 行保留
9. owner 顶部 `清空 日志 垃圾桶 (3)` → Modal 确认 → 3 项消失,日志 `batch_size=3`
10. cursor 翻页:seed 60 项 → 第一页 50 + 加载更多 → 第二页 10 + 按钮消失
11. URL `/profile/trash?type=media` 直接命中 media tab
12. viewer 访问 /profile/trash → 按 §5.2 实际矩阵处理(若 viewer 无 `trash:view` 则 redirect / 401)
13. 跨家庭 stranger 拿 owner 软删 entry id 调 /api/entries/[id]/restore → 404(P1 防御回归)

### 6.3 ESLint rule 单测(`tests/unit/parent-chain-join.test.ts`)

- 8 fixtures(§5.6 表)逐项 run-rule-against-source
- `--print-config` 验证 `eslint.config.mjs` 加载 `babyloom/parent-chain-join`
- `pnpm lint` 全仓库:期望 0 violations。若现有 P2a/P3 query 有漏 join 的,P4 plan 同步补 join 或加 `PARENT-CHAIN-EXEMPT` 注释 + reason

### 6.4 `bulkPurge` 集成(`tests/integration/trash-empty.test.ts`)

- 250 项 seed → 期望分 3 批(100 + 100 + 50)
- 其中 50 项是 baby 且子资源未 trashed → 期望 `skipped[]` 含 50 项,`purged` 不含
- 模拟第二批中途抛错 → 第一批 100 已 commit,第二批回滚,响应里 `purged=100`、第三批仍执行

---

## 7. 验收(Acceptance)

P4 plan 末尾 `## Acceptance` 复用此清单:

1. ✅ `pnpm lint` 通过,`babyloom/parent-chain-join` 在 `--print-config` 中可见
2. ✅ `pnpm test` 通过(integration + unit 全绿,含 8 个 ESLint fixture + bulkPurge 集成)
3. ✅ `pnpm playwright test` 通过(`trash-bin.spec.ts` 13 用例 + `parent-chain-visibility.spec.ts` 16-item 矩阵)
4. ✅ owner `/profile/trash` 能完成软删 → 撤销 → 还原 → purge → 清空 tab 全流程
5. ✅ editor 视图严格收窄到自己软删的,跨家庭 stranger 一律 404
6. ✅ 三个软删入口(timeline / gallery / `/profile/babies` / `/entry/[id]`)统一调 `useTrashAction`,5s 撤销 toast 行为一致
7. ✅ 媒体 restore 409 UI + server 双侧覆盖
8. ✅ purge baby 子资源未清时 UI 灰按钮 + server 409 双重防御
9. ✅ Spec ↔ Impl ↔ Plan 三方对账完成(§8 清单已跑过)
10. ✅ §6A.4 16-item 矩阵每行有测试或显式 `test.skip + 指针注释`

---

## 8. Spec ↔ Impl 对账要点(plan 落笔前必做)

P1 round-10 永久原则:**plan 落笔前先 grep 真实 schema/接口,不能只读 spec**。P4 plan 头部必须声明"基于 P0–P3 实施层 X 假设",并在 Task 0 跑以下命令对账:

```bash
grep -rn 'deletedBy\|deletedAt\|purgedAt\|purgedBy' lib/db/schema/
grep -rn "'trash:view'\|'trash:empty'\|'entry:purge'\|'media:purge'\|'baby:purge'" lib/permissions/
grep -rn "kind:.*'global'\|loadTarget" lib/permissions/
ls app/api/{entries,media,babies}/'[id]'/{trash,restore}/route.ts
grep -rn "'editor'.*'entry:purge'\|'editor'.*'media:purge'" lib/permissions/  # editor 能否 purge 自己的
```

**冲突处理原则**:spec 是"应当如此",P0–P3 实施可能已经偏离;若 P4 spec ↔ impl 冲突,**改 spec 跟实现走**,不要硬把 impl 改成 spec 描述(避免回退已交付的决策)。typical 冲突点:

- `withAuthorizedResource` 是否已支持 `kind: 'global'`:若已支持则 §5.5 不需 wrapper 扩展;若不支持则进 plan
- editor 是否能 purge 自己软删的 entry/media:`actions.ts` 矩阵是唯一权威
- `trash:view` viewer 是否允许:同上,§5.2 表与 actions.ts 对账
- bulkPurge 复用的"单点 purge 函数"是否已抽出为可复用 lib(P2a/P3 可能写在 route handler 里):若未抽,P4 Task 加一步 refactor 抽出 `lib/trash/purge.ts`

---

## 9. 与 P5+ 的接口

| 项 | 阶段 | P4 留给后续的挂点 |
|---|---|---|
| `baby_member_permissions` override UI | P5 或更后 | schema 已存在(P1)、UI 不动 |
| 视觉打磨(暗色/字号/空状态插画) | P5 | trash 页 token 100% 复用,P5 可整体扫一遍而无需特殊处理 |
| 备份 manifest 测试 | P6 | §6A.4 item 14 `test.skip` 占位 + 指针注释 |
| 自动清理(N 天后) | 永不做 | spec §6A.1 永久决策 |
| RSS / 分享出口 | 永不做 | spec §12 YAGNI,§6A.4 item 16 不实现 |

---

**下一步**:本 spec 经用户 review 后,进入 writing-plans 阶段,产出 `docs/superpowers/plans/2026-05-17-P4-trash-bin.md` 实施计划。
