// Next.js Middleware for route protection
// Note: This runs on Edge Runtime, so we can't use Mongoose or Better Auth directly
// Authentication is handled by client-side guards (AuthGuard, RoleGuard) and API routes
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

  // Redirect root path to /account
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/account', request.url));
  }

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow API routes (they have their own auth)
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
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
