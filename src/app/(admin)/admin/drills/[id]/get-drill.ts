// Server-side function to get drill by ID
import { cookies } from 'next/headers';
import { getServerPublicBaseUrl } from '@/lib/public-base-url.server';

export async function getDrillById(drillId: string) {
  try {
    const origin = (await getServerPublicBaseUrl()).replace(/\/$/, '');
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const response = await fetch(`${origin}/api/v1/drills/${drillId}`, {
      credentials: 'include',
      headers: {
        Cookie: cookieHeader,
      },
      cache: 'no-store', // Always fetch fresh for authenticated routes
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.drill || data;
  } catch (error) {
    console.error('Failed to fetch drill:', error);
    return null;
  }
}

