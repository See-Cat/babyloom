'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Milestone {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  isSystem: boolean;
}

export default function MilestonesAdminPage() {
  const [items, setItems] = useState<Milestone[]>([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', icon: '⭐' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ name: '', icon: '' });

  async function reload() {
    const res = await fetch('/api/milestones');
    if (!res.ok) return;
    const body = await res.json();
    setItems(body.milestones);
  }

  useEffect(() => {
    reload();
  }, []);

  async function create() {
    if (!draft.name || !draft.icon) return;
    await fetch('/api/milestones', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(draft)
    });
    setCreating(false);
    setDraft({ name: '', icon: '⭐' });
    reload();
  }

  async function remove(id: string) {
    if (!confirm('确定删除? 已挂在记录上的会断开关联(不删记录)。')) return;
    await fetch(`/api/milestones/${id}`, { method: 'DELETE' });
    reload();
  }

  async function saveEdit(id: string) {
    await fetch(`/api/milestones/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(editDraft)
    });
    setEditingId(null);
    setEditDraft({ name: '', icon: '' });
    reload();
  }

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <Link href="/profile" className="text-sm opacity-60">
        ← 个人
      </Link>
      <h1 className="text-xl font-semibold my-4">里程碑设置</h1>

      <ul className="grid grid-cols-2 gap-2 mb-6">
        {items.map((m) => (
          <li key={m.id} className="border rounded p-3 flex items-center justify-between">
            {editingId === m.id ? (
              <div className="flex flex-col gap-2 w-full">
                <input
                  aria-label="图标"
                  value={editDraft.icon}
                  onChange={(e) => setEditDraft({ ...editDraft, icon: e.target.value })}
                  className="border rounded px-2 py-1"
                  maxLength={10}
                />
                <input
                  placeholder="名称"
                  value={editDraft.name}
                  onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  className="border rounded px-2 py-1"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveEdit(m.id)}
                    className="bg-black text-white text-sm px-3 py-1 rounded"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-sm"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span>
                  {m.icon} {m.name}
                  {m.isSystem && <span className="text-xs opacity-50 ml-1">(系统)</span>}
                </span>
                {!m.isSystem && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(m.id);
                        setEditDraft({ name: m.name, icon: m.icon });
                      }}
                      className="text-xs"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
                      className="text-xs text-red-600"
                    >
                      ×
                    </button>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {creating ? (
        <div className="border rounded p-3 flex flex-col gap-2">
          <input
            placeholder="emoji (如 🎉)"
            value={draft.icon}
            onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
            className="border rounded px-2 py-1"
            maxLength={4}
          />
          <input
            placeholder="名称 (如 第一次叫妈妈)"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="border rounded px-2 py-1"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={create}
              className="bg-black text-white text-sm px-3 py-1 rounded"
            >
              创建
            </button>
            <button type="button" onClick={() => setCreating(false)} className="text-sm">
              取消
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="border rounded p-3 w-full text-left text-sm"
        >
          + 添加里程碑
        </button>
      )}
    </main>
  );
}
