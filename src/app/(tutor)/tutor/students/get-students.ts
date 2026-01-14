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
    // Transform data to include user info and drill counts from API
    const students = (data.students || []).map((student: any) => {
      const user = student.userId || student;
      return {
        id: user._id || user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Unknown',
        email: user.email,
        progress: student.progress || 0,
        drillsCompleted: student.drillsCompleted || 0,
        drillsActive: student.drillsActive || 0,
        drillsTotal: student.drillsTotal || 0,
        lastActivity: user.lastActivity || null,
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
