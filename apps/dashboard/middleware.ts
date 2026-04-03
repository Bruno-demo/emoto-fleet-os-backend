import { NextResponse } from 'next/server';

// No-op middleware placeholder to avoid redirecting authenticated users away from landing.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ['/'],
};
