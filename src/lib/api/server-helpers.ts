// Server-side helpers for fetching data with authentication
import { cookies, headers } from 'next/headers';
import { getServerSession } from './session';

/**
 * Fetch with authentication for server components
 * Automatically includes cookies for Better Auth session
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const fullUrl = url.startsWith('http') ? url : `${baseURL}${url}`;

  return fetch(fullUrl, {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
      Cookie: cookieHeader,
    },
    cache: options.cache || 'no-store', // Default to no-store for authenticated requests
  });
}

/**
 * Get current user in server components
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  const { user } = await getServerSession();
  return user;
}

/**
 * Require authentication in server components
 * Throws error if not authenticated (can be caught and handled)
 */
export async function requireAuth() {
  const { user } = await getServerSession();
  
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  
  return user;
}

/**
 * Require specific role in server components
 */
export async function requireRole(allowedRoles: ('admin' | 'learner' | 'tutor')[]) {
  const user = await requireAuth();
  
  if (!allowedRoles.includes(user.role || 'learner')) {
    throw new Error('FORBIDDEN');
  }
  
  return user;
}


