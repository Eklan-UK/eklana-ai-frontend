// Server-side function to get current user
import { cookies } from 'next/headers';
import { getServerPublicBaseUrl } from '@/lib/public-base-url.server';

export async function getCurrentUser() {
  try {
    const origin = (await getServerPublicBaseUrl()).replace(/\/$/, '');
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const response = await fetch(`${origin}/api/v1/users/current`, {
      credentials: 'include',
      headers: {
        Cookie: cookieHeader,
      },
      cache: 'no-store', // Always fetch fresh for authenticated routes
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch current user:', error);
    return null;
  }
}

