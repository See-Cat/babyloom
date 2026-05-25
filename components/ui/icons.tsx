import * as React from 'react';

interface IconProps {
  className?: string;
}

function SvgIcon({ children, className }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      {children}
    </svg>
  );
}

export function PlusIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M12 5v14M5 12h14" />
    </SvgIcon>
  );
}

export function ChevronRightIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m9 18 6-6-6-6" />
    </SvgIcon>
  );
}

export function ChevronDownIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m6 9 6 6 6-6" />
    </SvgIcon>
  );
}

export function InfoIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </SvgIcon>
  );
}

export function CheckIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m5 12 4 4 10-10" />
    </SvgIcon>
  );
}

export function WarningIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M12 3 2.5 20h19L12 3z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </SvgIcon>
  );
}

export function ErrorIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </SvgIcon>
  );
}

export function XIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </SvgIcon>
  );
}

export function ImageIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <SvgIcon className={className}>
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <path d="m4 15 4-4 4 4 2-2 6 6" />
      <circle cx="15.5" cy="9.5" r="1.5" />
    </SvgIcon>
  );
}

export function ArrowDownIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M12 5v14" />
      <path d="m6 13 6 6 6-6" />
    </SvgIcon>
  );
}
