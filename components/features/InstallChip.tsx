'use client';

import * as React from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const INSTALLED_KEY = 'babyloom_installed';

function detectInstalled() {
  if (typeof window === 'undefined') return false;
  if (localStorage.getItem(INSTALLED_KEY) === '1') return true;
  return window.matchMedia?.('(display-mode: standalone)').matches ?? false;
}

export function InstallChip() {
  const [promptEvent, setPromptEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = React.useState(false);

  React.useEffect(() => {
    setInstalled(detectInstalled());

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

  if (installed || !promptEvent) return null;

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    // accepted -> appinstalled 事件会接管隐藏;
    // dismissed -> 仅清掉本次 prompt event,浏览器下次再发 beforeinstallprompt 时按钮会回来.
    await promptEvent.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
    setPromptEvent(null);
  }

  return (
    <button
      type="button"
      onClick={install}
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
  );
}
