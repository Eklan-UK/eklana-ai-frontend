import { useQuery } from '@tanstack/react-query';
import { weeklyChallengeAPI } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';
import type { WeeklyChallengeListResponse } from '@/domain/challenges/weekly-challenge.service';

function unwrapWeeklyChallenge(response: {
	code?: string;
	data?: WeeklyChallengeListResponse;
}): WeeklyChallengeListResponse | null {
	return response?.data ?? null;
}

export function useWeeklyChallenge(options?: { enabled?: boolean }) {
	return useQuery({
		queryKey: queryKeys.weeklyChallenge.current(),
		queryFn: async () => {
			const response = await weeklyChallengeAPI.getCurrent();
			return unwrapWeeklyChallenge(response);
		},
		enabled: options?.enabled ?? true,
		staleTime: 1000 * 60 * 2,
		refetchInterval: (query) => {
			const data = query.state.data;
			if (data?.status === 'generating') {
				return 3000;
			}
			return false;
		},
	});
}

export function useWeeklyChallengeItem(index: number, options?: { enabled?: boolean }) {
	return useQuery({
		queryKey: queryKeys.weeklyChallenge.item(index),
		queryFn: async () => {
			const response = await weeklyChallengeAPI.getItem(index);
			return response?.data ?? null;
		},
		enabled: (options?.enabled ?? true) && index >= 0,
	});
}
