'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingBabyPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const res = await fetch('/api/babies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: String(formData.get('name') ?? ''),
        birthday: String(formData.get('birthday') ?? ''),
        gender: String(formData.get('gender') ?? 'other')
      })
    });
    setPending(false);
    if (!res.ok) {
      setError('创建失败,请检查输入');
      return;
    }
    router.push('/timeline');
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form action={onSubmit} className="w-full max-w-md flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">第一个宝宝</h1>
        <p className="text-sm opacity-75">先添加一个宝宝才能开始记录</p>
        <input name="name" required placeholder="宝宝名字" className="border rounded px-3 py-2" />
        <input name="birthday" required type="date" className="border rounded px-3 py-2" />
        <select name="gender" required className="border rounded px-3 py-2">
          <option value="girl">女宝</option>
          <option value="boy">男宝</option>
          <option value="other">其他</option>
        </select>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="bg-black text-white rounded py-2 disabled:opacity-50"
        >
          {pending ? '创建中…' : '创建宝宝'}
        </button>
      </form>
    </main>
  );
}
