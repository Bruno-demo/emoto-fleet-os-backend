import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'emoto_access_token';

// Redirects authenticated sessions from the public landing page to the command center.
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/') {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (token) {
      const url = request.nextUrl.clone();
      url.pathname = '/live';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/'],
};
