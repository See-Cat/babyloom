'use client';

import * as React from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function Switch({ checked, className, disabled, onCheckedChange, onClick, onKeyDown, ...rest }: SwitchProps) {
  function toggle() {
    if (!disabled) onCheckedChange(!checked);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={cn('switch', className)}
      data-state={checked ? 'checked' : 'unchecked'}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) toggle();
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === ' ') {
          event.preventDefault();
          toggle();
        }
      }}
      {...rest}
    >
    </button>
  );
}
