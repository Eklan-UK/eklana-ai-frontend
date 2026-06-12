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

const generatingPollInterval = (data: WeeklyChallengeListResponse | null | undefined) =>
	data?.status === 'generating' ? 3000 : false;

export function useWeeklyChallengeHistory(options?: { enabled?: boolean }) {
	return useQuery({
		queryKey: queryKeys.weeklyChallenge.history(),
		queryFn: async () => {
			const response = await weeklyChallengeAPI.getHistory();
			return response?.data?.challenges ?? [];
		},
		enabled: options?.enabled ?? true,
		staleTime: 1000 * 60 * 2,
		refetchInterval: (query) => {
			const challenges = query.state.data ?? [];
			const isGenerating = challenges.some((c) => c.status === 'generating');
			return isGenerating ? 3000 : false;
		},
	});
}

export function useWeeklyChallenge(
	weekStartDate?: string,
	options?: { enabled?: boolean },
) {
	return useQuery({
		queryKey: weekStartDate
			? queryKeys.weeklyChallenge.week(weekStartDate)
			: queryKeys.weeklyChallenge.current(),
		queryFn: async () => {
			const response = await weeklyChallengeAPI.getCurrent(weekStartDate);
			return unwrapWeeklyChallenge(response);
		},
		enabled: options?.enabled ?? true,
		staleTime: 1000 * 60 * 2,
		refetchInterval: (query) => generatingPollInterval(query.state.data),
	});
}

export function useWeeklyChallengeItem(
	index: number,
	weekStartDate?: string,
	options?: { enabled?: boolean; itemId?: string },
) {
	const resolvedWeek = weekStartDate ?? '';
	const queryKey = queryKeys.weeklyChallenge.item(resolvedWeek, index);

	return useQuery({
		queryKey,
		queryFn: async () => {
			const itemId = options?.itemId ?? index;
			const response = await weeklyChallengeAPI.getItem(itemId, weekStartDate);
			return response?.data ?? null;
		},
		enabled: (options?.enabled ?? true) && index >= 0,
	});
}
