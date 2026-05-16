'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function NewEntryForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const babyId = sp.get('babyId') ?? '';
  const [milestones, setMilestones] = useState<{ id: string; name: string; icon: string }[]>([]);
  const [selectedMilestoneIds, setSelectedMilestoneIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!babyId) router.replace('/timeline');
  }, [babyId, router]);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/milestones');
      if (!res.ok) return;
      const body = await res.json();
      setMilestones(body.milestones);
    })();
  }, []);

  function toggleMilestone(id: string) {
    setSelectedMilestoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const res = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        babyId,
        content: String(formData.get('content') ?? ''),
        milestoneIds: Array.from(selectedMilestoneIds)
      })
    });
    setPending(false);
    if (!res.ok) {
      setError(res.status === 404 ? '没有权限' : '提交失败');
      return;
    }

    const data = await res.json();
    router.push(`/entry/${data.id}`);
    router.refresh();
  }

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <form action={onSubmit} className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">新记录</h1>
        <textarea
          name="content"
          required
          rows={8}
          placeholder="今天发生了什么…"
          className="border rounded px-3 py-2 resize-none"
        />
        {milestones.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">里程碑</p>
            <div className="flex flex-wrap gap-2">
              {milestones.map((m) => (
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
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded">
            取消
          </button>
          <button
            type="submit"
            disabled={pending}
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {pending ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <NewEntryForm />
    </Suspense>
  );
}
