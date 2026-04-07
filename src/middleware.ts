// Next.js Middleware for route protection
// Note: This runs on Edge Runtime, so we can't use Mongoose or Better Auth directly.
// Do not add Better Auth getSession here — session validation belongs in Node API routes
// and client guards. Misconfigured NEXT_PUBLIC_API_URL / cookies is fixed via env alignment,
// not Edge session fetch.
// Authentication is handled by client-side guards (AuthGuard, RoleGuard) and API routes
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Hostnames where we skip the server-side `/` → `/account` redirect (avoids an extra redirect hop during staging debugging; `/` still client-redirects in app/page.tsx). */
const STAGING_ROOT_REDIRECT_BYPASS_HOSTS = new Set([
  'staging.eklan.ai',
]);

// Public routes that don't require authentication
const publicRoutes = [
  '/welcome',
  '/splash',
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/callback',
  '/terms',
  '/privacy',
  '/contact',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host')?.split(':')[0] ?? '';

  // Redirect root path to /account (non-staging); staging bypass per deployment plan
  if (pathname === '/') {
    if (!STAGING_ROOT_REDIRECT_BYPASS_HOSTS.has(host)) {
      return NextResponse.redirect(new URL('/account', request.url));
    }
    return NextResponse.next();
  }

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow API routes (they have their own auth)
  if (pathname.startsWith('/api')) {
    const response = NextResponse.next();
    
    // Basic Rate Limiting headers (implementation note: real rate limiting should use a store like Redis)
    // Here we just set standard headers that would be used by a proxy or upstream rate limiter
    response.headers.set('X-RateLimit-Limit', '1000'); // Example limit
    response.headers.set('X-RateLimit-Remaining', '999'); // Placeholder
    
    return response;
  }

  // For protected routes, let them through - authentication is handled by:
  // 1. Client-side guards (AuthGuard, RoleGuard, VerificationGuard, OnboardingGuard)
  // 2. Server components using getServerSession()
  // 3. API routes using withAuth() middleware
  
  // We could check for session cookie here for basic protection,
  // but full auth checks happen in guards/components
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
