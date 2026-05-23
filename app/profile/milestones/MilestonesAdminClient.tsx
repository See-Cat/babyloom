'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/mobile/AppShell';
import { MilestoneRow } from '@/components/features/MilestoneRow';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
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
  const [draft, setDraft] = useState({ name: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ name: '' });
  const [removeFor, setRemoveFor] = useState<Milestone | null>(null);

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
    if (!draft.name) return;
    await fetch('/api/milestones', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...draft, icon: 'custom' })
    });
    setCreating(false);
    setDraft({ name: '' });
    reload();
  }

  async function remove(id: string) {
    await fetch(`/api/milestones/${id}`, { method: 'DELETE' });
    setRemoveFor(null);
    reload();
  }

  async function saveEdit(id: string) {
    await fetch(`/api/milestones/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(editDraft)
    });
    setEditingId(null);
    setEditDraft({ name: '' });
    reload();
  }

  return (
    <AppShell
      title="里程碑设置"
      leftSlot={
        <Link href="/profile" className="text-[length:var(--text-sm)] text-[color:var(--color-muted)]">
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
                setEditDraft({ name: m.name });
              }}
              onRemove={() => setRemoveFor(m)}
            />
          </li>
        ))}
      </ul>

      {creating ? (
        <Card className="flex flex-col gap-[var(--space-3)]">
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
      <Dialog
        open={Boolean(removeFor)}
        onOpenChange={(open) => {
          if (!open) setRemoveFor(null);
        }}
        title="删除里程碑"
        dismissible={false}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setRemoveFor(null)}>
              取消
            </Button>
            <Button type="button" variant="error" onClick={() => removeFor && remove(removeFor.id)}>
              删除
            </Button>
          </>
        }
      >
        <p className="text-[length:var(--text-sm)] leading-[var(--leading-base)] text-[color:var(--color-fg)]">
          确认删除 {removeFor?.name ?? '该里程碑'}? 已挂在记录上的会断开关联,不会删除记录。
        </p>
      </Dialog>
    </AppShell>
  );
}
