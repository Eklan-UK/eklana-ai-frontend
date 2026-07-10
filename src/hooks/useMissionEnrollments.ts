import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { learningJourneyAPI } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';
import {
  LEARNING_JOURNEY_PARTS,
  type LearningJourneyPartId,
} from '@/domain/learning-journey/learning-journey.catalog';
import { toast } from 'sonner';

function unwrapEnrolledParts(
  response: { data?: { enrolledParts?: number[] }; enrolledParts?: number[] },
): LearningJourneyPartId[] {
  const parts =
    response.data?.enrolledParts ?? response.enrolledParts ?? [];
  return parts.filter(
    (p): p is LearningJourneyPartId =>
      p >= 1 && p <= LEARNING_JOURNEY_PARTS.length,
  );
}

function unwrapEnrollmentsList(
  response: {
    data?: {
      enrollments?: Array<{
        learnerId: string;
        learningJourneyPart: number;
      }>;
    };
    enrollments?: Array<{
      learnerId: string;
      learningJourneyPart: number;
    }>;
  },
): Map<string, LearningJourneyPartId[]> {
  const rows = response.data?.enrollments ?? response.enrollments ?? [];
  const map = new Map<string, LearningJourneyPartId[]>();

  for (const row of rows) {
    const part = row.learningJourneyPart as LearningJourneyPartId;
    if (part < 1 || part > LEARNING_JOURNEY_PARTS.length) continue;
    const existing = map.get(row.learnerId) ?? [];
    if (!existing.includes(part)) {
      existing.push(part);
    }
    map.set(row.learnerId, existing.sort((a, b) => a - b));
  }

  return map;
}

export function useMyMissionEnrollments() {
  return useQuery({
    queryKey: queryKeys.learningJourney.myEnrollments(),
    queryFn: async () => {
      const response = await learningJourneyAPI.getMyEnrollments();
      return unwrapEnrolledParts(response);
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useLearnerMissionEnrollments(learnerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.learningJourney.learnerEnrollments(learnerId ?? ''),
    queryFn: async () => {
      const response = await learningJourneyAPI.getLearnerEnrollments(learnerId!);
      return unwrapEnrolledParts(response);
    },
    enabled: !!learnerId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useMissionEnrollmentsList(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.learningJourney.enrollmentsList(),
    queryFn: async () => {
      const response = await learningJourneyAPI.listEnrollments();
      return unwrapEnrollmentsList(response);
    },
    enabled: options?.enabled !== false,
    staleTime: 1000 * 60 * 2,
  });
}

export function useSetLearnerMissionEnrollments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      learnerId,
      parts,
    }: {
      learnerId: string;
      parts: LearningJourneyPartId[];
    }) => {
      const response = await learningJourneyAPI.setLearnerEnrollments(
        learnerId,
        parts,
      );
      return {
        learnerId,
        enrolledParts: unwrapEnrolledParts(response),
      };
    },
    onSuccess: ({ learnerId, enrolledParts }) => {
      queryClient.setQueryData(
        queryKeys.learningJourney.learnerEnrollments(learnerId),
        enrolledParts,
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.learningJourney.enrollmentsList(),
      });
      toast.success('Mission enrollments updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update enrollments');
    },
  });
}

/** Intersection of enrolled parts across multiple selected students. */
export function useEnrolledPartsIntersection(studentIds: string[]) {
  const { data: enrollmentMap, isLoading } = useMissionEnrollmentsList({
    enabled: studentIds.length > 0,
  });

  const enrolledParts = useMemo(() => {
    if (studentIds.length === 0 || !enrollmentMap) return [];

    const sets = studentIds.map(
      (id) => new Set(enrollmentMap.get(id) ?? []),
    );

    const intersection: LearningJourneyPartId[] = [];
    for (const partDef of LEARNING_JOURNEY_PARTS) {
      if (sets.every((set) => set.has(partDef.part))) {
        intersection.push(partDef.part);
      }
    }
    return intersection;
  }, [studentIds, enrollmentMap]);

  return { enrolledParts, isLoading };
}

export const TOTAL_MISSION_COUNT = LEARNING_JOURNEY_PARTS.length;

export function formatEnrollmentBadge(enrolledCount: number): string {
  return `${enrolledCount}/${TOTAL_MISSION_COUNT} missions enrolled`;
}
