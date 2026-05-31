'use client';

import * as React from 'react';
import { Avatar } from './Avatar';
import { CameraIcon, XIcon } from './icons';

export interface AvatarUploadProps {
  /** Name used for the initials fallback when no image is shown. */
  name: string;
  /** Currently displayed avatar (a preview object URL or a saved URL). */
  src?: string | null;
  colorKey?: string;
  disabled?: boolean;
  /** Called with the chosen file. Never called on a cancelled file dialog. */
  onPick: (file: File) => void;
  /** When provided and an avatar is shown, renders a top-right delete button. */
  onRemove?: () => void;
  /** Return false to block opening the picker (e.g. an offline guard). */
  onBeforePick?: () => boolean;
}

export function AvatarUpload({ name, src, colorKey, disabled, onPick, onRemove, onBeforePick }: AvatarUploadProps) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const hasAvatar = Boolean(src);

  function openPicker() {
    if (disabled) return;
    if (onBeforePick && !onBeforePick()) return;
    fileRef.current?.click();
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        aria-label="选择头像"
        disabled={disabled}
        onClick={openPicker}
        className="relative inline-flex h-[88px] w-[88px] items-center justify-center rounded-full focus-visible:outline-[3px] focus-visible:outline-[color:var(--color-focus)] disabled:opacity-60"
      >
        <Avatar src={src ?? undefined} name={name || '头像'} colorKey={colorKey} size="xl" />
        <span
          aria-hidden="true"
          className="absolute -bottom-[2px] -right-[2px] inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-primary)] text-[color:var(--color-fg-inverse)] ring-[3px] ring-[var(--color-bg)]"
        >
          <CameraIcon className="h-3.5 w-3.5" />
        </span>
      </button>
      {hasAvatar && onRemove && (
        <button
          type="button"
          aria-label="删除头像"
          disabled={disabled}
          onClick={onRemove}
          className="absolute -right-1 -top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-bg)] text-[color:var(--color-muted)] ring-1 ring-[color:var(--color-border-light)] transition active:scale-95"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          // Reset so picking the same file again still fires change, and so a
          // cancelled dialog (no file) never clears the current selection.
          event.currentTarget.value = '';
          if (file) onPick(file);
        }}
      />
    </div>
  );
}
