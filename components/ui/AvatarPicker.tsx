'use client';

import * as React from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { ActionSheet, type ActionSheetOption } from '@/components/mobile/ActionSheet';
import { cn } from '@/lib/cn';

export interface AvatarPickerProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  name: string;
  src?: string;
  colorKey?: string;
  hint?: string;
  onCameraSelect?: () => void;
  onLibrarySelect?: () => void;
  onRemoveAvatar?: () => void;
}

export function AvatarPicker({
  name,
  src,
  colorKey,
  hint,
  className,
  onCameraSelect,
  onLibrarySelect,
  onRemoveAvatar,
  onClick,
  ...rest
}: AvatarPickerProps) {
  const [open, setOpen] = React.useState(false);
  const fallback = initialFor(name);
  const avatarColor = avatarColorFor(colorKey ?? name);
  const options: ActionSheetOption[] = [
    { label: '拍照', onSelect: onCameraSelect ?? (() => undefined) },
    { label: '从相册选择', onSelect: onLibrarySelect ?? (() => undefined) },
    ...(src && onRemoveAvatar ? [{ label: '移除头像', destructive: true, onSelect: onRemoveAvatar }] : [])
  ];

  return (
    <div className={cn('inline-flex flex-col items-center gap-[10px]', className)}>
      <button
        type="button"
        aria-label="设置头像"
        className="avatar-pick"
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) setOpen(true);
        }}
        {...rest}
      >
        <span className={cn('ava-big', !name && 'empty')} style={{ '--avatar-picker-bg': `var(--color-avatar-${avatarColor})` } as React.CSSProperties}>
          {src ? <img src={src} alt={name || '头像'} className="h-full w-full rounded-full object-cover" /> : fallback}
        </span>
        <span className="cam">
          <CameraIcon />
        </span>
      </button>
      {hint && <p className="max-w-48 text-center text-[length:var(--text-xs)] font-semibold text-[color:var(--color-fg-soft)]">{hint}</p>}
      <ActionSheet open={open} onOpenChange={setOpen} title="设置头像" options={options} />
    </div>
  );
}

function initialFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return /^[a-z]/i.test(trimmed) ? trimmed[0].toUpperCase() : trimmed[0];
}

function avatarColorFor(value: string): string {
  const colors = ['pink', 'blue', 'yellow', 'mint', 'peach', 'teal', 'purple', 'green'];
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return colors[hash % colors.length];
}

function CameraIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[14px] w-[14px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="M9 7l1.2-2h3.6L15 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}
