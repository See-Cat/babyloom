'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

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

  if (!entry) return <main className="p-4">加载中…</main>;

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">编辑记录</h1>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={8}
        className="w-full border rounded px-3 py-2 resize-none mb-4"
      />
      <div className="mb-4">
        <p className="text-sm font-medium mb-2">里程碑</p>
        <div className="flex flex-wrap gap-2">
          {allMilestones.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleMilestone(m.id)}
              className={`px-3 py-1.5 text-sm border rounded ${
                selectedMilestoneIds.has(m.id) ? 'bg-black text-white' : ''
              }`}
            >
              {m.icon} {m.name}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded">
          取消
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending}
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {pending ? '保存中…' : '保存'}
        </button>
      </div>
    </main>
  );
}
