'use client';

import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/mobile/AppShell';
import { MediaLightbox } from '@/components/media/MediaLightbox';
import { ThumbnailStrip } from '@/components/media/ThumbnailStrip';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { CheckIcon, ChevronLeftIcon } from '@/components/ui/icons';
import type { MediaItem } from '@/lib/server/media/types';
import { milestoneTagStyle } from '@/lib/shared/milestone-tint';

type TrashItemType = 'entries' | 'media' | 'babies';
type TrashRole = 'owner' | 'member';

interface TrashRow {
  id: string;
  type: TrashItemType;
  babyId: string | null;
  babyName: string | null;
  deletedAt: number;
  deletedByName: string | null;
  label: string;
  mediaItems?: MediaItem[];
  milestoneNames?: string[];
  childCount?: number;
}

const restorePath: Record<TrashItemType, string> = {
  entries: 'entries',
  media: 'media',
  babies: 'babies'
};

interface TrashClientProps {
  role: TrashRole;
  initialRows?: TrashRow[];
  initialCount?: number;
}

function relativeTime(ts: number) {
  if (!ts) return '未知时间';
  const diff = Date.now() - ts;
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} 个月前`;
  return `${Math.round(days / 365)} 年前`;
}

export default function TrashClient({
  role,
  initialRows = [],
  initialCount = 0
}: TrashClientProps) {
  const [rows, setRows] = useState<TrashRow[]>(initialRows);
  const [count, setCount] = useState<number>(initialCount);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState<{ action: 'purge' | 'batch'; row?: TrashRow } | null>(null);
  const canPurge = role === 'owner';

  const load = useCallback(async (cursor?: string) => {
    setLoading(true);
    const res = await fetch(`/api/trash${cursor ? `?cursor=${cursor}` : ''}`);
    setLoading(false);
    if (!res.ok) {
      setMessage(res.status === 404 ? '没有权限查看回收站' : '加载失败');
      return;
    }
    const body = await res.json();
    setRows((current) => (cursor ? [...current, ...body.rows] : body.rows));
    setCount((body.counts?.entries ?? 0) + (body.counts?.media ?? 0) + (body.counts?.babies ?? 0));
    setNextCursor(body.nextCursor);
  }, []);

  useEffect(() => {
    if (initialRows.length === 0) load();
  }, [initialRows.length, load]);

  function toggleSelected(row: TrashRow) {
    if (!canPurge) return;
    if (row.type === 'babies') return;
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
      setMessage(res.status === 409 ? '此照片与回收站外的版本重复,请先处理' : '还原失败');
      return;
    }
    setRows(rows.filter((item) => item.id !== row.id));
    setCount(Math.max(0, count - 1));
  }

  async function purge(row: TrashRow) {
    const res = await fetch(`/api/${restorePath[row.type]}/${row.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setMessage('永久删除失败');
      return;
    }
    setRows(rows.filter((item) => item.id !== row.id));
    setCount(Math.max(0, count - 1));
  }

  async function purgeSelected() {
    const selectedRows = rows.filter((row) => selectedIds.has(row.id));
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
    setCount(Math.max(0, count - purgedIds.size));
    setSelectedIds(new Set());
    setSelecting(false);
  }

  async function confirmPending() {
    const current = pending;
    setPending(null);
    if (!current) return;
    if (current.action === 'batch') await purgeSelected();
    if (current.action === 'purge' && current.row) await purge(current.row);
  }

  const subtitle = selecting ? '选择要删除的记录' : `${count} 条记录`;

  return (
    <AppShell
      title="回收站"
      subtitle={subtitle}
      hideTabbar={selecting}
      leftSlot={
        <Link
          href="/profile"
          aria-label="返回"
          className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-[color:var(--color-fg)] active:bg-black/5"
        >
          <ChevronLeftIcon />
        </Link>
      }
      rightSlot={
        canPurge && count > 0 ? (
          <button
            type="button"
            onClick={() => {
              setSelecting(!selecting);
              setSelectedIds(new Set());
            }}
            className={[
              'rounded-[var(--radius-pill)] bg-transparent px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-md)] font-bold active:bg-black/5',
              selecting
                ? 'text-[color:var(--color-muted)]'
                : 'text-[color:var(--color-primary-active)]'
            ].join(' ')}
          >
            {selecting ? '取消' : '选择'}
          </button>
        ) : null
      }
    >
      <Card className="mb-[var(--space-4)] flex items-center gap-[var(--space-2)] text-[length:var(--text-sm)] leading-[var(--leading-base)] text-[color:var(--color-muted)]">
        <span aria-hidden="true">ℹ</span>
        <span>删除的记录会留在这里,可随时恢复</span>
      </Card>

      {message && (
        <Card className="mb-[var(--space-3)] text-[length:var(--text-sm)]" aria-live="polite">
          {message}
        </Card>
      )}

      {rows.length === 0 && !loading ? (
        <div className="mt-[var(--space-12)] text-center text-[color:var(--color-muted)]">
          <p>回收站是空的</p>
        </div>
      ) : (
        <ul className={`flex flex-col gap-[var(--space-3)] ${selecting ? 'pb-[88px]' : ''}`}>
          {rows.map((row) => (
            <li key={row.id}>
              <TrashRowCard
                row={row}
                selecting={selecting}
                selected={selectedIds.has(row.id)}
                canPurge={canPurge}
                onToggleSelect={() => toggleSelected(row)}
                onRestore={() => restore(row)}
                onPurge={() => setPending({ action: 'purge', row })}
              />
            </li>
          ))}
        </ul>
      )}

      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-[var(--z-sticky)] border-t border-[var(--color-border-light)] bg-[var(--color-bg)] px-[var(--space-4)] pb-[calc(var(--space-4)+env(safe-area-inset-bottom))] pt-[var(--space-3)]">
          <div className="mx-auto flex max-w-screen-sm items-center gap-[var(--space-3)]">
            <span className="min-w-0 flex-1 text-[length:var(--text-sm)] font-bold text-[color:var(--color-fg)]">
              已选 <span className="text-[color:var(--color-primary)]">{selectedIds.size} 条</span>
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

      <Modal
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        dismissible={false}
        title={
          pending?.action === 'batch'
            ? `永久删除 ${selectedIds.size} 条记录?`
            : pending?.row?.type === 'babies'
            ? `归档「${pending?.row?.label ?? ''}」?`
            : '永久删除'
        }
        footer={
          <>
            <Button type="button" variant="default" onClick={() => setPending(null)}>
              取消
            </Button>
            <Button type="button" variant="error" onClick={confirmPending}>
              {pending?.row?.type === 'babies' && pending?.action !== 'batch' ? '归档' : '永久删除'}
            </Button>
          </>
        }
      >
        <p className="text-[length:var(--text-base)] leading-[var(--leading-base)] text-[color:var(--color-fg)]">
          {pending?.action === 'batch'
            ? '此操作不可撤销。删除后将无法恢复,包括所附的图片与视频。'
            : pending?.row?.type === 'babies'
            ? '宝宝及其所有记录、相册将从回收站中移除并归档保留。归档后无法在应用内恢复。'
            : `此操作不可撤销。“${pending?.row?.label ?? '该项目'}” 将从回收站中移除。`}
        </p>
      </Modal>
    </AppShell>
  );
}

interface TrashRowCardProps {
  row: TrashRow;
  selecting: boolean;
  selected: boolean;
  canPurge: boolean;
  onToggleSelect: () => void;
  onRestore: () => void;
  onPurge: () => void;
}

function TrashRowCard({
  row,
  selecting,
  selected,
  canPurge,
  onToggleSelect,
  onRestore,
  onPurge
}: TrashRowCardProps) {
  const [lightboxAt, setLightboxAt] = useState<number | null>(null);
  const mediaItems = row.mediaItems ?? [];
  const milestoneNames = row.milestoneNames ?? [];
  const isBaby = row.type === 'babies';
  const hasText = row.type === 'entries' && Boolean(row.label);
  const hasMedia = !isBaby && mediaItems.length > 0;

  const onKeyDown = selecting
    ? (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggleSelect();
        }
      }
    : undefined;

  return (
    <Card
      role={selecting ? 'button' : undefined}
      tabIndex={selecting ? 0 : undefined}
      onClick={selecting ? onToggleSelect : undefined}
      onKeyDown={onKeyDown}
      className={selecting ? 'w-full text-left' : undefined}
    >
      <div className="flex gap-[var(--space-3)]">
        {selecting && (
          <span
            aria-hidden="true"
            className={[
              'mt-[var(--space-1)] flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-pill)] border-2 text-[length:var(--text-sm)] font-bold',
              selected
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[color:var(--color-fg-inverse)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface-2)] text-transparent'
            ].join(' ')}
          >
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[var(--space-2)] text-[length:var(--text-xs)] text-[color:var(--color-muted)]">
            {row.babyName && <Avatar name={row.babyName} size={isBaby ? 'sm' : 'xs'} />}
            <span className="truncate">
              {isBaby ? (
                <span className="text-[length:var(--text-md)] font-bold text-[color:var(--color-fg-strong)]">
                  {row.babyName}
                </span>
              ) : (
                <>
                  {row.babyName ? `${row.babyName} · ` : ''}
                  {row.deletedByName ?? '未知'}
                </>
              )}
            </span>
            <span className="ml-auto shrink-0">删除于 {relativeTime(row.deletedAt)}</span>
          </div>
          {isBaby && (
            <p className="my-[var(--space-2)] text-[length:var(--text-sm)] text-[color:var(--color-muted)]">
              {row.childCount && row.childCount > 0
                ? `包含 ${row.childCount} 条记录与相册`
                : '无活跃记录'}
            </p>
          )}
          {hasText && (
            <p className="my-[var(--space-2)] line-clamp-2 whitespace-pre-wrap text-[length:var(--text-sm)] leading-[var(--leading-base)]">
              {row.label}
            </p>
          )}
          {milestoneNames.length > 0 && (
            <div className="mt-[var(--space-2)] flex flex-wrap gap-[var(--space-2)]">
              {milestoneNames.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-xs)] font-bold"
                  style={milestoneTagStyle(name)}
                >
                  {name}
                </span>
              ))}
            </div>
          )}
          {hasMedia && (
            <ThumbnailStrip
              items={mediaItems}
              onOpenAt={selecting ? undefined : (i) => setLightboxAt(i)}
            />
          )}
          {row.type === 'entries' && !hasText && !hasMedia && (
            <p className="my-[var(--space-2)] text-[length:var(--text-sm)] text-[color:var(--color-muted)]">无内容</p>
          )}
          {!selecting && (
            <div className="mt-[var(--space-3)] flex items-center justify-end gap-[var(--space-3)]">
              {canPurge && (
                <button
                  type="button"
                  onClick={onPurge}
                  className="rounded-[var(--radius-pill)] bg-transparent px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-sm)] font-bold text-[color:var(--color-error)] active:bg-[var(--color-error-bg)]"
                >
                  {isBaby ? '归档' : '永久删除'}
                </button>
              )}
              <Button type="button" size="sm" variant="primary" onClick={onRestore}>
                恢复
              </Button>
            </div>
          )}
        </div>
      </div>
      {lightboxAt !== null && (
        <MediaLightbox
          items={mediaItems}
          startIndex={lightboxAt}
          onClose={() => setLightboxAt(null)}
        />
      )}
    </Card>
  );
}
