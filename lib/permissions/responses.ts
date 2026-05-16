import { NextResponse } from 'next/server';

// UUID v4 (loosely accepts any 8-4-4-4-12 hex with any variant)
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Unified 404 body — §5.6 forbids leaking presence/absence/permission distinction.
export function jsonNotFound() {
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}

// 401 is only for "no session at all" — login state is not a secret.
export function jsonUnauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

// 400 — only for shape errors that are not 404-worthy
// (e.g. unknown query parameter values like ?size=poster on a photo).
// Path-id shape errors collapse to 404, not 400.
export function jsonBadRequest(detail: string) {
  return NextResponse.json({ error: 'bad_request', detail }, { status: 400 });
}
