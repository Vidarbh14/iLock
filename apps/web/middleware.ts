import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Allow all static files, api agent routes, and PWA assets
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/api/agent') ||
    pathname.startsWith('/api/devices/register') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js'
  ) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
