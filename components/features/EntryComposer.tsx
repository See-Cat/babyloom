'use client';

import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import type { UploadedMedia } from '@/components/media/UploadButton';
import { requireOnline } from '@/lib/client/require-online';
import { useToast } from '@/lib/hooks/useToast';
import { MediaUploader } from './MediaUploader';
import { MilestonePicker, type MilestonePickerItem } from './MilestonePicker';

export interface EntryComposerProps {
  babyId?: string;
  content?: string;
  contentName?: string;
  contentPlaceholder?: string;
  milestones: MilestonePickerItem[];
  selectedMilestoneIds: Set<string>;
  uploadedMedia?: UploadedMedia[];
  error?: string | null;
  submitting?: boolean;
  submitLabel?: string;
  pendingLabel?: string;
  onContentChange?: (value: string) => void;
  onToggleMilestone: (id: string) => void;
  onUploaded?: (media: UploadedMedia) => void;
  onRemoveMedia?: (mediaId: string) => void;
  onCancel: () => void;
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
  milestones,
  onCancel,
  onContentChange,
  onRemoveMedia,
  onSubmitClick,
  onToggleMilestone,
  onUploaded,
  pendingLabel = '保存中…',
  selectedMilestoneIds,
  submitLabel = '保存',
  submitting = false,
  uploadedMedia = []
}: EntryComposerProps) {
  const toast = useToast();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!requireOnline(toast)) event.preventDefault();
  }

  function onSaveClick() {
    if (!requireOnline(toast)) return;
    onSubmitClick?.();
  }

  return (
    <form action={action} className="flex flex-col gap-[var(--space-4)]" onSubmit={onSubmit}>
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
      {error && <p role="alert" className="text-[var(--text-sm)] text-[var(--color-error)]">{error}</p>}
      <div className="flex justify-end gap-[var(--space-2)]">
        <Button type="button" variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button type={onSubmitClick ? 'button' : 'submit'} disabled={submitting} onClick={onSubmitClick ? onSaveClick : undefined}>
          {submitting ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
