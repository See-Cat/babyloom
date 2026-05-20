'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';

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
    <div className="mb-[var(--space-4)] flex justify-center">
      <Button type="button" size="sm" variant="secondary" onClick={install}>
        添加到主屏幕 →
      </Button>
    </div>
  );
}
