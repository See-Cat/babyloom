'use client';

import { useState } from 'react';
import { loginAction } from './actions';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await loginAction(formData);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form action={onSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-center">登录 Babyloom</h1>
        <input
          name="email"
          type="email"
          required
          placeholder="邮箱"
          className="border rounded px-3 py-2"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="密码"
          className="border rounded px-3 py-2"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="bg-black text-white rounded py-2 disabled:opacity-50"
        >
          {pending ? '登录中…' : '登录'}
        </button>
      </form>
    </main>
  );
}
