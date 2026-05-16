// Complete §5.4 Action set. Adding a protected resource? Add the action here FIRST,
// then the route, then the test. Anything else is a missed coverage gate.
export const ACTIONS = [
  'baby:read',
  'baby:write',
  'baby:trash',
  'baby:purge',
  'baby:restore',
  'entry:read',
  'entry:write',
  'entry:trash',
  'entry:purge',
  'entry:restore',
  'media:read',
  'media:write',
  'media:trash',
  'media:purge',
  'media:restore',
  'trash:view',
  'member:manage',
  'family:manage',
  'milestone:manage',
  'system:logs',
  'system:backup'
] as const;

export type Action = (typeof ACTIONS)[number];

export function isAction(s: string): s is Action {
  return (ACTIONS as readonly string[]).includes(s);
}

// §5.5.1 ownership vs target field carrier.
// Every field here comes from a DB loader — never from the client request body.
export interface PermissionResource {
  babyId?: string;
  entryId?: string;
  mediaId?: string;
  authorId?: string; // entry.author
  uploadedBy?: string; // media.uploadedBy
  deletedBy?: string; // for *:restore matrix
  targetUserId?: string; // member:manage subject
}
