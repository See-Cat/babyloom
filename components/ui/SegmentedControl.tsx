'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

export interface SegmentedOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  value: string;
  options: SegmentedOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}

export function SegmentedControl({ ariaLabel, className, onChange, options, value }: SegmentedControlProps) {
  return (
    <div className={cn('segmented', className)} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            'seg',
            value === option.value && 'active'
          )}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
