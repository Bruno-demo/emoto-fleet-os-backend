import { type NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME ?? 'emoto_access_token';

// Pages that authenticated users should never see.
const GUEST_ONLY_PATHS = ['/login', '/create-account', '/forgot-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(AUTH_COOKIE)?.value);

  // Redirect authenticated users away from guest-only pages.
  if (hasSession && GUEST_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.redirect(new URL('/live', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/create-account/:path*', '/forgot-password/:path*'],
};
