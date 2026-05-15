// Server-side function to get drills assigned to current user via DrillAssignment
import { Types } from 'mongoose';
import { getServerSession } from '@/lib/api/session';
import {
  getLearnerMyDrillsPayload,
  type LearnerMyDrillRow,
} from '@/lib/server/learner-my-drills.server';

function normalizeLearnerRole(role: string | undefined): 'user' | null {
  if (!role) return null;
  if (role === 'learner' || role === 'user') return 'user';
  return null;
}

function isPopulatedDrill(
  drill: unknown
): drill is Record<string, unknown> & { _id?: unknown; title?: string } {
  if (!drill || typeof drill !== 'object') return false;
  const d = drill as Record<string, unknown>;
  return d._id !== undefined || typeof d.title === 'string';
}

export async function getAssignedDrills() {
  try {
    const { user } = await getServerSession();
    if (!user?.id || normalizeLearnerRole(user.role) !== 'user') {
      return { drills: [], total: 0 };
    }

    let userId: Types.ObjectId;
    try {
      userId = new Types.ObjectId(user.id);
    } catch {
      return { drills: [], total: 0 };
    }

    const { drills, pagination } = await getLearnerMyDrillsPayload(userId, {
      limit: 50,
      offset: 0,
    });

    const mappedDrills = drills.flatMap((item: LearnerMyDrillRow) => {
      const drill = item.drill;

      if (!isPopulatedDrill(drill)) {
        console.warn('Skipping item with no drill:', item);
        return [];
      }

      return [
        {
          ...drill,
          assignmentId: item.assignmentId,
          assignedBy: item.assignedBy,
          assignedAt: item.assignedAt,
          dueDate: item.dueDate,
          assignmentStatus: item.status,
          completedAt: item.completedAt,
          latestAttempt: item.latestAttempt,
        },
      ];
    });

    console.log(`Mapped ${mappedDrills.length} drills from ${drills.length} items`);

    return {
      drills: mappedDrills,
      total: pagination.total,
    };
  } catch (error) {
    console.error('Failed to fetch assigned drills:', error);
    return { drills: [], total: 0 };
  }
}
