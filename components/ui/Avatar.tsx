import * as React from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string;
  alt?: string;
  name: string;
  size?: AvatarSize;
  colorKey?: string;
}

export interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  avatars: AvatarProps[];
  max?: number;
}

const sizeClass: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[length:var(--text-xs)]',
  sm: 'h-8 w-8 text-[length:var(--text-xs)]',
  md: 'h-10 w-10 text-[length:var(--text-sm)]',
  lg: 'h-14 w-14 text-[length:var(--text-lg)]',
  xl: 'h-[88px] w-[88px] text-[34px]'
};

const palette = [
  'var(--color-avatar-pink)',
  'var(--color-avatar-blue)',
  'var(--color-avatar-yellow)',
  'var(--color-avatar-mint)',
  'var(--color-avatar-peach)',
  'var(--color-avatar-teal)',
  'var(--color-avatar-purple)',
  'var(--color-avatar-green)'
];

export function Avatar({ src, alt, name, size = 'md', colorKey, className, style, ...rest }: AvatarProps) {
  const fallback = initialFor(name);
  const avatarBg = palette[hashString(colorKey ?? name) % palette.length];
  const fallbackColor = avatarBg === 'var(--color-avatar-yellow)' ? 'var(--color-avatar-yellow-fg)' : 'var(--color-fg-inverse)';

  return (
    <span
      aria-label={alt ?? name}
      className={cn(
        'bl-avatar inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--avatar-bg)] font-bold text-[color:var(--avatar-fg)]',
        sizeClass[size],
        className
      )}
      data-size={size}
      style={{ '--avatar-bg': avatarBg, '--avatar-fg': fallbackColor, color: 'var(--avatar-fg)', ...style } as React.CSSProperties}
      {...rest}
    >
      {src ? <img src={src} alt={alt ?? name} className="h-full w-full object-cover" /> : fallback}
    </span>
  );
}

export function AvatarGroup({ avatars, max = 3, className, ...rest }: AvatarGroupProps) {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - visible.length;

  return (
    <div className={cn('bl-avatar-group flex items-center', className)} {...rest}>
      {visible.map((avatar, index) => (
        <Avatar
          key={`${avatar.name}-${index}`}
          {...avatar}
          className={cn(index > 0 && '-ml-2 ring-2 ring-[var(--color-bg)]', avatar.className)}
        />
      ))}
      {overflow > 0 && (
        <span className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface)] text-[length:var(--text-sm)] font-bold text-[color:var(--color-fg)] ring-2 ring-[var(--color-bg)]">
          +{overflow}
        </span>
      )}
    </div>
  );
}

function initialFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return /^[a-z]/i.test(trimmed) ? trimmed[0].toUpperCase() : trimmed[0];
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
