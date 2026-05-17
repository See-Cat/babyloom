'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTrashAction } from '@/lib/hooks/useTrashAction';

interface Baby {
  id: string;
  name: string;
  birthday: string;
  gender: string;
}

export default function BabiesAdminPage() {
  const router = useRouter();
  const trashAction = useTrashAction('baby');
  const [babies, setBabies] = useState<Baby[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newBaby, setNewBaby] = useState({ name: '', birthday: '', gender: 'girl' });

  async function reload() {
    const res = await fetch('/api/babies');
    if (!res.ok) return;
    const body = await res.json();
    setBabies(body.babies);
  }

  useEffect(() => {
    reload();
  }, []);

  async function rename(id: string) {
    await fetch(`/api/babies/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: editName })
    });
    setEditingId(null);
    reload();
  }

  async function trash(id: string) {
    const baby = babies.find((item) => item.id === id);
    await trashAction.softDelete(id, baby?.name ?? '宝宝', () => {
      reload();
      router.refresh();
    });
  }

  async function createBaby() {
    const res = await fetch('/api/babies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(newBaby)
    });
    if (res.ok) {
      setCreating(false);
      setNewBaby({ name: '', birthday: '', gender: 'girl' });
      reload();
    }
  }

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <Link href="/profile" className="text-sm opacity-60">
        ← 个人
      </Link>
      <h1 className="text-xl font-semibold my-4">宝宝管理</h1>

      <ul className="flex flex-col gap-3 mb-6">
        {babies.map((b) => (
          <li key={b.id} className="border rounded p-3 flex items-center justify-between">
            {editingId === b.id ? (
              <>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="border rounded px-2 py-1 flex-1 mr-2"
                />
                <button
                  type="button"
                  onClick={() => rename(b.id)}
                  className="text-sm bg-black text-white px-3 py-1 rounded mr-2"
                >
                  保存
                </button>
                <button type="button" onClick={() => setEditingId(null)} className="text-sm">
                  取消
                </button>
              </>
            ) : (
              <>
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-xs opacity-60">
                    {b.birthday} · {b.gender}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(b.id);
                      setEditName(b.name);
                    }}
                    className="text-sm border rounded px-3 py-1"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => trash(b.id)}
                    className="text-sm text-red-600 border rounded px-3 py-1"
                  >
                    删除
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {creating ? (
        <div className="border rounded p-3 flex flex-col gap-2">
          <input
            placeholder="名字"
            value={newBaby.name}
            onChange={(e) => setNewBaby({ ...newBaby, name: e.target.value })}
            className="border rounded px-2 py-1"
          />
          <input
            type="date"
            value={newBaby.birthday}
            onChange={(e) => setNewBaby({ ...newBaby, birthday: e.target.value })}
            className="border rounded px-2 py-1"
          />
          <select
            value={newBaby.gender}
            onChange={(e) => setNewBaby({ ...newBaby, gender: e.target.value })}
            className="border rounded px-2 py-1"
          >
            <option value="girl">女宝</option>
            <option value="boy">男宝</option>
            <option value="other">其他</option>
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={createBaby}
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
          + 添加宝宝
        </button>
      )}
      {trashAction.toast && (
        <div className="fixed bottom-4 left-4 right-4 mx-auto max-w-sm rounded border bg-white p-3 shadow">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>已删除 · {trashAction.toast.label}</span>
            <button
              type="button"
              onClick={async () => {
                const restored = await trashAction.undo();
                if (restored) {
                  reload();
                  router.refresh();
                }
              }}
              className="rounded border px-2 py-1"
            >
              撤销
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
