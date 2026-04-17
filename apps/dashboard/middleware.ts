import { type NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME ?? 'emoto_access_token';

// Pages that authenticated users should never see.
const GUEST_ONLY_PATHS = ['/login', '/create-account', '/forgot-password'];

// Pages that require authentication (protected routes).
const PROTECTED_PATHS = [
  '/live',
  '/bikes',
  '/devices',
  '/riders',
  '/incidents',
  '/events',
  '/zones',
  '/reports',
  '/audit',
  '/settings',
  '/checkout',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(AUTH_COOKIE)?.value);

  // Redirect authenticated users away from guest-only pages.
  if (hasSession && GUEST_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.redirect(new URL('/live', request.url));
  }

  // Redirect unauthenticated users away from protected pages.
  if (!hasSession && PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/create-account/:path*',
    '/forgot-password/:path*',
    '/live/:path*',
    '/bikes/:path*',
    '/devices/:path*',
    '/riders/:path*',
    '/incidents/:path*',
    '/events/:path*',
    '/zones/:path*',
    '/reports/:path*',
    '/audit/:path*',
    '/settings/:path*',
    '/checkout/:path*',
  ],
};
