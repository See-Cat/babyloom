'use client';

import * as React from 'react';
import { Textarea } from '@/components/ui/Textarea';
import type { UploadedMedia } from '@/components/media/UploadButton';
import { requireOnline } from '@/lib/client/require-online';
import { useToast } from '@/lib/hooks/useToast';
import { MediaUploader } from './MediaUploader';
import { MilestonePicker, type MilestonePickerItem } from './MilestonePicker';

export interface EntryComposerProps {
  formId?: string;
  babyId?: string;
  content?: string;
  contentName?: string;
  contentPlaceholder?: string;
  milestones: MilestonePickerItem[];
  selectedMilestoneIds: Set<string>;
  uploadedMedia?: UploadedMedia[];
  error?: string | null;
  submitting?: boolean;
  onContentChange?: (value: string) => void;
  onToggleMilestone: (id: string) => void;
  onUploaded?: (media: UploadedMedia) => void;
  onRemoveMedia?: (mediaId: string) => void;
  action?: (formData: FormData) => void | Promise<void>;
  onSubmitClick?: () => void;
}

export function EntryComposer({
  action,
  babyId,
  content,
  contentName = 'content',
  contentPlaceholder = '今天发生了什么…',
  error,
  formId,
  milestones,
  onContentChange,
  onRemoveMedia,
  onSubmitClick,
  onToggleMilestone,
  onUploaded,
  selectedMilestoneIds,
  submitting = false,
  uploadedMedia = []
}: EntryComposerProps) {
  const toast = useToast();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!requireOnline(toast)) {
      event.preventDefault();
      return;
    }
    if (onSubmitClick) {
      event.preventDefault();
      onSubmitClick();
    }
  }

  return (
    <form id={formId} action={action} className="flex flex-col gap-[var(--space-4)]" onSubmit={onSubmit}>
      <Textarea
        name={contentName}
        required
        rows={8}
        label="记录内容"
        placeholder={contentPlaceholder}
        value={content}
        onChange={(event) => onContentChange?.(event.target.value)}
      />
      <MilestonePicker milestones={milestones} selectedIds={selectedMilestoneIds} onToggle={onToggleMilestone} />
      {babyId && onUploaded && onRemoveMedia && (
        <MediaUploader babyId={babyId} uploadedMedia={uploadedMedia} disabled={submitting} onUploaded={onUploaded} onRemove={onRemoveMedia} />
      )}
      {error && <p role="alert" className="text-[length:var(--text-sm)] text-[color:var(--color-error)]">{error}</p>}
    </form>
  );
}
