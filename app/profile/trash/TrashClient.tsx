'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/mobile/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Tag } from '@/components/ui/Tag';

type TrashType = 'entries' | 'media' | 'babies';

interface TrashRow {
  id: string;
  type: TrashType;
  babyId: string | null;
  babyName: string | null;
  deletedAt: number;
  deletedByName: string | null;
  label: string;
  childCount?: number;
}

const tabs: Array<{ type: TrashType; label: string }> = [
  { type: 'entries', label: '日志' },
  { type: 'media', label: '照片' },
  { type: 'babies', label: '宝宝' }
];

const restorePath: Record<TrashType, string> = {
  entries: 'entries',
  media: 'media',
  babies: 'babies'
};

function isTrashType(value: string | null): value is TrashType {
  return value === 'entries' || value === 'media' || value === 'babies';
}

function relativeTime(ts: number) {
  if (!ts) return '未知时间';
  const diff = Date.now() - ts;
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.round(hours / 24)} 天前`;
}

export default function TrashClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type');
  const activeType: TrashType = isTrashType(typeParam) ? typeParam : 'entries';
  const [rows, setRows] = useState<TrashRow[]>([]);
  const [counts, setCounts] = useState<Record<TrashType, number>>({
    entries: 0,
    media: 0,
    babies: 0
  });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<{ action: 'purge' | 'empty'; row?: TrashRow } | null>(null);

  const activeLabel = useMemo(
    () => tabs.find((tab) => tab.type === activeType)?.label ?? '日志',
    [activeType]
  );

  const load = useCallback(async (cursor?: string) => {
    setLoading(true);
    const res = await fetch(`/api/trash?type=${activeType}${cursor ? `&cursor=${cursor}` : ''}`);
    setLoading(false);
    if (!res.ok) {
      setMessage(res.status === 404 ? '没有权限查看垃圾桶' : '加载失败');
      return;
    }
    const body = await res.json();
    setRows((current) => (cursor ? [...current, ...body.rows] : body.rows));
    setCounts(body.counts);
    setNextCursor(body.nextCursor);
  }, [activeType]);

  useEffect(() => {
    setRows([]);
    setNextCursor(null);
    load();
  }, [activeType, load]);

  function switchTab(type: TrashType) {
    router.push(`/profile/trash?type=${type}`);
  }

  async function restore(row: TrashRow) {
    const res = await fetch(`/api/${restorePath[row.type]}/${row.id}/restore`, { method: 'POST' });
    if (!res.ok) {
      setMessage(res.status === 409 ? '此照片与垃圾桶外的版本重复,请先处理' : '还原失败');
      return;
    }
    setRows(rows.filter((item) => item.id !== row.id));
    setCounts({ ...counts, [row.type]: Math.max(0, counts[row.type] - 1) });
    setMessage('已还原');
  }

  async function purge(row: TrashRow) {
    const res = await fetch(`/api/${restorePath[row.type]}/${row.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setMessage(res.status === 409 ? '该宝宝还有数据未清理,请先清理后再删除' : '永久删除失败');
      return;
    }
    setRows(rows.filter((item) => item.id !== row.id));
    setCounts({ ...counts, [row.type]: Math.max(0, counts[row.type] - 1) });
    setMessage('已永久删除');
  }

  async function emptyCurrentTab() {
    const res = await fetch(`/api/trash/empty?type=${activeType}`, { method: 'POST' });
    if (!res.ok) {
      setMessage('清空失败');
      return;
    }
    const body = await res.json();
    setRows([]);
    await load();
    setMessage(
      body.skipped?.length
        ? `已永久删除 ${body.purged} 项,${body.skipped.length} 项被跳过`
        : `已永久删除 ${body.purged} 项`
    );
  }

  async function confirmPending() {
    const current = pending;
    setPending(null);
    if (!current) return;
    if (current.action === 'empty') await emptyCurrentTab();
    if (current.action === 'purge' && current.row) await purge(current.row);
  }

  return (
    <AppShell
      title="垃圾桶"
      leftSlot={
        <Link href="/profile" className="text-[var(--text-sm)] text-[var(--color-muted)]">
          返回
        </Link>
      }
      rightSlot={
        <Button
          type="button"
          size="sm"
          variant="error"
          onClick={() => setPending({ action: 'empty' })}
          disabled={counts[activeType] === 0}
        >
          清空
        </Button>
      }
    >

      <div role="tablist" className="mb-[var(--space-4)] flex gap-[var(--space-2)] overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.type}
            type="button"
            role="tab"
            aria-selected={activeType === tab.type}
            onClick={() => switchTab(tab.type)}
          >
            <Tag variant={activeType === tab.type ? 'accent' : 'neutral'}>
              {tab.label} ({counts[tab.type]})
            </Tag>
          </button>
        ))}
      </div>

      {message && (
        <Card className="mb-[var(--space-3)] text-[var(--text-sm)]" aria-live="polite">
          {message}
        </Card>
      )}

      {rows.length === 0 && !loading ? (
        <div className="mt-[var(--space-12)] text-center text-[var(--color-muted)]">
          <p>当前没有已删除的 {activeLabel}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-[var(--space-3)]">
          {rows.map((row) => (
            <li key={row.id}>
              <Card>
                <p className="text-[var(--text-xs)] text-[var(--color-muted)]">
                  {row.babyName ? `${row.babyName} · ` : ''}
                  {row.deletedByName ?? '未知'} · {relativeTime(row.deletedAt)}
                </p>
                <p className="my-[var(--space-2)] whitespace-pre-wrap text-[var(--text-sm)]">{row.label || '无内容'}</p>
                {row.type === 'babies' && row.childCount ? (
                  <p className="mb-[var(--space-2)] text-[var(--text-xs)] text-[var(--color-error)]">还有 {row.childCount} 项数据未清理</p>
                ) : null}
                <div className="flex gap-[var(--space-2)]">
                  <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => restore(row)}
                >
                  还原
                  </Button>
                  <Button
                  type="button"
                  size="sm"
                  variant="error"
                  onClick={() => setPending({ action: 'purge', row })}
                  disabled={row.type === 'babies' && Boolean(row.childCount)}
                >
                  永久删除
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {nextCursor && (
        <Button type="button" variant="secondary" onClick={() => load(nextCursor)} className="mt-[var(--space-4)]" fullWidth>
          加载更多
        </Button>
      )}

      <Dialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title="永久删除"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setPending(null)}>
              取消
            </Button>
            <Button type="button" variant="error" onClick={confirmPending}>
              永久删除
            </Button>
          </>
        }
      >
        <p className="text-[var(--text-sm)] text-[var(--color-muted)]">
          {pending?.action === 'empty'
            ? `将永久删除当前 tab 下的 ${counts[activeType]} 项 ${activeLabel}。此操作不可撤销。`
            : `此操作不可撤销。“${pending?.row?.label ?? '该项目'}” 将从垃圾桶中移除。`}
        </p>
      </Dialog>
    </AppShell>
  );
}
