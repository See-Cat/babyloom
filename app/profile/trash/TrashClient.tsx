'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

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
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <Link href="/profile" className="text-sm opacity-60">
        ← 个人
      </Link>
      <header className="my-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">垃圾桶</h1>
        <button
          type="button"
          onClick={() => setPending({ action: 'empty' })}
          disabled={counts[activeType] === 0}
          className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 disabled:opacity-40"
        >
          清空 {activeLabel} ({counts[activeType]})
        </button>
      </header>

      <div role="tablist" className="mb-4 flex gap-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.type}
            type="button"
            role="tab"
            aria-selected={activeType === tab.type}
            onClick={() => switchTab(tab.type)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              activeType === tab.type ? 'bg-black text-white' : ''
            }`}
          >
            {tab.label} ({counts[tab.type]})
          </button>
        ))}
      </div>

      {message && (
        <div className="mb-3 rounded border bg-gray-50 px-3 py-2 text-sm" aria-live="polite">
          {message}
        </div>
      )}

      {rows.length === 0 && !loading ? (
        <div className="mt-12 text-center opacity-60">
          <p>当前没有已删除的 {activeLabel}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded border p-3">
              <p className="text-xs opacity-60">
                {row.babyName ? `${row.babyName} · ` : ''}
                {row.deletedByName ?? '未知'} · {relativeTime(row.deletedAt)}
              </p>
              <p className="my-2 whitespace-pre-wrap text-sm">{row.label || '无内容'}</p>
              {row.type === 'babies' && row.childCount ? (
                <p className="mb-2 text-xs text-red-600">还有 {row.childCount} 项数据未清理</p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => restore(row)}
                  className="rounded border px-3 py-1 text-sm"
                >
                  还原
                </button>
                <button
                  type="button"
                  onClick={() => setPending({ action: 'purge', row })}
                  disabled={row.type === 'babies' && Boolean(row.childCount)}
                  className="rounded border border-red-200 px-3 py-1 text-sm text-red-600 disabled:opacity-40"
                >
                  永久删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {nextCursor && (
        <button
          type="button"
          onClick={() => load(nextCursor)}
          className="mt-4 w-full rounded border px-3 py-2 text-sm"
        >
          加载更多
        </button>
      )}

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded bg-white p-4">
            <h2 className="font-semibold">永久删除</h2>
            <p className="my-3 text-sm opacity-70">
              {pending.action === 'empty'
                ? `将永久删除当前 tab 下的 ${counts[activeType]} 项 ${activeLabel}。此操作不可撤销。`
                : `此操作不可撤销。“${pending.row?.label ?? '该项目'}” 将从垃圾桶中移除。`}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setPending(null)}
                className="rounded border px-3 py-1.5 text-sm"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmPending}
                className="rounded bg-red-600 px-3 py-1.5 text-sm text-white"
              >
                永久删除
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
