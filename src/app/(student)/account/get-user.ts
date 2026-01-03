// Server-side function to get current user
import { cookies } from 'next/headers';

export async function getCurrentUser() {
  try {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const response = await fetch(`${baseURL}/api/v1/users/current`, {
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

