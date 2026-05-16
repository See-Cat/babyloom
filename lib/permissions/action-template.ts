import { type NextRequest } from 'next/server';
import type { Action, PermissionResource } from './actions';
import { ForbiddenError, NotFoundError, UnauthorizedError } from './errors';
import { jsonNotFound, jsonUnauthorized } from './responses';
import { getSessionUserId } from './session';
import { assertPermission } from './assert';

export interface WithAuthorizedActionOpts {
  action: Action;
  resolveResource?: (
    req: NextRequest,
    userId: string
  ) => Promise<PermissionResource | undefined>;
}

// Wraps list/create API routes that do not have an [id] path resource.
export function withAuthorizedAction(opts: WithAuthorizedActionOpts) {
  return function wrap(
    handler: (req: NextRequest, userId: string) => Promise<Response>
  ) {
    return async function route(req: NextRequest): Promise<Response> {
      try {
        let userId: string;
        try {
          userId = await getSessionUserId(req);
        } catch (e) {
          if (e instanceof UnauthorizedError) return jsonUnauthorized();
          throw e;
        }

        const resource = opts.resolveResource ? await opts.resolveResource(req, userId) : undefined;
        await assertPermission(userId, opts.action, resource);

        return await handler(req, userId);
      } catch (e) {
        if (e instanceof ForbiddenError || e instanceof NotFoundError) return jsonNotFound();
        throw e;
      }
    };
  };
}
