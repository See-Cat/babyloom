'use client';

import * as React from 'react';
import { Textarea } from '@/components/ui/Textarea';
import { Avatar } from '@/components/ui/Avatar';
import { DatePicker } from '@/components/ui/DatePicker';
import { ClockIcon } from '@/components/ui/icons';
import type { UploadedMedia } from '@/components/media/UploadButton';
import { requireOnline } from '@/lib/client/require-online';
import { useToast } from '@/lib/client/hooks/useToast';
import { useTimezone, useRenderNow } from '@/components/system/TimezoneProvider';
import { zonedParts, zonedWallTimeToMillis, type ZonedParts } from '@/lib/shared/format-time';
import { MediaUploader } from './MediaUploader';
import { MilestonePicker, type MilestonePickerItem } from './MilestonePicker';

const MAX_CHARS = 2000;

export interface EntryComposerProps {
  formId?: string;
  babyId?: string;
  babyName?: string;
  babyAvatarUrl?: string | null;
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
  onRemoveMedia?: (uploadId: string) => void;
  action?: (formData: FormData) => void | Promise<void>;
  onSubmitClick?: () => void;
}

export function EntryComposer({
  action,
  babyId,
  babyName,
  babyAvatarUrl,
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
  const timeZone = useTimezone();
  const renderNow = useRenderNow();
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
          <Avatar src={babyAvatarUrl ?? undefined} name={babyName} size="md" colorKey={babyAvatarColorKey ?? babyId ?? babyName} />
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
              value={millisToString(occurredAt, timeZone)}
              minValue={minOccurredAt ? millisToString(minOccurredAt, timeZone) : undefined}
              maxValue={millisToString(Date.now(), timeZone)}
              onChange={(next) => {
                const ms = stringToMillis(next, timeZone);
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
                  <span>{hasValue ? formatPillLabel(label, timeZone, renderNow || Date.now(), occurredAt) : '现在'}</span>
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

// The picker edits wall-clock parts; we interpret/produce them in the configured
// timezone so a saved occurredAt is the instant that timezone implies — matching
// how the timeline/detail later display it, regardless of the device timezone.
function millisToString(ms: number | undefined, timeZone: string): string {
  if (!ms) return '';
  const p = zonedParts(ms, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}

function stringToMillis(value: string, timeZone: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(value);
  if (!match) return null;
  const ms = zonedWallTimeToMillis(
    {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: match[4] ? Number(match[4]) : 0,
      minute: match[5] ? Number(match[5]) : 0
    },
    timeZone
  );
  return Number.isNaN(ms) ? null : ms;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dayOrdinal(p: ZonedParts): number {
  return Date.UTC(p.year, p.month - 1, p.day);
}

function formatPillLabel(fallback: string, timeZone: string, nowMs: number, ms?: number): string {
  if (!ms) return fallback;
  const p = zonedParts(ms, timeZone);
  const now = zonedParts(nowMs, timeZone);
  const time = `${pad(p.hour)}:${pad(p.minute)}`;
  const dayDiff = Math.round((dayOrdinal(now) - dayOrdinal(p)) / 86_400_000);
  if (dayDiff === 0) return `今天 ${time}`;
  if (dayDiff === 1) return `昨天 ${time}`;
  return `${p.month}月${p.day}日 ${time}`;
}
