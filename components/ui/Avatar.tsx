import * as React from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string;
  alt?: string;
  name: string;
  size?: AvatarSize;
}

export interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  avatars: AvatarProps[];
  max?: number;
}

const sizeClass: Record<AvatarSize, string> = {
  sm: 'h-7 w-7 text-[var(--text-xs)]',
  md: 'h-10 w-10 text-[var(--text-sm)]',
  lg: 'h-14 w-14 text-[var(--text-lg)]'
};

export function Avatar({ src, alt, name, size = 'md', className, style, ...rest }: AvatarProps) {
  const fallback = initialFor(name);

  return (
    <span
      aria-label={alt ?? name}
      className={cn(
        'bl-avatar inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-avatar-mint)] font-bold text-[color:var(--color-fg-inverse)]',
        sizeClass[size],
        className
      )}
      style={{ color: 'var(--color-fg-inverse)', ...style }}
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
        <span className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--text-sm)] font-bold text-[var(--color-fg)] ring-2 ring-[var(--color-bg)]">
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
