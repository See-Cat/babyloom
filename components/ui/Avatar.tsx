import * as React from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/shared/cn';
import { AVATAR_COLORS, type AvatarColor } from '@/lib/shared/avatar-colors';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string;
  alt?: string;
  name: string;
  size?: AvatarSize;
  colorKey?: string;
  color?: AvatarColor;
}

export interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  avatars: AvatarProps[];
  max?: number;
  size?: AvatarSize;
}

const sizeClass: Record<AvatarSize, string> = {
  xs: 'ava-xs',
  sm: 'ava-sm',
  md: 'ava-md',
  lg: 'ava-lg',
  xl: 'ava-xl'
};

export function Avatar({ src, alt, name, size = 'md', colorKey, color, className, style, ...rest }: AvatarProps) {
  const fallback = initialFor(name);
  const avatarColor = color ?? AVATAR_COLORS[hashString(colorKey ?? name) % AVATAR_COLORS.length];

  return (
    <span
      aria-label={alt ?? name}
      className={cn(
        'ava',
        sizeClass[size],
        `ava-${avatarColor}`,
        className
      )}
      data-size={size}
      data-color={avatarColor}
      style={style}
      {...rest}
    >
      {src ? <img src={src} alt={alt ?? name} className="h-full w-full object-cover" /> : fallback}
    </span>
  );
}

export function AvatarGroup({ avatars, max = 3, size = 'sm', className, ...rest }: AvatarGroupProps) {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - visible.length;

  return (
    <div className={cn('ava-group', className)} {...rest}>
      {visible.map((avatar, index) => (
        <Avatar key={`${avatar.name}-${index}`} size={size} {...avatar} />
      ))}
      {overflow > 0 && (
        <span
          className={cn('ava', sizeClass[size], 'ava-overflow')}
          aria-label={`还有 ${overflow} 人`}
        >
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
