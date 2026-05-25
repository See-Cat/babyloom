const MS_PER_DAY = 86_400_000;

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatHm(ts: number) {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export function formatRelativeDateTime(value: number, now: number = Date.now()): string {
  const startToday = startOfLocalDay(new Date(now));
  const startTarget = startOfLocalDay(new Date(value));
  const diffDays = Math.round((startToday - startTarget) / MS_PER_DAY);
  const hm = formatHm(value);
  if (diffDays === 0) return `今天 ${hm}`;
  if (diffDays === 1) return `昨天 ${hm}`;
  if (diffDays === 2) return `前天 ${hm}`;
  if (diffDays > 2 && diffDays < 7) return `${diffDays} 天前 ${hm}`;
  const d = new Date(value);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  if (d.getFullYear() === new Date(now).getFullYear()) return `${month} 月 ${day} 日 ${hm}`;
  return `${d.getFullYear()} 年 ${month} 月 ${day} 日 ${hm}`;
}

export function formatLongDateTime(value: number): string {
  const d = new Date(value);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${formatHm(value)}`;
}

export function parseBirthdayToMillis(birthday: string): number | null {
  const match = birthday.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!match) return null;
  const ms = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    match[4] ? Number(match[4]) : 0,
    match[5] ? Number(match[5]) : 0
  ).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function birthdayDatePart(birthday: string): string {
  return birthday.slice(0, 10);
}
