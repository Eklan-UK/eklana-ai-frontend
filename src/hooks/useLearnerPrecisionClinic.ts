import { useQuery } from '@tanstack/react-query';
import { learnerPrecisionClinicAPI } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';
import type {
	PrecisionClinicLearnerWeekDetailResponse,
	PrecisionClinicLearnerWeekListItem,
} from '@/domain/precision-clinic/types';

export function useLearnerPrecisionClinicHistory(options?: { enabled?: boolean }) {
	return useQuery({
		queryKey: queryKeys.learnerPrecisionClinic.history(),
		queryFn: async (): Promise<PrecisionClinicLearnerWeekListItem[]> => {
			const response = await learnerPrecisionClinicAPI.getHistory();
			return response?.data?.weeks ?? [];
		},
		enabled: options?.enabled ?? true,
		staleTime: 1000 * 60 * 2,
	});
}

export function useLearnerPrecisionClinicWeek(
	learnerWeekId: string,
	options?: { enabled?: boolean },
) {
	return useQuery({
		queryKey: queryKeys.learnerPrecisionClinic.week(learnerWeekId),
		queryFn: async (): Promise<PrecisionClinicLearnerWeekDetailResponse | null> => {
			const response = await learnerPrecisionClinicAPI.getWeek(learnerWeekId);
			return response?.data ?? null;
		},
		enabled: (options?.enabled ?? true) && Boolean(learnerWeekId),
		staleTime: 1000 * 60 * 2,
	});
}
