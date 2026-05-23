'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/mobile/AppShell';
import { BabyCard } from '@/components/features/BabyCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Toast } from '@/components/ui/Toast';
import { useTrashAction } from '@/lib/hooks/useTrashAction';

interface Baby {
  id: string;
  name: string;
  birthday: string;
  gender: string;
  avatarUrl?: string | null;
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
    <AppShell
      title="宝宝管理"
      leftSlot={
        <Link href="/profile" className="text-[length:var(--text-sm)] text-[color:var(--color-muted)]">
          返回
        </Link>
      }
    >
      <ul className="mb-[var(--space-6)] flex flex-col gap-[var(--space-3)]">
        {babies.map((b) => (
          <li key={b.id}>
            <BabyCard
              baby={b}
              editing={editingId === b.id}
              editName={editName}
              onEditNameChange={setEditName}
              onSave={() => rename(b.id)}
              onCancelEdit={() => setEditingId(null)}
              onEdit={() => {
                setEditingId(b.id);
                setEditName(b.name);
              }}
              onTrash={() => trash(b.id)}
            />
          </li>
        ))}
      </ul>

      {creating ? (
        <Card className="flex flex-col gap-[var(--space-3)]">
          <Input label="名字" placeholder="名字" value={newBaby.name} onChange={(e) => setNewBaby({ ...newBaby, name: e.target.value })} />
          <DatePicker
            name="birthday"
            label="生日"
            value={newBaby.birthday}
            onChange={(birthday) => setNewBaby({ ...newBaby, birthday })}
          />
          <SegmentedControl
            ariaLabel="性别"
            value={newBaby.gender}
            onChange={(value) => setNewBaby({ ...newBaby, gender: value })}
            className="grid-cols-3"
            options={[
              { value: 'girl', label: '女宝' },
              { value: 'boy', label: '男宝' },
              { value: 'other', label: '其他' }
            ]}
          />
          <div className="flex gap-[var(--space-2)]">
            <Button type="button" size="sm" onClick={createBaby}>
              创建
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
              取消
            </Button>
          </div>
        </Card>
      ) : (
        <Button type="button" variant="secondary" onClick={() => setCreating(true)} fullWidth>
          + 添加宝宝
        </Button>
      )}
      {trashAction.toast && (
        <div className="fixed bottom-[calc(var(--space-4)+env(safe-area-inset-bottom))] left-[var(--space-4)] right-[var(--space-4)] z-[var(--z-toast)] mx-auto max-w-sm">
          <Toast
            message={`已删除 · ${trashAction.toast.label}`}
            action={
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={async () => {
                  const restored = await trashAction.undo();
                  if (restored) {
                    reload();
                    router.refresh();
                  }
                }}
              >
                撤销
              </Button>
            }
          />
        </div>
      )}
    </AppShell>
  );
}
