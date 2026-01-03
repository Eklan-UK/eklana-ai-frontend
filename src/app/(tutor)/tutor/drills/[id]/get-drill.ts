// Server-side function to get drill by ID
import { cookies } from 'next/headers';

export async function getDrillById(drillId: string) {
  try {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const response = await fetch(`${baseURL}/api/v1/drills/${drillId}`, {
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

