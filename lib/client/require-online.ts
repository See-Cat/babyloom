import type { ToastContextValue } from '@/components/ui/ToastProvider';

export function requireOnline(toast: Pick<ToastContextValue, 'show'> | null | undefined) {
  if (typeof navigator === 'undefined' || navigator.onLine !== false) return true;
  toast?.show({
    message: '当前离线,无法保存。请检查网络后重试。',
    variant: 'error'
  });
  return false;
}
