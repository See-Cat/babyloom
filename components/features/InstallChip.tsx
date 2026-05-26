'use client';

import * as React from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISSED_KEY = 'babyloom_install_dismissed';

export function InstallChip() {
  const [promptEvent, setPromptEvent] = React.useState<BeforeInstallPromptEvent | null>(null);

  React.useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY) === '1') return;

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  if (!promptEvent) return null;

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
    localStorage.setItem(DISMISSED_KEY, '1');
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
