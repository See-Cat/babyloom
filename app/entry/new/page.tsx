'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/mobile/AppShell';
import { EntryComposer } from '@/components/features/EntryComposer';
import type { UploadedMedia } from '@/components/media/UploadButton';

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
    <AppShell title="新记录">
      <EntryComposer
        action={onSubmit}
        babyId={babyId}
        milestones={milestones}
        selectedMilestoneIds={selectedMilestoneIds}
        uploadedMedia={uploadedMedia}
        error={error}
        submitting={submitting}
        onToggleMilestone={toggleMilestone}
        onUploaded={onUploaded}
        onRemoveMedia={(mediaId) => setUploadedMedia((prev) => prev.filter((item) => item.mediaId !== mediaId))}
        onCancel={() => router.back()}
      />
    </AppShell>
  );
}

export default function Page() {
  return (
    <Suspense>
      <NewEntryForm />
    </Suspense>
  );
}
