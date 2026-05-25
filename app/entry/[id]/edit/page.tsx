'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/mobile/AppShell';
import { ActionSheet } from '@/components/mobile/ActionSheet';
import { EntryComposer } from '@/components/features/EntryComposer';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChevronLeftIcon } from '@/components/ui/icons';
import type { UploadedMedia } from '@/components/media/UploadButton';
import { parseBirthdayToMillis } from '@/lib/format-time';

const formId = 'edit-entry-form';

interface MilestoneDto {
  id: string;
  name: string;
  icon: string;
}

interface EntryMediaDto {
  mediaId: string;
  filename: string;
  status: 'ready' | 'pending';
  type?: 'photo' | 'video';
}

interface EntryDto {
  id: string;
  babyId: string;
  content: string;
  occurredAt: number;
  milestones?: MilestoneDto[];
  media?: EntryMediaDto[];
}

export default function EditEntryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [entry, setEntry] = useState<EntryDto | null>(null);
  const [babyName, setBabyName] = useState('');
  const [babyBirthMs, setBabyBirthMs] = useState<number | undefined>(undefined);
  const [allMilestones, setAllMilestones] = useState<MilestoneDto[]>([]);
  const [content, setContent] = useState('');
  const [occurredAt, setOccurredAt] = useState<number>(0);
  const [selectedMilestoneIds, setSelectedMilestoneIds] = useState<Set<string>>(new Set());
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([]);
  const [originalMediaIds, setOriginalMediaIds] = useState<Set<string>>(new Set());
  const [originalMilestoneIds, setOriginalMilestoneIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const originalContent = entry?.content ?? '';
  const originalOccurredAt = entry?.occurredAt ?? 0;
  const currentMediaIds = new Set(uploadedMedia.filter((m) => m.status === 'ready').map((m) => m.mediaId));
  const dirty =
    content !== originalContent ||
    occurredAt !== originalOccurredAt ||
    !setsEqual(selectedMilestoneIds, originalMilestoneIds) ||
    !setsEqual(currentMediaIds, originalMediaIds);

  function onBack() {
    if (dirty) setLeaveOpen(true);
    else router.back();
  }

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
      setOccurredAt(e.occurredAt);
      const selectedIds = new Set((e.milestones ?? []).map((x) => x.id));
      setSelectedMilestoneIds(selectedIds);
      setOriginalMilestoneIds(new Set(selectedIds));
      const initialMedia = (e.media ?? []).map((item) => ({
        mediaId: item.mediaId,
        filename: item.filename,
        status: item.status,
        type: item.type
      }));
      setUploadedMedia(initialMedia);
      setOriginalMediaIds(new Set(initialMedia.filter((x) => x.status === 'ready').map((x) => x.mediaId)));
      setAllMilestones(m.milestones);

      const babyRes = await fetch(`/api/babies/${e.babyId}`).catch(() => null);
      if (babyRes?.ok) {
        const body = await babyRes.json();
        if (body?.name) setBabyName(body.name);
        if (typeof body?.birthday === 'string') {
          const ms = parseBirthdayToMillis(body.birthday);
          if (ms !== null) setBabyBirthMs(ms);
        }
      }
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

  function onUploaded(media: UploadedMedia) {
    setUploadedMedia((prev) => {
      const index = prev.findIndex((item) => item.mediaId === media.mediaId);
      if (index === -1) return [...prev, media];
      const next = prev.slice();
      next[index] = media;
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
        occurredAt,
        milestoneIds: Array.from(selectedMilestoneIds)
      })
    });
    if (!res.ok) {
      setPending(false);
      setError(res.status === 404 ? '没有权限' : '保存失败');
      return;
    }

    const toAttach = [...currentMediaIds].filter((id) => !originalMediaIds.has(id));
    const toDetach = [...originalMediaIds].filter((id) => !currentMediaIds.has(id));
    for (const mediaId of toAttach) {
      const r = await fetch(`/api/entries/${entry.id}/media/${mediaId}/attach`, { method: 'POST' });
      if (!r.ok) {
        setPending(false);
        setError('媒体关联失败');
        return;
      }
    }
    for (const mediaId of toDetach) {
      const r = await fetch(`/api/entries/${entry.id}/media/${mediaId}/attach`, { method: 'DELETE' });
      if (!r.ok) {
        setPending(false);
        setError('媒体移除失败');
        return;
      }
    }

    setPending(false);
    router.push(`/entry/${entry.id}`);
    router.refresh();
  }

  if (!entry) {
    return (
      <AppShell title="编辑记录">
        <Card>{error ?? '加载中…'}</Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="编辑记录"
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
            pending ||
            (content.trim().length === 0 && currentMediaIds.size === 0)
          }
        >
          {pending ? '保存中…' : '保存'}
        </Button>
      }
    >
      <EntryComposer
        formId={formId}
        babyId={entry.babyId}
        babyName={babyName || undefined}
        content={content}
        milestones={allMilestones}
        selectedMilestoneIds={selectedMilestoneIds}
        uploadedMedia={uploadedMedia}
        error={error}
        submitting={pending}
        occurredAt={occurredAt}
        minOccurredAt={babyBirthMs}
        onOccurredAtChange={setOccurredAt}
        onContentChange={setContent}
        onToggleMilestone={toggleMilestone}
        onUploaded={onUploaded}
        onRemoveMedia={(mediaId) => setUploadedMedia((prev) => prev.filter((item) => item.mediaId !== mediaId))}
        onSubmitClick={onSubmit}
      />
      <ActionSheet
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="还有未保存的修改"
        options={[
          { label: '放弃修改', destructive: true, onSelect: () => router.back() },
          { label: '继续编辑', onSelect: () => undefined }
        ]}
      />
    </AppShell>
  );
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}
