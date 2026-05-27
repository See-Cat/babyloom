import { headers } from 'next/headers';
import type { Action, PermissionResource } from './actions';
import { ForbiddenError, NotFoundError, UnauthorizedError } from './errors';
import { assertPermission } from './assert';
import { getSessionUserIdFromHeaders } from './session';

export interface WithPermissionOpts<Args extends any[]> {
  action: Action;
  resolveResource: (...args: Args) => Promise<PermissionResource | undefined>;
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: 'unauthorized' | 'not_found' };

// Wraps a server action with auth + permission. The wrapped handler receives
// the trusted userId as its first argument; it must NEVER read userId/role
// from form data.
export function withPermission<Args extends any[], T>(
  opts: WithPermissionOpts<Args>,
  handler: (userId: string, ...args: Args) => Promise<T>
): (...args: Args) => Promise<ActionResult<T>> {
  return async (...args: Args) => {
    try {
      const userId = await getSessionUserIdFromHeaders(headers());
      const resource = await opts.resolveResource(...args);
      await assertPermission(userId, opts.action, resource);
      const data = await handler(userId, ...args);
      return { ok: true, data };
    } catch (e) {
      if (e instanceof UnauthorizedError) return { ok: false, error: 'unauthorized' };
      if (e instanceof ForbiddenError || e instanceof NotFoundError)
        return { ok: false, error: 'not_found' };
      throw e;
    }
  };
}
