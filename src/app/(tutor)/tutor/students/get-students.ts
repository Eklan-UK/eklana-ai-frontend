// Server-side function to get tutor's students
import { cookies } from 'next/headers';

export async function getTutorStudents() {
  try {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const response = await fetch(`${baseURL}/api/v1/tutor/students`, {
      credentials: 'include',
      headers: {
        Cookie: cookieHeader,
      },
      cache: 'no-store', // Always fetch fresh for authenticated routes
    });

    if (!response.ok) {
      return { students: [], total: 0, limit: 20, offset: 0 };
    }

    const data = await response.json();
    // Transform data to include progress and drill counts
    const students = (data.students || []).map((student: any) => {
      const user = student.userId || student;
      return {
        id: user._id || user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Unknown',
        email: user.email,
        progress: 0, // TODO: Calculate from drill attempts
        drillsCompleted: 0, // TODO: Get from drill assignments
        drillsActive: 0, // TODO: Get from drill assignments
        lastActivity: null, // TODO: Get from learning sessions
        ...user,
      };
    });

    return {
      students,
      total: data.total || students.length,
      limit: data.limit || 20,
      offset: data.offset || 0,
    };
  } catch (error) {
    console.error('Failed to fetch tutor students:', error);
    return { students: [], total: 0, limit: 20, offset: 0 };
  }
}

