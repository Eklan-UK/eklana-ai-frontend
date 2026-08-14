/**
 * React Query hooks for Precision Clinic (admin shell).
 * Drill CRUD goes through the general drills API with source=precision_clinic.
 */
import {
	useQuery,
	useMutation,
	useQueryClient,
	type QueryClient,
} from '@tanstack/react-query';
import { precisionClinicAPI } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';
import { toast } from 'sonner';
import type { PrecisionClinicStats } from '@/domain/precision-clinic/types';

export type { PrecisionClinicStats } from '@/domain/precision-clinic/types';

function extractStudentWeeksPayload(response: any): {
	anchorDate: string;
	currentWeek: number;
	weeks: Array<{
		weekNumber: number;
		weekStartDate: string;
		weekEndDate: string;
		drills: any[];
	}>;
} {
	const data = response?.data ?? response ?? {};
	const weeks = data.weeks ?? [];
	return {
		anchorDate: data.anchorDate ?? new Date().toISOString(),
		currentWeek: typeof data.currentWeek === 'number' ? data.currentWeek : 1,
		weeks: Array.isArray(weeks) ? weeks : [],
	};
}

/** Refetch cached Precision Clinic week data after drill create/delete/bookmark. */
export async function invalidatePrecisionClinicStudentWeeks(
	queryClient: QueryClient,
	studentIds: string | string[],
) {
	const ids = Array.isArray(studentIds) ? studentIds : [studentIds];
	await Promise.all(
		ids
			.filter(Boolean)
			.map((studentId) =>
				queryClient.invalidateQueries({
					queryKey: queryKeys.precisionClinic.studentWeeks(studentId),
					refetchType: 'all',
				}),
			),
	);
}

export function usePrecisionClinicStats(options?: { enabled?: boolean }) {
	return useQuery({
		queryKey: queryKeys.precisionClinic.stats(),
		queryFn: async (): Promise<PrecisionClinicStats> => {
			const response = await precisionClinicAPI.getStats();
			const stats = response?.data;
			return {
				total: stats?.total ?? 0,
				practiceItems: stats?.practiceItems ?? 0,
				published: stats?.published ?? 0,
				assigned: stats?.assigned ?? 0,
			};
		},
		staleTime: 1000 * 60 * 2,
		enabled: options?.enabled !== false,
	});
}

/** Per-student virtual week breakdown, mirrors useStudentWeeks (AI Drill Builder). */
export function usePrecisionClinicStudentWeeks(
	studentId: string | undefined | null,
	options?: { enabled?: boolean }
) {
	return useQuery({
		queryKey: queryKeys.precisionClinic.studentWeeks(studentId ?? ''),
		queryFn: async () => {
			const response = await precisionClinicAPI.getStudentWeeks(String(studentId));
			return extractStudentWeeksPayload(response);
		},
		enabled: Boolean(studentId) && options?.enabled !== false,
		staleTime: 1000 * 60 * 2,
		// Global QueryClient sets refetchOnMount: false; week detail must refresh
		// after returning from drill create flows that invalidate this query.
		refetchOnMount: true,
	});
}

/** Adds the next virtual week for a student, mirrors useCreateStudentWeek (AI Drill Builder). */
export function useCreatePrecisionClinicStudentWeek(studentId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => precisionClinicAPI.createStudentWeek(studentId),
		onSuccess: async () => {
			await invalidatePrecisionClinicStudentWeeks(queryClient, studentId);
			// Learner list "Week N" badge reads precisionClinicWeekCount from these queries.
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: ["admin", "ai-drill-builder", "all-learners"],
				}),
				queryClient.invalidateQueries({ queryKey: ["students"] }),
			]);
			toast.success('Week added');
		},
		onError: (error: any) => {
			toast.error(error?.message || 'Failed to add week');
		},
	});
}
