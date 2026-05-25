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

export function CameraIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M4 8h3l2-2h6l2 2h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </SvgIcon>
  );
}

export function ChevronLeftIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m15 18-6-6 6-6" />
    </SvgIcon>
  );
}

export function DotsIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </SvgIcon>
  );
}

export function LogoutIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5" />
      <path d="M15 12H5" />
    </SvgIcon>
  );
}

export function PencilIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M4 20h4l11-11-4-4L4 16z" />
      <path d="m13 5 4 4" />
    </SvgIcon>
  );
}

export function ClockIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
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
