import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { learnerPrecisionClinicAPI, precisionClinicAPI } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';
import { toast } from 'sonner';

function unwrapEnrolled(
  response: { data?: { enrolled?: boolean }; enrolled?: boolean },
): boolean {
  return response.data?.enrolled ?? response.enrolled ?? false;
}

function unwrapEnrollmentsList(
  response: {
    data?: { enrollments?: Array<{ learnerId: string; status?: string }> };
    enrollments?: Array<{ learnerId: string; status?: string }>;
  },
): Set<string> {
  const rows = response.data?.enrollments ?? response.enrollments ?? [];
  return new Set(
    rows.filter((row) => row.status !== 'withdrawn').map((row) => row.learnerId),
  );
}

export function useMyClinicEnrollment(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.precisionClinic.myEnrollment(),
    queryFn: async () => {
      const response = await learnerPrecisionClinicAPI.getMyEnrollment();
      return unwrapEnrolled(response);
    },
    enabled: options?.enabled !== false,
    staleTime: 1000 * 60 * 2,
  });
}

export function useLearnerClinicEnrollment(learnerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.precisionClinic.learnerEnrollment(learnerId ?? ''),
    queryFn: async () => {
      const response = await precisionClinicAPI.getLearnerEnrollment(learnerId!);
      return unwrapEnrolled(response);
    },
    enabled: !!learnerId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useClinicEnrollmentsList(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.precisionClinic.enrollmentsList(),
    queryFn: async () => {
      const response = await precisionClinicAPI.listEnrollments();
      return unwrapEnrollmentsList(response);
    },
    enabled: options?.enabled !== false,
    staleTime: 1000 * 60 * 2,
  });
}

export function useSetLearnerClinicEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      learnerId,
      enrolled,
    }: {
      learnerId: string;
      enrolled: boolean;
    }) => {
      const response = await precisionClinicAPI.setLearnerEnrollment(
        learnerId,
        enrolled,
      );
      return {
        learnerId,
        enrolled: unwrapEnrolled(response),
      };
    },
    onSuccess: ({ learnerId, enrolled }) => {
      queryClient.setQueryData(
        queryKeys.precisionClinic.learnerEnrollment(learnerId),
        enrolled,
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.precisionClinic.enrollmentsList(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.precisionClinic.myEnrollment(),
      });
      toast.success(
        enrolled
          ? 'Learner enrolled in Precision Clinic'
          : 'Learner withdrawn from Precision Clinic',
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update clinic enrollment');
    },
  });
}
