'use client';

import * as React from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { ActionSheet, type ActionSheetOption } from '@/components/mobile/ActionSheet';
import { cn } from '@/lib/cn';
import { Avatar } from './Avatar';

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
  const options: ActionSheetOption[] = [
    { label: '拍照', onSelect: onCameraSelect ?? (() => undefined) },
    { label: '从相册选择', onSelect: onLibrarySelect ?? (() => undefined) },
    ...(src && onRemoveAvatar ? [{ label: '移除头像', destructive: true, onSelect: onRemoveAvatar }] : [])
  ];

  return (
    <div className={cn('bl-avatar-picker inline-flex flex-col items-center gap-[10px]', className)}>
      <button
        type="button"
        aria-label="设置头像"
        className="relative rounded-[var(--radius-pill)] transition-transform duration-[var(--duration-fast)] ease-[var(--ease)] active:scale-[.96]"
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) setOpen(true);
        }}
        {...rest}
      >
        <Avatar src={src} name={name} alt={name || '头像'} size="xl" colorKey={colorKey ?? name} />
        <span className="bl-avatar-picker__camera absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-[var(--radius-pill)] border-[3px] border-[var(--color-bg)] bg-[var(--color-primary)] text-[color:var(--color-fg-inverse)]">
          <CameraIcon />
        </span>
      </button>
      {hint && <p className="max-w-48 text-center text-[length:var(--text-xs)] font-semibold text-[color:var(--color-fg-soft)]">{hint}</p>}
      <ActionSheet open={open} onOpenChange={setOpen} title="设置头像" options={options} />
    </div>
  );
}

function CameraIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[14px] w-[14px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="M9 7l1.2-2h3.6L15 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}
