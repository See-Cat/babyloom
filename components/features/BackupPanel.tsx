'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { ToastContext } from '@/components/ui/ToastProvider';

export function BackupPanel() {
  const [busy, setBusy] = React.useState(false);
  const toast = React.useContext(ToastContext);

  async function downloadBackup() {
    setBusy(true);
    try {
      const res = await fetch('/api/backup', { method: 'POST' });
      if (res.status === 503) {
        toast?.show({ message: '另一个备份正在进行,稍后再试' });
        return;
      }
      if (!res.ok) {
        toast?.show({ message: '导出失败,请稍后重试', variant: 'error' });
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filenameFromDisposition(res.headers.get('content-disposition'));
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button fullWidth loading={busy} onClick={downloadBackup}>
      {busy ? '正在打包...' : '导出全部'}
    </Button>
  );
}

function filenameFromDisposition(value: string | null) {
  const match = value?.match(/filename="([^"]+)"/);
  return match?.[1] ?? 'babyloom-backup.zip';
}
