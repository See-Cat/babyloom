import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
  '/api/health',
  '/api/log/client',
  '/_next',
  '/favicon.ico',
  '/manifest.webmanifest',
  '/icons',
  '/fonts',
  '/sw.js'
];
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  process.env.NODE_ENV === 'production'
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'"
].join('; ');

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return withSecurityHeaders(NextResponse.next());
  }

  if (process.env.NODE_ENV !== 'production' && pathname.startsWith('/components')) {
    return withSecurityHeaders(NextResponse.next());
  }

  if (pathname.startsWith('/api/')) {
    return withSecurityHeaders(NextResponse.next());
  }

  // Reads 'better-auth.session_token', incl. the '__Secure-' prefix added over HTTPS.
  const hasSession = getSessionCookie(req) !== null;
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  return withSecurityHeaders(NextResponse.next());
}

function withSecurityHeaders(response: NextResponse) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Content-Security-Policy', CSP);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
