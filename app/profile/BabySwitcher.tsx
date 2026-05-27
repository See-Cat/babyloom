'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/mobile/BottomSheet';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { CheckIcon, PlusIcon } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/lib/hooks/useToast';
import { cn } from '@/lib/shared/cn';

export interface BabySwitcherBaby {
  id: string;
  name: string;
  image?: string | null;
  ageLabel: string;
}

const DELETE_REVEAL_PX = 80;
const SWIPE_TRIGGER_PX = 12;

export function BabySwitcher({
  activeBabyId,
  babies: initialBabies,
  trigger
}: {
  activeBabyId: string;
  babies: BabySwitcherBaby[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [babies, setBabies] = React.useState(initialBabies);
  const [swipedId, setSwipedId] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<BabySwitcherBaby | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    setBabies(initialBabies);
  }, [initialBabies]);

  React.useEffect(() => {
    if (!swipedId) return;
    function onDocTouchStart(e: TouchEvent) {
      const target = e.target as Element | null;
      const row = target?.closest?.('[data-swipe-row]') as HTMLElement | null;
      if (row?.dataset.swipeRowId === swipedId) return;
      setSwipedId(null);
    }
    document.addEventListener('touchstart', onDocTouchStart);
    return () => document.removeEventListener('touchstart', onDocTouchStart);
  }, [swipedId]);

  function selectBaby(babyId: string) {
    setOpen(false);
    if (babyId !== activeBabyId) {
      try {
        document.cookie = `bl_baby=${babyId}; path=/; max-age=${60 * 60 * 24 * 365}`;
      } catch {}
    }
    router.push(`/timeline?babyId=${babyId}`);
    router.refresh();
  }

  function requestDelete(baby: BabySwitcherBaby) {
    if (babies.length <= 1) {
      toast.show({ message: '至少需要保留一个宝宝', variant: 'error' });
      setSwipedId(null);
      return;
    }
    setPendingDelete(baby);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeleting(true);
    try {
      const res = await fetch(`/api/babies/${target.id}/trash`, { method: 'POST' });
      if (!res.ok) {
        toast.show({ message: '删除失败', variant: 'error' });
        return;
      }
      const remaining = babies.filter((b) => b.id !== target.id);
      setBabies(remaining);
      setSwipedId(null);
      setPendingDelete(null);

      if (target.id === activeBabyId && remaining.length > 0) {
        const next = remaining[0];
        try {
          document.cookie = `bl_baby=${next.id}; path=/; max-age=${60 * 60 * 24 * 365}`;
        } catch {}
        setOpen(false);
        router.push(`/timeline?babyId=${next.id}`);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch {
      toast.show({ message: '删除失败', variant: 'error' });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="contents"
      >
        {trigger}
      </button>
      <BottomSheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSwipedId(null);
        }}
        title="切换宝宝"
      >
        <div className="flex flex-col">
          {babies.map((baby) => (
            <BabyRow
              key={baby.id}
              baby={baby}
              active={baby.id === activeBabyId}
              swiped={swipedId === baby.id}
              onSwipeOpen={() => setSwipedId(baby.id)}
              onSwipeClose={() => setSwipedId((id) => (id === baby.id ? null : id))}
              onSelect={() => selectBaby(baby.id)}
              onRequestDelete={() => requestDelete(baby)}
            />
          ))}
          <a
            href="/onboarding/baby?back=1"
            className="mt-[6px] flex items-center gap-[10px] border-t border-[color:var(--color-border-light)] px-[6px] pt-[14px] text-[length:var(--text-base)] font-bold text-[color:var(--color-primary-active)]"
          >
            <PlusIcon className="h-4 w-4" /> 添加新宝宝
          </a>
        </div>
      </BottomSheet>
      <Modal
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => {
          if (!next && !deleting) setPendingDelete(null);
        }}
        dismissible={!deleting}
        title={`删除「${pendingDelete?.name ?? ''}」?`}
        footer={
          <>
            <Button type="button" variant="default" disabled={deleting} onClick={() => setPendingDelete(null)}>
              取消
            </Button>
            <Button type="button" variant="error" disabled={deleting} onClick={confirmDelete}>
              {deleting ? '删除中…' : '删除'}
            </Button>
          </>
        }
      >
        <p className="text-[length:var(--text-base)] leading-[var(--leading-base)] text-[color:var(--color-fg)]">
          删除后该宝宝的记录、相册将一并隐藏。可在回收站中恢复。
        </p>
      </Modal>
    </>
  );
}

interface BabyRowProps {
  baby: BabySwitcherBaby;
  active: boolean;
  swiped: boolean;
  onSwipeOpen: () => void;
  onSwipeClose: () => void;
  onSelect: () => void;
  onRequestDelete: () => void;
}

const VELOCITY_PROJECTION_MS = 50;

function BabyRow({ baby, active, swiped, onSwipeOpen, onSwipeClose, onSelect, onRequestDelete }: BabyRowProps) {
  const startRef = React.useRef<{ x: number; y: number; baseOffset: number; locked: 'h' | 'v' | null } | null>(null);
  const motionRef = React.useRef({ lastX: 0, lastT: 0, vx: 0 });
  const [offset, setOffset] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const moved = React.useRef(false);

  React.useEffect(() => {
    if (!swiped && !dragging) setOffset(0);
    if (swiped && !dragging) setOffset(-DELETE_REVEAL_PX);
  }, [swiped, dragging]);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    const baseOffset = swiped ? -DELETE_REVEAL_PX : 0;
    startRef.current = { x: t.clientX, y: t.clientY, baseOffset, locked: null };
    motionRef.current = { lastX: t.clientX, lastT: performance.now(), vx: 0 };
    moved.current = false;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!startRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;

    if (startRef.current.locked == null) {
      if (Math.abs(dx) < SWIPE_TRIGGER_PX && Math.abs(dy) < SWIPE_TRIGGER_PX) return;
      startRef.current.locked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }

    if (startRef.current.locked !== 'h') return;

    const now = performance.now();
    const dt = now - motionRef.current.lastT;
    if (dt > 0) {
      const instantVx = (t.clientX - motionRef.current.lastX) / dt;
      motionRef.current.vx = motionRef.current.vx * 0.5 + instantVx * 0.5;
    }
    motionRef.current.lastX = t.clientX;
    motionRef.current.lastT = now;

    moved.current = true;
    setDragging(true);
    const next = Math.min(0, Math.max(-DELETE_REVEAL_PX, startRef.current.baseOffset + dx));
    setOffset(next);
  }

  function onTouchEnd() {
    if (startRef.current?.locked === 'h') {
      const projected = offset + motionRef.current.vx * VELOCITY_PROJECTION_MS;
      const shouldOpen =
        projected < -DELETE_REVEAL_PX / 2 ||
        (projected < 0 && Math.abs(projected - -DELETE_REVEAL_PX) < Math.abs(projected - 0));
      if (shouldOpen) {
        onSwipeOpen();
        setOffset(-DELETE_REVEAL_PX);
      } else {
        onSwipeClose();
        setOffset(0);
      }
    }
    setDragging(false);
    startRef.current = null;
  }

  function onTrackClickCapture(e: React.MouseEvent) {
    if (moved.current) {
      e.preventDefault();
      e.stopPropagation();
      moved.current = false;
      return;
    }
    if (swiped) {
      const target = e.target as Element;
      if (!target.closest?.('[data-row-delete]')) {
        e.preventDefault();
        e.stopPropagation();
        onSwipeClose();
      }
    }
  }

  return (
    <div
      data-swipe-row
      data-swipe-row-id={baby.id}
      className="relative overflow-hidden rounded-[14px]"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onClickCapture={onTrackClickCapture}
      style={{ touchAction: 'pan-y' }}
    >
      <div
        className="flex"
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: dragging ? 'none' : 'transform 220ms var(--ease)'
        }}
      >
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            'flex w-full shrink-0 items-center gap-[var(--space-3)] px-[6px] py-[10px] text-left',
            active ? 'bg-[var(--color-surface)]' : 'bg-[var(--color-surface-2)]'
          )}
        >
          <Avatar src={baby.image ?? undefined} name={baby.name} colorKey={baby.id} size="sm" />
          <span className="flex-1 text-[length:var(--text-md)] font-bold text-[color:var(--color-fg-strong)]">
            {baby.name}
          </span>
          <span className="text-[length:var(--text-xs)] font-semibold text-[color:var(--color-fg-soft)]">
            {baby.ageLabel}
          </span>
          {active && <CheckIcon className="h-4 w-4 text-[color:var(--color-primary-active)]" />}
        </button>
        <button
          type="button"
          data-row-delete
          onClick={onRequestDelete}
          aria-label={`删除 ${baby.name}`}
          className="flex shrink-0 items-center justify-center bg-[color:var(--color-error-active)] text-[length:var(--text-md)] font-bold text-white"
          style={{ width: DELETE_REVEAL_PX }}
          tabIndex={swiped ? 0 : -1}
        >
          删除
        </button>
      </div>
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onClick() {
    setPending(true);
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' });
    } catch {}
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="mt-[var(--space-6)] mb-[var(--space-4)] flex justify-center">
      <button
        type="button"
        disabled={pending}
        onClick={onClick}
        className="rounded-[var(--radius-pill)] bg-[var(--color-error-bg)] px-[var(--space-6)] py-[var(--space-3)] text-[length:var(--text-md)] font-bold text-[color:var(--color-error-active)] transition-transform active:translate-y-[1px] disabled:opacity-60"
      >
        {pending ? '退出中…' : '退出登录'}
      </button>
    </div>
  );
}
