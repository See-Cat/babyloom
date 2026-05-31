import { zonedParts } from './format-time';

export interface BabyAge {
  years: number;
  months: number;
  /** 1-based day count since birth ("第 N 天"). */
  days: number;
}

// Age of a baby at an instant, with every date part resolved in the configured
// timezone (not UTC) so it matches the dates shown next to it — otherwise entries
// in the UTC-vs-zone midnight window drift a day/month. Birthday is a calendar
// date string (YYYY-MM-DD); `atMs` is the instant to measure age at.
export function babyAge(birthday: string, atMs: number, timeZone: string): BabyAge | null {
  const match = birthday.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const birthYear = Number(match[1]);
  const birthMonth = Number(match[2]);
  const birthDay = Number(match[3]);

  const at = zonedParts(atMs, timeZone);
  let months = (at.year - birthYear) * 12 + (at.month - birthMonth);
  if (at.day < birthDay) months -= 1;
  months = Math.max(0, months);

  const birthOrdinal = Date.UTC(birthYear, birthMonth - 1, birthDay);
  const atOrdinal = Date.UTC(at.year, at.month - 1, at.day);
  const days = Math.max(1, Math.round((atOrdinal - birthOrdinal) / 86_400_000) + 1);

  return { years: Math.floor(months / 12), months: months % 12, days };
}

/** "X岁Y月" / "Y个月" — the short age label without day count. */
export function formatBabyAgeShort(age: BabyAge): string {
  return age.years > 0 ? `${age.years}岁${age.months}月` : `${age.months}个月`;
}
