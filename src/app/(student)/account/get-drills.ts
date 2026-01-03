// Server-side function to get drills assigned to current user via DrillAssignment
import { cookies } from 'next/headers';

export async function getAssignedDrills() {
  try {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    // Use the learner drills endpoint which returns drills from DrillAssignment records
    const response = await fetch(`${baseURL}/api/v1/drills/learner/my-drills?limit=50`, {
      credentials: 'include',
      headers: {
        Cookie: cookieHeader,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return { drills: [], total: 0 };
    }

    const data = await response.json();
    
    // Extract drills from the response structure
    // The API returns: { code, message, data: { drills: [...], pagination: {...} } }
    const drills = data.data?.drills || data.drills || [];
    
    // Debug logging (remove in production)
    if (drills.length === 0) {
      console.log('No drills found in response:', { 
        hasData: !!data.data, 
        hasDrills: !!data.drills,
        responseKeys: Object.keys(data),
        dataStructure: data 
      });
    }
    
    // Map to the format expected by the page
    // Each drill item has: { assignmentId, drill, assignedBy, assignedAt, dueDate, status, completedAt, latestAttempt }
    const mappedDrills = drills.map((item: any) => {
      // Ensure we have the drill object - the API returns { assignmentId, drill, ... }
      const drill = item.drill || item;
      
      // If drill is null or undefined, skip this item
      if (!drill) {
        console.warn('Skipping item with no drill:', item);
        return null;
      }
      
      // Handle case where drill might be an ObjectId string instead of populated object
      if (typeof drill === 'string' || (drill && !drill._id && !drill.title)) {
        console.warn('Drill is not properly populated:', drill);
        return null;
      }
      
      return {
        ...drill,
        assignmentId: item.assignmentId || item._id,
        assignedBy: item.assignedBy,
        assignedAt: item.assignedAt,
        dueDate: item.dueDate,
        assignmentStatus: item.status,
        completedAt: item.completedAt,
        latestAttempt: item.latestAttempt,
      };
    }).filter((drill: any) => drill !== null); // Remove any null entries

    console.log(`Mapped ${mappedDrills.length} drills from ${drills.length} items`);

    return {
      drills: mappedDrills,
      total: data.data?.pagination?.total || data.total || mappedDrills.length,
    };
  } catch (error) {
    console.error('Failed to fetch assigned drills:', error);
    return { drills: [], total: 0 };
  }
}

