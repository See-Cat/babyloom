import { type NextRequest } from 'next/server';
import type { Action, PermissionResource } from './actions';
import { ForbiddenError, NotFoundError, UnauthorizedError } from './errors';
import { jsonNotFound, jsonUnauthorized, UUID_RE } from './responses';
import { getSessionUserId } from './session';
import { assertPermission } from './assert';

// `allowedStatuses` is REQUIRED — not optional. A route that genuinely has no
// status column on its target table should pass a tuple containing the only
// valid value (e.g. `['ok']`) explicitly, after pointing `getStatus` to a
// constant. This forces every route author to make a status decision rather
// than accidentally exposing trashed rows.
export interface WithAuthorizedResourceOpts<R> {
  action: Action;
  loader: (id: string) => Promise<R | null>;
  getStatus: (row: R) => string;
  allowedStatuses: readonly string[];
  toResource: (row: R) => PermissionResource;
}

// Wraps a Next.js App Router handler. Every protected /api route MUST use this
// (enforced by ESLint rule babyloom/api-route-must-assert).
//
// Pipeline (spec §5.7):
//   1. UUID shape       → 404 if malformed
//   2. Session          → 401 if missing (the only non-404 negative)
//   3. Load by id       → 404 if no row
//   4. Status gate      → 404 if row.status not in allowedStatuses    (§5.6)
//   5. assertPermission → ForbiddenError → 404 (§5.6)
//   6. Hand off trusted row to handler
export function withAuthorizedResource<R>(opts: WithAuthorizedResourceOpts<R>) {
  return function wrap(
    handler: (req: NextRequest, ctx: { params: { id: string } }, row: R) => Promise<Response>
  ) {
    return async function route(
      req: NextRequest,
      ctx: { params: Promise<{ id: string }> }
    ): Promise<Response> {
      try {
        const params = await Promise.resolve(ctx.params);
        if (!UUID_RE.test(params.id)) return jsonNotFound();

        let userId: string;
        try {
          userId = await getSessionUserId(req);
        } catch (e) {
          if (e instanceof UnauthorizedError) return jsonUnauthorized();
          throw e;
        }

        const row = await opts.loader(params.id);
        if (!row) return jsonNotFound();

        // STATUS GATE (Codex round-12 finding #1): collapses status mismatch
        // to unified 404 before authorization runs. Without this, a route
        // handler that forgets `if (row.status !== 'active') return 404` will
        // happily serve trashed rows after authorization passes — a
        // resource-existence leak the spec §5.6 forbids.
        const status = opts.getStatus(row);
        if (!opts.allowedStatuses.includes(status)) return jsonNotFound();

        await assertPermission(userId, opts.action, opts.toResource(row));

        return await handler(req, { params: params }, row);
      } catch (e) {
        if (e instanceof ForbiddenError || e instanceof NotFoundError) return jsonNotFound();
        throw e;
      }
    };
  };
}
