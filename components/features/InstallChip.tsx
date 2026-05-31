'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const INSTALLED_KEY = 'babyloom_installed';

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    (window.matchMedia?.('(display-mode: standalone)').matches ?? false) ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function detectInstalled() {
  if (typeof window === 'undefined') return false;
  if (localStorage.getItem(INSTALLED_KEY) === '1') return true;
  return isStandalone();
}

// iOS Safari never fires `beforeinstallprompt`, so we fall back to a how-to.
function detectIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOSDevice = /iphone|ipad|ipod/i.test(ua);
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

export function InstallChip() {
  const [promptEvent, setPromptEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = React.useState(false);
  const [ios, setIos] = React.useState(false);
  const [showIosHelp, setShowIosHelp] = React.useState(false);

  React.useEffect(() => {
    setInstalled(detectInstalled());
    setIos(detectIos());

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    }

    function onAppInstalled() {
      localStorage.setItem(INSTALLED_KEY, '1');
      setInstalled(true);
      setPromptEvent(null);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (installed) return null;
  // Chromium gives us a native prompt; iOS gets the manual how-to.
  if (!promptEvent && !ios) return null;

  async function onClick() {
    if (promptEvent) {
      await promptEvent.prompt();
      // accepted -> appinstalled 事件会接管隐藏;
      // dismissed -> 仅清掉本次 prompt event,浏览器下次再发 beforeinstallprompt 时按钮会回来.
      await promptEvent.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
      setPromptEvent(null);
      return;
    }
    setShowIosHelp(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label="添加到主屏幕"
        title="添加到主屏幕"
        className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-surface-2)] text-[color:var(--color-primary-active)] shadow-[var(--shadow-press-sm)] active:translate-y-[2px] active:shadow-[var(--shadow-press-sm-active)]"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-[18px] w-[18px] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]"
        >
          <rect x="6" y="3" width="12" height="18" rx="2.5" />
          <path d="M12 7v6" />
          <path d="M9 10l3 3 3-3" />
        </svg>
      </button>
      <Modal
        open={showIosHelp}
        onOpenChange={setShowIosHelp}
        title="添加到主屏幕"
        footer={
          <Button type="button" onClick={() => setShowIosHelp(false)}>
            知道了
          </Button>
        }
      >
        <ol className="flex flex-col gap-[var(--space-3)] text-[length:var(--text-base)] leading-[var(--leading-base)] text-[color:var(--color-fg)]">
          <li className="flex items-start gap-[var(--space-2)]">
            <span aria-hidden="true" className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg-inverse)]">
              1
            </span>
            <span>
              在 Safari 中点击底部的「分享」按钮
              <ShareGlyph />
            </span>
          </li>
          <li className="flex items-start gap-[var(--space-2)]">
            <span aria-hidden="true" className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg-inverse)]">
              2
            </span>
            <span>向下滑动，选择「添加到主屏幕」</span>
          </li>
          <li className="flex items-start gap-[var(--space-2)]">
            <span aria-hidden="true" className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg-inverse)]">
              3
            </span>
            <span>点击右上角「添加」即可</span>
          </li>
        </ol>
      </Modal>
    </>
  );
}

function ShareGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="ml-[4px] inline-block h-[16px] w-[16px] -translate-y-[1px] fill-none stroke-current align-middle [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]"
    >
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M6 12v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-7" />
    </svg>
  );
}
