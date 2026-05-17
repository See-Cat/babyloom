'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Member {
  memberId: string;
  userId: string;
  username: string;
  nickname: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: number;
}

export default function MembersAdminPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [creating, setCreating] = useState(false);
  const [newMember, setNewMember] = useState({
    username: '',
    password: '',
    nickname: '',
    role: 'editor' as 'editor' | 'viewer'
  });
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const res = await fetch('/api/family-members');
    if (!res.ok) return;
    const body = await res.json();
    setMembers(body.members);
  }

  useEffect(() => {
    reload();
  }, []);

  async function createNew() {
    setError(null);
    const res = await fetch('/api/family-members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(newMember)
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error === 'username_taken' ? '用户名已被占用' : '创建失败');
      return;
    }
    setCreating(false);
    setNewMember({ username: '', password: '', nickname: '', role: 'editor' });
    reload();
  }

  async function changeRole(userId: string, role: 'editor' | 'viewer') {
    await fetch(`/api/family-members/${userId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role })
    });
    reload();
  }

  async function remove(userId: string) {
    if (!confirm('确定移除该成员? 该成员将无法登录。')) return;
    await fetch(`/api/family-members/${userId}`, { method: 'DELETE' });
    reload();
  }

  async function resetPwd(userId: string) {
    if (!resetPassword || resetPassword.length < 8) {
      setError('新密码至少 8 位');
      return;
    }
    await fetch(`/api/family-members/${userId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: resetPassword })
    });
    setResetFor(null);
    setResetPassword('');
    setError(null);
  }

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <Link href="/profile" className="text-sm opacity-60">
        ← 个人
      </Link>
      <h1 className="text-xl font-semibold my-4">成员管理</h1>

      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

      <ul className="flex flex-col gap-3 mb-6">
        {members.map((m) => (
          <li key={m.memberId} className="border rounded p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{m.nickname}</p>
                <p className="text-xs opacity-60">
                  @{m.username} · {m.role}
                </p>
              </div>
              {m.role !== 'owner' && (
                <div className="flex gap-2">
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.userId, e.target.value as 'editor' | 'viewer')}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="editor">editor</option>
                    <option value="viewer">viewer</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setResetFor(m.userId)}
                    className="text-sm border rounded px-3 py-1"
                  >
                    改密码
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(m.userId)}
                    className="text-sm text-red-600 border rounded px-3 py-1"
                  >
                    移除
                  </button>
                </div>
              )}
            </div>
            {resetFor === m.userId && (
              <div className="mt-3 flex gap-2">
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="新密码 (≥8 位)"
                  className="border rounded px-2 py-1 flex-1"
                />
                <button
                  type="button"
                  onClick={() => resetPwd(m.userId)}
                  className="bg-black text-white text-sm px-3 py-1 rounded"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResetFor(null);
                    setResetPassword('');
                  }}
                  className="text-sm"
                >
                  取消
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {creating ? (
        <div className="border rounded p-3 flex flex-col gap-2">
          <input
            placeholder="用户名 (3-50, a-z0-9_-)"
            value={newMember.username}
            onChange={(e) => setNewMember({ ...newMember, username: e.target.value })}
            className="border rounded px-2 py-1"
          />
          <input
            placeholder="昵称"
            value={newMember.nickname}
            onChange={(e) => setNewMember({ ...newMember, nickname: e.target.value })}
            className="border rounded px-2 py-1"
          />
          <input
            type="password"
            placeholder="初始密码 (≥8)"
            value={newMember.password}
            onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
            className="border rounded px-2 py-1"
          />
          <select
            value={newMember.role}
            onChange={(e) =>
              setNewMember({ ...newMember, role: e.target.value as 'editor' | 'viewer' })
            }
            className="border rounded px-2 py-1"
          >
            <option value="editor">editor</option>
            <option value="viewer">viewer</option>
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={createNew}
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
          + 添加成员
        </button>
      )}
    </main>
  );
}
