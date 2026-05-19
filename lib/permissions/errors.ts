// Thrown by assertPermission and target loaders.
// Translated to a unified 404 at every protected entry point (§5.6).
export class ForbiddenError extends Error {
  constructor(public readonly action: string, public readonly reason: string) {
    super(`forbidden: ${action} (${reason})`);
    this.name = 'ForbiddenError';
  }
}

// Thrown when there is no authenticated session at all.
// Translated to 401. Login state is not a secret (§5.6).
export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized');
    this.name = 'UnauthorizedError';
  }
}

// Thrown by target loaders when the target row does not exist,
// is in a disallowed status, or fails any DB-level constraint.
// Also translated to a unified 404.
export class NotFoundError extends Error {
  constructor(public readonly resource: string) {
    super(`not_found: ${resource}`);
    this.name = 'NotFoundError';
  }
}
