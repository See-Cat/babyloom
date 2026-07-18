import { randomInt } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { getDb } from '@/lib/server/db/client';
import { familyMembers, users } from '@/lib/server/db/schema';
import {
  AVATAR_COLORS,
  isAvatarColor,
  type AvatarColor
} from '@/lib/shared/avatar-colors';

type Db = ReturnType<typeof getDb>['db'];

export function pickAvatarColor(
  usedColors: Iterable<string | null | undefined>
): AvatarColor {
  const used = new Set(Array.from(usedColors).filter(isAvatarColor));
  const available = AVATAR_COLORS.filter((color) => !used.has(color));
  const pool = available.length > 0 ? available : AVATAR_COLORS;
  return pool[randomInt(pool.length)];
}

export function assignMissingFamilyAvatarColors(db: Db, familyId: string): void {
  const rows = db
    .select({
      userId: users.id,
      avatarColor: users.avatarColor
    })
    .from(familyMembers)
    .innerJoin(users, eq(users.id, familyMembers.userId))
    .where(eq(familyMembers.familyId, familyId))
    .orderBy(familyMembers.joinedAt)
    .all();
  const usedColors = new Set(rows.map((row) => row.avatarColor).filter(isAvatarColor));

  for (const row of rows) {
    if (isAvatarColor(row.avatarColor)) continue;
    const avatarColor = pickAvatarColor(usedColors);
    db.update(users)
      .set({ avatarColor })
      .where(eq(users.id, row.userId))
      .run();
    usedColors.add(avatarColor);
  }
}
