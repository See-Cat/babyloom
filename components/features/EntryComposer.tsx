'use client';

import * as React from 'react';
import { Textarea } from '@/components/ui/Textarea';
import type { UploadedMedia } from '@/components/media/UploadButton';
import { requireOnline } from '@/lib/client/require-online';
import { useToast } from '@/lib/hooks/useToast';
import { MediaUploader } from './MediaUploader';
import { MilestonePicker, type MilestonePickerItem } from './MilestonePicker';

const MAX_CHARS = 2000;

export interface EntryComposerProps {
  formId?: string;
  babyId?: string;
  babyName?: string;
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
  babyName,
  content = '',
  contentName = 'content',
  contentPlaceholder = '今天小乐做了什么呢…',
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
  const charCount = content.length;
  const showCounter = charCount >= MAX_CHARS / 2;

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
      {babyName && (
        <p className="text-[length:var(--text-sm)] font-semibold text-[color:var(--color-fg-soft)]">
          记录给 <span className="font-bold text-[color:var(--color-fg-strong)]">{babyName}</span>
        </p>
      )}
      <div>
        <Textarea
          name={contentName}
          required
          rows={8}
          placeholder={contentPlaceholder}
          value={content}
          maxLength={MAX_CHARS}
          onChange={(event) => onContentChange?.(event.target.value)}
        />
        {showCounter && (
          <p
            className="mt-[var(--space-1)] text-right text-[length:var(--text-xs)] font-semibold text-[color:var(--color-fg-soft)]"
            aria-live="polite"
          >
            {charCount} / {MAX_CHARS}
          </p>
        )}
      </div>
      <MilestonePicker milestones={milestones} selectedIds={selectedMilestoneIds} onToggle={onToggleMilestone} />
      {babyId && onUploaded && onRemoveMedia && (
        <MediaUploader babyId={babyId} uploadedMedia={uploadedMedia} disabled={submitting} onUploaded={onUploaded} onRemove={onRemoveMedia} />
      )}
      {error && (
        <p role="alert" className="flex items-center gap-[var(--space-2)] rounded-[var(--radius-base)] bg-[var(--color-error-bg)] px-[var(--space-4)] py-[var(--space-3)] text-[length:var(--text-sm)] font-semibold text-[color:var(--color-error-active)]">
          <span aria-hidden="true" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-error)] text-[length:var(--text-xs)] font-bold text-white">!</span>
          {error}
        </p>
      )}
    </form>
  );
}
