import { type NextRequest, NextResponse } from 'next/server';

// Routes that don't require a session cookie
const PUBLIC_PATHS = ['/login', '/setup'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and Next.js internals through
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const session = req.cookies.get('fluxo_session');
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
