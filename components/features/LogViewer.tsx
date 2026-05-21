'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { LogRow } from '@/lib/logs/tail';

export function LogViewer({ rows }: { rows: LogRow[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/profile/data/logs${next.toString() ? `?${next}` : ''}`);
  }

  return (
    <div className="grid gap-[var(--space-3)]">
      <div className="grid gap-[var(--space-2)] sm:grid-cols-3">
        <SegmentedControl
          className="grid-cols-5"
          value={params.get('level') ?? ''}
          onChange={(value) => setParam('level', value)}
          ariaLabel="level"
          options={[
            { value: '', label: '全部' },
            { value: 'debug', label: 'debug' },
            { value: 'info', label: 'info' },
            { value: 'warn', label: 'warn' },
            { value: 'error', label: 'error' }
          ]}
        />
        <Input
          value={params.get('module') ?? ''}
          onChange={(e) => setParam('module', e.target.value)}
          placeholder="module"
          aria-label="module"
        />
        <Input
          value={params.get('q') ?? ''}
          onChange={(e) => setParam('q', e.target.value)}
          placeholder="搜索"
          aria-label="search"
        />
      </div>
      <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--color-border)]">
        <table className="w-full min-w-[720px] border-collapse text-left text-[var(--text-sm)]">
          <thead className="sticky top-0 bg-[var(--color-surface)] text-[var(--color-muted)]">
            <tr>
              <th className="p-[var(--space-2)]">时间</th>
              <th className="p-[var(--space-2)]">级别</th>
              <th className="p-[var(--space-2)]">模块</th>
              <th className="p-[var(--space-2)]">消息</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={rowClass(row.level)}>
                <td className="p-[var(--space-2)]">{formatTime(row.time)}</td>
                <td className="p-[var(--space-2)]">{levelLabel(row.level)}</td>
                <td className="p-[var(--space-2)]">{String(row.module ?? '-')}</td>
                <td className="p-[var(--space-2)]">{String(row.msg ?? '')}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-[var(--space-4)] text-center text-[var(--color-muted)]">
                  暂无日志
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function levelLabel(level: LogRow['level']) {
  if (level === 10) return 'trace';
  if (level === 20) return 'debug';
  if (level === 30) return 'info';
  if (level === 40) return 'warn';
  if (level === 50) return 'error';
  if (level === 60) return 'fatal';
  return String(level ?? '');
}

function rowClass(level: LogRow['level']) {
  const label = levelLabel(level);
  if (label === 'warn') return 'bg-[color-mix(in_srgb,var(--color-warning)_16%,transparent)]';
  if (label === 'error' || label === 'fatal') {
    return 'bg-[color-mix(in_srgb,var(--color-error)_16%,transparent)]';
  }
  if (label === 'debug' || label === 'trace') return 'text-[var(--color-muted)]';
  return '';
}

function formatTime(time: LogRow['time']) {
  return typeof time === 'number' ? new Date(time).toLocaleString('zh-CN') : '';
}
