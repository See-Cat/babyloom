'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/mobile/AppShell';
import { EntryComposer } from '@/components/features/EntryComposer';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const formId = 'edit-entry-form';

interface EntryDto {
  id: string;
  content: string;
  occurredAt: number;
  milestones?: { id: string; name: string; icon: string }[];
}

interface MilestoneDto {
  id: string;
  name: string;
  icon: string;
}

export default function EditEntryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [entry, setEntry] = useState<EntryDto | null>(null);
  const [allMilestones, setAllMilestones] = useState<MilestoneDto[]>([]);
  const [content, setContent] = useState('');
  const [selectedMilestoneIds, setSelectedMilestoneIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    (async () => {
      const [eRes, mRes] = await Promise.all([
        fetch(`/api/entries/${params.id}`),
        fetch('/api/milestones')
      ]);
      if (!eRes.ok) {
        setError('记录不存在或无权限');
        return;
      }
      const e: EntryDto = await eRes.json();
      const m: { milestones: MilestoneDto[] } = await mRes.json();
      setEntry(e);
      setContent(e.content);
      setSelectedMilestoneIds(new Set((e.milestones ?? []).map((x) => x.id)));
      setAllMilestones(m.milestones);
    })();
  }, [params.id]);

  function toggleMilestone(id: string) {
    setSelectedMilestoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit() {
    if (!entry) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/entries/${entry.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content,
        milestoneIds: Array.from(selectedMilestoneIds)
      })
    });
    setPending(false);
    if (!res.ok) {
      setError(res.status === 404 ? '没有权限' : '保存失败');
      return;
    }
    router.push(`/entry/${entry.id}`);
    router.refresh();
  }

  if (!entry) {
    return (
      <AppShell title="编辑记录">
        <Card>加载中…</Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="编辑记录"
      leftSlot={
        <button type="button" className="text-[length:var(--text-sm)] font-bold text-[color:var(--color-fg)]" onClick={() => router.back()}>
          返回
        </button>
      }
      rightSlot={
        <Button type="submit" form={formId} size="sm" disabled={pending || content.trim().length === 0}>
          {pending ? '保存中…' : '保存'}
        </Button>
      }
    >
      <EntryComposer
        formId={formId}
        content={content}
        milestones={allMilestones}
        selectedMilestoneIds={selectedMilestoneIds}
        error={error}
        submitting={pending}
        onContentChange={setContent}
        onToggleMilestone={toggleMilestone}
        onSubmitClick={onSubmit}
      />
    </AppShell>
  );
}
