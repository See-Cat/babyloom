'use client';

import * as React from 'react';
import type { ReactNode } from 'react';
import { BottomSheet } from '@/components/mobile/BottomSheet';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { Modal } from './Modal';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
}

export function Dialog(props: DialogProps) {
  const isDesktop = useMediaQuery('(min-width: 640px)') ?? true;

  if (isDesktop) return <Modal {...props} />;

  return <BottomSheet {...props} />;
}
