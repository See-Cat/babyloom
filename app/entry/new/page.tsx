'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/mobile/AppShell';
import { ActionSheet } from '@/components/mobile/ActionSheet';
import { EntryComposer } from '@/components/features/EntryComposer';
import { Button } from '@/components/ui/Button';
import { ChevronLeftIcon } from '@/components/ui/icons';
import type { UploadedMedia } from '@/components/media/UploadButton';
import { parseBirthdayToMillis } from '@/lib/format-time';

const formId = 'new-entry-form';

function NewEntryForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const babyId = sp.get('babyId') ?? '';
  const [babyName, setBabyName] = useState<string>('');
  const [babyBirthMs, setBabyBirthMs] = useState<number | undefined>(undefined);
  const [content, setContent] = useState('');
  const [occurredAt, setOccurredAt] = useState<number>(() => Date.now());
  const [milestones, setMilestones] = useState<{ id: string; name: string; icon: string }[]>([]);
  const [selectedMilestoneIds, setSelectedMilestoneIds] = useState<Set<string>>(new Set());
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const dirty = content.trim().length > 0 || selectedMilestoneIds.size > 0 || uploadedMedia.length > 0;

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

  useEffect(() => {
    if (!babyId) return;
    (async () => {
      const res = await fetch(`/api/babies/${babyId}`).catch(() => null);
      if (!res?.ok) return;
      const body = await res.json();
      if (body?.name) setBabyName(body.name);
      if (typeof body?.birthday === 'string') {
        const ms = parseBirthdayToMillis(body.birthday);
        if (ms !== null) setBabyBirthMs(ms);
      }
    })();
  }, [babyId]);

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

  function onBack() {
    if (dirty) setLeaveOpen(true);
    else router.back();
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
        milestoneIds: Array.from(selectedMilestoneIds),
        occurredAt
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
    <AppShell
      title="新记录"
      align="center"
      hideTabbar
      leftSlot={
        <button
          type="button"
          aria-label="返回"
          onClick={onBack}
          className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-[color:var(--color-fg)] text-2xl leading-none active:bg-black/5"
        >
          <ChevronLeftIcon />
        </button>
      }
      rightSlot={
        <Button
          type="submit"
          form={formId}
          size="sm"
          disabled={
            submitting ||
            (content.trim().length === 0 && uploadedMedia.filter((m) => m.status === 'ready').length === 0)
          }
        >
          {submitting ? '保存中…' : '保存'}
        </Button>
      }
    >
      <EntryComposer
        formId={formId}
        action={onSubmit}
        babyId={babyId}
        babyName={babyName || undefined}
        content={content}
        milestones={milestones}
        selectedMilestoneIds={selectedMilestoneIds}
        uploadedMedia={uploadedMedia}
        error={error}
        submitting={submitting}
        occurredAt={occurredAt}
        minOccurredAt={babyBirthMs}
        onOccurredAtChange={setOccurredAt}
        onContentChange={setContent}
        onToggleMilestone={toggleMilestone}
        onUploaded={onUploaded}
        onRemoveMedia={(mediaId) => setUploadedMedia((prev) => prev.filter((item) => item.mediaId !== mediaId))}
      />
      <ActionSheet
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="还有未保存的内容"
        options={[
          { label: '放弃当前记录', destructive: true, onSelect: () => router.back() },
          { label: '继续编辑', onSelect: () => undefined }
        ]}
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
