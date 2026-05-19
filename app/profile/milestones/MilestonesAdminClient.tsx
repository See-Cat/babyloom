'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/mobile/AppShell';
import { MilestoneRow } from '@/components/features/MilestoneRow';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

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
    <AppShell
      title="里程碑设置"
      leftSlot={
        <Link href="/profile" className="text-[var(--text-sm)] text-[var(--color-muted)]">
          返回
        </Link>
      }
    >
      <ul className="mb-[var(--space-6)] grid gap-[var(--space-2)] sm:grid-cols-2">
        {items.map((m) => (
          <li key={m.id}>
            <MilestoneRow
              milestone={m}
              editing={editingId === m.id}
              editDraft={editDraft}
              onEditDraftChange={setEditDraft}
              onSave={() => saveEdit(m.id)}
              onCancelEdit={() => setEditingId(null)}
              onEdit={() => {
                setEditingId(m.id);
                setEditDraft({ name: m.name, icon: m.icon });
              }}
              onRemove={() => remove(m.id)}
            />
          </li>
        ))}
      </ul>

      {creating ? (
        <Card className="flex flex-col gap-[var(--space-3)]">
          <Input label="emoji" placeholder="emoji (如 🎉)" value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} maxLength={4} />
          <Input label="名称" placeholder="名称 (如 第一次叫妈妈)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <div className="flex gap-[var(--space-2)]">
            <Button type="button" size="sm" onClick={create}>
              创建
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
              取消
            </Button>
          </div>
        </Card>
      ) : (
        <Button type="button" variant="secondary" onClick={() => setCreating(true)} fullWidth>
          + 添加里程碑
        </Button>
      )}
    </AppShell>
  );
}
