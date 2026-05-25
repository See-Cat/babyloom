'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/mobile/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Tag } from '@/components/ui/Tag';
import { CheckIcon } from '@/components/ui/icons';

type TrashType = 'entries' | 'media' | 'babies';
type TrashRole = 'owner' | 'editor';

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

interface TrashClientProps {
  role: TrashRole;
  initialRows?: TrashRow[];
  initialCounts?: Record<TrashType, number>;
}

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

export default function TrashClient({
  role,
  initialRows = [],
  initialCounts = { entries: 0, media: 0, babies: 0 }
}: TrashClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type');
  const activeType: TrashType = isTrashType(typeParam) ? typeParam : 'entries';
  const [rows, setRows] = useState<TrashRow[]>(initialRows);
  const [counts, setCounts] = useState<Record<TrashType, number>>(initialCounts);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState<{ action: 'purge' | 'batch'; row?: TrashRow } | null>(null);
  const canPurge = role === 'owner';

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
    setSelecting(false);
    setSelectedIds(new Set());
    router.push(`/profile/trash?type=${type}`);
  }

  function canSelect(row: TrashRow) {
    return row.type !== 'babies' || !row.childCount;
  }

  function toggleSelected(row: TrashRow) {
    if (!canPurge || !canSelect(row)) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
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

  async function purgeSelected() {
    const selectedRows = rows.filter((row) => selectedIds.has(row.id) && canSelect(row));
    if (selectedRows.length === 0) return;

    const purgedIds = new Set<string>();
    for (const row of selectedRows) {
      const res = await fetch(`/api/${restorePath[row.type]}/${row.id}`, { method: 'DELETE' });
      if (res.ok) purgedIds.add(row.id);
    }

    if (purgedIds.size === 0) {
      setMessage('永久删除失败');
      return;
    }

    setRows(rows.filter((row) => !purgedIds.has(row.id)));
    setCounts({ ...counts, [activeType]: Math.max(0, counts[activeType] - purgedIds.size) });
    setSelectedIds(new Set());
    setSelecting(false);
    setMessage(`已永久删除 ${purgedIds.size} 项`);
  }

  async function confirmPending() {
    const current = pending;
    setPending(null);
    if (!current) return;
    if (current.action === 'batch') await purgeSelected();
    if (current.action === 'purge' && current.row) await purge(current.row);
  }

  return (
    <AppShell
      title="垃圾桶"
      leftSlot={
        <Link href="/profile" className="text-[length:var(--text-sm)] text-[color:var(--color-muted)]">
          返回
        </Link>
      }
      rightSlot={
        canPurge && counts[activeType] > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelecting(!selecting);
              setSelectedIds(new Set());
            }}
          >
            {selecting ? '取消' : '选择'}
          </Button>
        ) : null
      }
    >
      <Card className="mb-[var(--space-4)] text-[length:var(--text-sm)] leading-[var(--leading-base)] text-[color:var(--color-muted)]">
        删除的记录会留在这里,可随时恢复。
      </Card>

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
        <Card className="mb-[var(--space-3)] text-[length:var(--text-sm)]" aria-live="polite">
          {message}
        </Card>
      )}

      {rows.length === 0 && !loading ? (
        <div className="mt-[var(--space-12)] text-center text-[color:var(--color-muted)]">
          <p>当前没有已删除的 {activeLabel}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-[var(--space-3)]">
          {rows.map((row) => (
            <li key={row.id}>
              <Card
                role={selecting && canSelect(row) ? 'button' : undefined}
                tabIndex={selecting && canSelect(row) ? 0 : undefined}
                onClick={selecting ? () => toggleSelected(row) : undefined}
                onKeyDown={selecting ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleSelected(row);
                  }
                } : undefined}
                className={selecting && canSelect(row) ? 'w-full text-left' : undefined}
              >
                <div className="flex gap-[var(--space-3)]">
                  {selecting && (
                    <span
                      aria-hidden="true"
                      className={[
                        'mt-[var(--space-1)] flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-pill)] border-2 text-[length:var(--text-sm)] font-bold',
                        selectedIds.has(row.id)
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[color:var(--color-fg-inverse)]'
                          : 'border-[var(--color-border)] bg-[var(--color-surface-2)] text-transparent',
                        !canSelect(row) && 'opacity-45'
                      ].filter(Boolean).join(' ')}
                    >
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[length:var(--text-xs)] text-[color:var(--color-muted)]">
                      {row.babyName ? `${row.babyName} · ` : ''}
                      {row.deletedByName ?? '未知'} · {relativeTime(row.deletedAt)}
                    </p>
                    <p className="my-[var(--space-2)] whitespace-pre-wrap text-[length:var(--text-sm)]">{row.label || '无内容'}</p>
                    {row.type === 'babies' && row.childCount ? (
                      <p className="mb-[var(--space-2)] text-[length:var(--text-xs)] text-[color:var(--color-error)]">还有 {row.childCount} 项数据未清理</p>
                    ) : null}
                    {!selecting && (
                      <div className="flex gap-[var(--space-2)]">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => restore(row)}
                        >
                          还原
                        </Button>
                        {canPurge && (
                          <Button
                            type="button"
                            size="sm"
                            variant="error"
                            onClick={() => setPending({ action: 'purge', row })}
                            disabled={row.type === 'babies' && Boolean(row.childCount)}
                          >
                            永久删除
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-[var(--z-sticky)] border-t border-[var(--color-border-light)] bg-[var(--color-bg)] px-[var(--space-4)] pb-[calc(var(--space-4)+env(safe-area-inset-bottom))] pt-[var(--space-3)]">
          <div className="mx-auto flex max-w-screen-sm items-center gap-[var(--space-3)]">
            <span className="min-w-0 flex-1 text-[length:var(--text-sm)] font-bold text-[color:var(--color-fg)]">
              已选 {selectedIds.size} 条
            </span>
            <Button
              type="button"
              size="sm"
              variant="error"
              onClick={() => setPending({ action: 'batch' })}
              disabled={selectedIds.size === 0}
            >
              永久删除
            </Button>
          </div>
        </div>
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
        dismissible={false}
        title={pending?.action === 'batch' ? `永久删除 ${selectedIds.size} 条记录?` : '永久删除'}
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
        <p className="text-[length:var(--text-base)] leading-[var(--leading-base)] text-[color:var(--color-fg)]">
          {pending?.action === 'batch'
            ? '此操作不可撤销。删除后将无法恢复,包括所附的图片与视频。'
            : `此操作不可撤销。“${pending?.row?.label ?? '该项目'}” 将从垃圾桶中移除。`}
        </p>
      </Dialog>
    </AppShell>
  );
}
