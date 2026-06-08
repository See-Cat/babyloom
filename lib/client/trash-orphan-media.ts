import { reportClientError } from '@/lib/client/error-reporter';

/**
 * Soft-delete an orphan media (uploaded to the server but never attached to an
 * entry) by moving it to the trash. Used when the user removes a freshly
 * uploaded photo or abandons a draft entry, so the file does not linger in the
 * gallery (which only shows status='ready' media).
 *
 * Best-effort: failures are logged but never thrown — abandoning/removing must
 * not be blocked by a cleanup hiccup. A stranded media can still be cleared from
 * the trash bin later.
 */
export async function trashOrphanMedia(mediaId: string): Promise<void> {
  try {
    const res = await fetch(`/api/media/${mediaId}/trash`, { method: 'POST' });
    if (!res.ok) throw new Error(`trash_failed_${res.status}`);
  } catch (error) {
    reportClientError({
      message: `orphan media trash failed: ${error instanceof Error ? error.message : String(error)}`,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
    });
  }
}
