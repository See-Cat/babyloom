import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/shared/cn';

interface FabBaseProps {
  icon: React.ReactNode;
  label: string;
  className?: string;
}

interface FabLinkProps extends FabBaseProps {
  href: string;
  onClick?: never;
}

interface FabButtonProps extends FabBaseProps {
  href?: never;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
}

export type FabProps = FabLinkProps | FabButtonProps;

const positionClass =
  'bl-rise-fab fixed bottom-[calc(80px+env(safe-area-inset-bottom))] right-[var(--space-5)] z-[calc(var(--z-tabbar)-1)]';

export function Fab(props: FabProps) {
  const { icon, label, className } = props;
  const classes = cn('fab', positionClass, className);

  if ('href' in props && props.href !== undefined) {
    return (
      <Link href={props.href} className={classes} aria-label={label}>
        {icon}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} aria-label={label} onClick={props.onClick}>
      {icon}
    </button>
  );
}
