# Fixed Account Avatar Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a randomly allocated default-avatar color per account while avoiding duplicate colors within the first eight family accounts.

**Architecture:** Add a nullable `user.avatar_color` column for upgrade compatibility, centralize the eight valid color keys and server-side allocation, and fill missing colors during owner bootstrap. UI components receive the persisted color explicitly while baby avatars retain their existing hash-based fallback.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM, SQLite, React, Vitest

## Global Constraints

- Use only the existing eight avatar design tokens.
- Do not change uploaded-avatar behavior.
- Do not change baby avatar allocation.
- Existing installations receive colors automatically on the next startup.

---

### Task 1: Persist and allocate account colors

**Files:**
- Create: `lib/shared/avatar-colors.ts`
- Create: `lib/server/members/avatar-color.ts`
- Create: `lib/server/db/migrations/0006_user_avatar_color.sql`
- Create: `lib/server/db/migrations/user-avatar-color-migration.test.ts`
- Modify: `lib/server/db/migrations/meta/_journal.json`
- Modify: `lib/server/db/schema.ts`
- Modify: `lib/server/members/create.ts`
- Modify: `lib/server/members/create.test.ts`
- Modify: `lib/server/bootstrap/owner.ts`
- Modify: `lib/server/bootstrap/owner.test.ts`

**Interfaces:**
- Produces: `AVATAR_COLORS`, `AvatarColor`, `pickAvatarColor(usedColors)`, and `assignMissingFamilyAvatarColors(db, familyId)`.

- [ ] **Step 1: Write failing migration and allocation tests**

Add assertions that `PRAGMA table_info(user)` contains `avatar_color`, that the owner has a valid stable color, and that eight accounts in one family have eight distinct valid colors.

- [ ] **Step 2: Run tests and verify RED**

Run: `vitest run lib/server/db/migrations/user-avatar-color-migration.test.ts lib/server/members/create.test.ts lib/server/bootstrap/owner.test.ts`

Expected: FAIL because `avatar_color` and the allocator do not exist.

- [ ] **Step 3: Implement the minimal persistence and allocator**

Define the palette as a readonly tuple, select randomly from unused colors before falling back to the full tuple, add the schema/migration/journal entry, allocate during member creation, and backfill after owner family membership is established.

- [ ] **Step 4: Run tests and verify GREEN**

Run the command from Step 2. Expected: all selected tests pass.

### Task 2: Render explicit account colors

**Files:**
- Modify: `components/ui/Avatar.tsx`
- Modify: `components/ui/Avatar.test.tsx`
- Modify: `components/ui/AvatarUpload.tsx`
- Modify: `components/features/TimelineCard.tsx`
- Modify: `components/features/CalendarDayPreview.tsx`
- Modify: `components/features/EntryDetailView.tsx`
- Modify: `components/features/EditMeForm.tsx`
- Modify: `components/features/FamilyMemberList.tsx`
- Modify: associated component tests

**Interfaces:**
- Consumes: `AvatarColor`.
- Produces: optional `color?: AvatarColor` on `Avatar` and `AvatarUpload`, plus account-color props on author/member components.

- [ ] **Step 1: Write failing component tests**

Assert that `<Avatar name="爸爸" color="blue" />` renders `ava-blue` and `data-color="blue"`, and that member/entry components render the supplied account color instead of a hard-coded class.

- [ ] **Step 2: Run tests and verify RED**

Run: `vitest run components/ui/Avatar.test.tsx components/features/FamilyMemberList.test.tsx components/features/CalendarDayPreview.test.tsx components/features/EntryDetailView.test.tsx`

Expected: FAIL because the explicit color props do not exist.

- [ ] **Step 3: Implement explicit color rendering**

Make `Avatar` use `color ?? palette[hash(...)]`, thread the optional color through `AvatarUpload` and author/member view components, and remove the member list's fixed blue override.

- [ ] **Step 4: Run tests and verify GREEN**

Run the command from Step 2. Expected: all selected tests pass.

### Task 3: Carry persisted colors from server data

**Files:**
- Modify: `app/timeline/page.tsx`
- Modify: `app/calendar/page.tsx`
- Modify: `app/entry/[id]/page.tsx`
- Modify: `app/profile/page.tsx`
- Modify: `app/profile/me/page.tsx`
- Modify: `app/api/family-members/route.ts`
- Modify: `app/profile/members/MembersAdminClient.tsx`
- Modify: route tests as needed

**Interfaces:**
- Consumes: `users.avatarColor` and the component props from Task 2.
- Produces: API response field `avatarColor` for each family member.

- [ ] **Step 1: Extend failing route assertions**

Assert that family-member API rows include a valid `avatarColor` and existing response fields remain intact.

- [ ] **Step 2: Run route tests and verify RED**

Run: `vitest run app/api/family-members/route.test.ts`. Expected: FAIL because `avatarColor` is absent.

- [ ] **Step 3: Thread colors through all account-avatar surfaces**

Select `users.avatarColor` where necessary and pass it as the explicit color prop. Preserve image URLs and all existing fallbacks.

- [ ] **Step 4: Run route and component tests and verify GREEN**

Run the route test and Task 2 component tests. Expected: all pass.

### Task 4: Documentation and full verification

**Files:**
- Modify: `docs/database.md`

- [ ] **Step 1: Document the account color lifecycle**

Describe `user.avatar_color`, unique-first allocation, startup backfill, and the eight-color exhaustion behavior without enumerating unrelated schema fields.

- [ ] **Step 2: Run full verification**

Run: `vitest run`, `pnpm lint`, and `pnpm typecheck` using the worktree's available dependencies. Expected: exit 0 for every command.

- [ ] **Step 3: Review the diff and commit**

Confirm every changed line belongs to persisted account avatar colors, then commit on `codex/fixed-account-avatar-colors`.
