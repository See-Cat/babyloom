'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function NewEntryForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const babyId = sp.get('babyId') ?? '';
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!babyId) router.replace('/timeline');
  }, [babyId, router]);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const res = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        babyId,
        content: String(formData.get('content') ?? '')
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
