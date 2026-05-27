'use client';

import * as React from 'react';
import { Textarea } from '@/components/ui/Textarea';
import { Avatar } from '@/components/ui/Avatar';
import { DatePicker, nowDatePickerValue } from '@/components/ui/DatePicker';
import { ClockIcon } from '@/components/ui/icons';
import type { UploadedMedia } from '@/components/media/UploadButton';
import { requireOnline } from '@/lib/client/require-online';
import { useToast } from '@/lib/client/hooks/useToast';
import { MediaUploader } from './MediaUploader';
import { MilestonePicker, type MilestonePickerItem } from './MilestonePicker';

const MAX_CHARS = 2000;

export interface EntryComposerProps {
  formId?: string;
  babyId?: string;
  babyName?: string;
  babyAvatarColorKey?: string;
  content?: string;
  contentName?: string;
  contentPlaceholder?: string;
  milestones: MilestonePickerItem[];
  selectedMilestoneIds: Set<string>;
  uploadedMedia?: UploadedMedia[];
  error?: string | null;
  submitting?: boolean;
  occurredAt?: number;
  minOccurredAt?: number;
  onOccurredAtChange?: (value: number) => void;
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
  babyAvatarColorKey,
  content = '',
  contentName = 'content',
  contentPlaceholder,
  error,
  formId,
  milestones,
  occurredAt,
  minOccurredAt,
  onContentChange,
  onOccurredAtChange,
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
  const placeholder = contentPlaceholder ?? `今天${babyName ?? '宝宝'}做了什么呢…也可以直接放张照片`;

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
        <div className="flex items-center gap-[var(--space-3)] px-[var(--space-1)]">
          <Avatar name={babyName} size="md" colorKey={babyAvatarColorKey ?? babyId ?? babyName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[length:var(--text-sm)] font-bold text-[color:var(--color-fg)]">{babyName}</p>
            <p className="truncate text-[length:var(--text-xs)] font-semibold text-[color:var(--color-fg-soft)]">记录给</p>
          </div>
          {onOccurredAtChange && (
            <DatePicker
              name="occurredAt"
              label="发生时间"
              mode="datetime"
              hideLabel
              value={millisToString(occurredAt)}
              minValue={minOccurredAt ? millisToString(minOccurredAt) : undefined}
              maxValue={nowDatePickerValue('datetime')}
              onChange={(next) => {
                const ms = stringToMillis(next);
                if (ms !== null) onOccurredAtChange(ms);
              }}
              renderTrigger={({ open, label, hasValue }) => (
                <button
                  type="button"
                  onClick={open}
                  aria-label="选择发生时间"
                  className="inline-flex items-center gap-[var(--space-2)] h-8 px-3 rounded-[var(--radius-pill)] bg-[var(--color-surface-2)] text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg)] shadow-[var(--shadow-press-sm)] active:translate-y-[2px] active:shadow-[var(--shadow-press-sm-active)]"
                >
                  <ClockIcon className="h-4 w-4" />
                  <span>{hasValue ? formatPillLabel(label, occurredAt) : '现在'}</span>
                </button>
              )}
            />
          )}
        </div>
      )}

      <div>
        <Textarea
          name={contentName}
          rows={8}
          placeholder={placeholder}
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
      {babyId && onUploaded && onRemoveMedia && (
        <MediaUploader babyId={babyId} uploadedMedia={uploadedMedia} disabled={submitting} onUploaded={onUploaded} onRemove={onRemoveMedia} />
      )}
      <MilestonePicker milestones={milestones} selectedIds={selectedMilestoneIds} onToggle={onToggleMilestone} />
      {error && (
        <p role="alert" className="flex items-center gap-[var(--space-2)] rounded-[var(--radius-base)] bg-[var(--color-error-bg)] px-[var(--space-4)] py-[var(--space-3)] text-[length:var(--text-sm)] font-semibold text-[color:var(--color-error-active)]">
          <span aria-hidden="true" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-error)] text-[length:var(--text-xs)] font-bold text-white">!</span>
          {error}
        </p>
      )}
    </form>
  );
}

function millisToString(ms: number | undefined): string {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function stringToMillis(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(value);
  if (!match) return null;
  const ms = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), match[4] ? Number(match[4]) : 0, match[5] ? Number(match[5]) : 0).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatPillLabel(fallback: string, ms?: number): string {
  if (!ms) return fallback;
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (sameDay) return `今天 ${time}`;
  const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (d.getFullYear() === yest.getFullYear() && d.getMonth() === yest.getMonth() && d.getDate() === yest.getDate()) {
    return `昨天 ${time}`;
  }
  return `${d.getMonth() + 1}月${d.getDate()}日 ${time}`;
}
