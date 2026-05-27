import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { getDb } from '@/lib/db/client';
import { milestones } from '@/lib/db/schema';

export const DEFAULT_MILESTONES: readonly string[] = [
  '第一次微笑',
  '第一次翻身',
  '第一次坐起',
  '第一次爬行',
  '第一次站立',
  '第一次走路',
  '第一次叫爸爸',
  '第一次叫妈妈',
  '长第一颗牙',
  '第一次自己吃饭',
  '第一次理发',
  '第一个生日'
];

type Db = ReturnType<typeof getDb>['db'];

export function seedDefaultMilestones(db: Db, familyId: string): void {
  const existing = db
    .select({ id: milestones.id })
    .from(milestones)
    .where(eq(milestones.familyId, familyId))
    .all();
  if (existing.length > 0) return;

  const now = Date.now();
  for (let i = 0; i < DEFAULT_MILESTONES.length; i += 1) {
    db.insert(milestones)
      .values({
        id: randomUUID(),
        familyId,
        name: DEFAULT_MILESTONES[i],
        icon: 'default',
        sortOrder: i,
        createdAt: now
      })
      .run();
  }
}
