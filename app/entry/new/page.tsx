'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MediaImage } from '@/components/media/MediaImage';
import { UploadButton, type UploadedMedia } from '@/components/media/UploadButton';

function NewEntryForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const babyId = sp.get('babyId') ?? '';
  const [milestones, setMilestones] = useState<{ id: string; name: string; icon: string }[]>([]);
  const [selectedMilestoneIds, setSelectedMilestoneIds] = useState<Set<string>>(new Set());
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  function onUploaded(media: UploadedMedia) {
    setUploadedMedia((prev) => {
      const index = prev.findIndex((item) => item.mediaId === media.mediaId);
      if (index === -1) return [...prev, media];
      const next = prev.slice();
      next[index] = media;
      return next;
    });
  }

  async function onSubmit(formData: FormData) {
    setSubmitting(true);
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
    if (!res.ok) {
      setSubmitting(false);
      setError(res.status === 404 ? '没有权限' : '提交失败');
      return;
    }

    const data = await res.json();
    for (const media of uploadedMedia.filter((item) => item.status === 'ready')) {
      const attach = await fetch(`/api/entries/${data.id}/media/${media.mediaId}/attach`, {
        method: 'POST'
      });
      if (!attach.ok) {
        setSubmitting(false);
        setError('媒体关联失败');
        return;
      }
    }
    setSubmitting(false);
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
        <div>
          <p className="text-sm font-medium mb-2">照片 / 视频</p>
          <UploadButton babyId={babyId} onUploaded={onUploaded} disabled={submitting} />
          {uploadedMedia.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {uploadedMedia.map((media) => (
                <li key={media.mediaId} className="flex items-center gap-2 rounded border p-2">
                  {media.status === 'ready' ? (
                    <MediaImage
                      mediaId={media.mediaId}
                      size="thumb"
                      alt={media.filename}
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded object-cover"
                    />
                  ) : (
                    <span className="text-sm">上传中… {media.filename}</span>
                  )}
                  <button
                    type="button"
                    className="text-sm text-red-600"
                    onClick={() =>
                      setUploadedMedia((prev) =>
                        prev.filter((item) => item.mediaId !== media.mediaId)
                      )
                    }
                  >
                    移除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded">
            取消
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {submitting ? '保存中…' : '保存'}
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
