// Server-side function to get tutor dashboard data
import { cookies } from 'next/headers';

export async function getTutorDashboardData() {
  try {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const [drillsResponse, studentsResponse] = await Promise.all([
      fetch(`${baseURL}/api/v1/tutor/drills?limit=5`, {
        credentials: 'include',
        headers: {
          Cookie: cookieHeader,
        },
        cache: 'no-store',
      }),
      fetch(`${baseURL}/api/v1/tutor/students?limit=5`, {
        credentials: 'include',
        headers: {
          Cookie: cookieHeader,
        },
        cache: 'no-store',
      }),
    ]);

    const drillsData = drillsResponse.ok ? await drillsResponse.json() : { drills: [], total: 0 };
    const studentsData = studentsResponse.ok ? await studentsResponse.json() : { students: [], total: 0 };

    const activeDrills = drillsData.drills?.filter((d: any) => d.is_active !== false) || [];
    const recentDrills = (drillsData.drills || []).slice(0, 3).map((drill: any) => ({
      id: drill._id || drill.id,
      title: drill.title,
      type: drill.type,
      students: Array.isArray(drill.assigned_to) ? drill.assigned_to.length : drill.assigned_to ? 1 : 0,
      dueDate: drill.date ? new Date(drill.date).toLocaleDateString() : 'N/A',
      status: drill.is_active !== false ? 'active' : 'completed',
    }));

    const recentStudents = (studentsData.students || []).slice(0, 3).map((student: any) => {
      const user = student.userId || student;
      return {
        id: user._id || user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Unknown',
        progress: 0, // TODO: Calculate from drill attempts
        drillsCompleted: 0, // TODO: Get from drill assignments
      };
    });

    return {
      stats: {
        totalDrills: drillsData.total || 0,
        activeDrills: activeDrills.length,
        totalStudents: studentsData.total || 0,
        completedToday: 0, // TODO: Get from drill attempts
      },
      recentDrills,
      recentStudents,
    };
  } catch (error) {
    console.error('Failed to fetch tutor dashboard data:', error);
    return {
      stats: {
        totalDrills: 0,
        activeDrills: 0,
        totalStudents: 0,
        completedToday: 0,
      },
      recentDrills: [],
      recentStudents: [],
    };
  }
}

