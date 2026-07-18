# Calendar Media Overflow Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the calendar page within the viewport when a record contains more thumbnails than its card can display.

**Architecture:** Preserve `ThumbnailStrip` as the horizontal scroll container. Constrain the nested record-list Grid items in `CalendarDayPreview` with `min-w-0` so thumbnail min-content width cannot widen the document.

**Tech Stack:** React 19, Next.js App Router, Tailwind CSS utilities, Vitest server rendering.

## Global Constraints

- Do not add global overflow clipping.
- Do not change thumbnail wrapping or interaction.
- Touch only the calendar preview component and its colocated test, apart from this plan.

---

### Task 1: Constrain calendar record Grid items

**Files:**
- Modify: `components/features/CalendarDayPreview.tsx:60-74`
- Test: `components/features/CalendarDayPreview.test.tsx`

**Interfaces:**
- Consumes: `CalendarDayPreview` props and the existing `ThumbnailStrip` behavior through `TimelineCard`.
- Produces: shrinkable record-list Grid items while retaining internal thumbnail scrolling.

- [ ] **Step 1: Write the failing regression test**

Add a test that renders eight media items and asserts both Grid levels carry the shrink constraint:

```tsx
it('allows media-heavy record grid items to shrink within the viewport', () => {
  const html = renderToStaticMarkup(
    <CalendarDayPreview
      babyId="baby-1"
      selectedIso="2026-05-24"
      babyAge="1岁3月"
      entries={[
        {
          id: 'entry-with-media',
          content: '很多照片',
          occurredAt: Date.UTC(2026, 4, 24, 8, 30),
          authorName: '爸爸',
          authorImage: null,
          mediaItems: Array.from({ length: 8 }, (_, index) => ({
            id: `media-${index}`,
            type: 'photo' as const,
            durationSec: null
          }))
        }
      ]}
    />
  );

  expect(html).toContain('class="grid min-w-0 gap-[var(--space-3)]"');
  expect(html).toContain('<li class="min-w-0">');
  expect(html).toContain('overflow-x-auto');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node_modules/.bin/vitest run components/features/CalendarDayPreview.test.tsx
```

Expected: FAIL because the record-list `<ul>` and `<li>` do not yet include `min-w-0`.

- [ ] **Step 3: Add the minimal shrink constraints**

Change only the relevant elements:

```tsx
<ul className="grid min-w-0 gap-[var(--space-3)]">
  {entries.map((entry, index) => (
    <li key={entry.id} className="min-w-0">
```

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
node_modules/.bin/vitest run components/features/CalendarDayPreview.test.tsx
node_modules/.bin/vitest run
pnpm lint
pnpm typecheck
```

Expected: all commands exit 0; the focused file has 3 passing tests and the full suite has no failures.

- [ ] **Step 5: Review and commit the implementation**

Run `git diff --check` and inspect `git diff`. Commit only the component, test, and this plan:

```bash
git add components/features/CalendarDayPreview.tsx components/features/CalendarDayPreview.test.tsx docs/superpowers/plans/2026-07-18-calendar-media-overflow.md
git commit -m "fix: 防止日历媒体记录撑宽页面"
```
