import type { QueryClient } from '@tanstack/react-query';
import { weeklyChallengeAPI } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';

export async function completeWeeklyChallengeItem(
	queryClient: QueryClient,
	itemId: string | number,
	data?: { score?: number; weekStartDate?: string },
) {
	const numericIndex = typeof itemId === 'string' 
		? parseInt(itemId.split('-').pop() ?? '0', 10) 
		: itemId;

	const response = await weeklyChallengeAPI.completeItem(
		numericIndex,
		data?.score != null ? { score: data.score } : undefined,
		data?.weekStartDate,
	);

	// Refetch the entire weeklyChallenge namespace so history, current,
	// week, and item queries all update immediately regardless of 
	// which key variant each consumer registered with.
	await queryClient.refetchQueries({
		queryKey: queryKeys.weeklyChallenge.all,
	});
	await queryClient.invalidateQueries({ queryKey: ['progress-scorecard'] });
	await queryClient.invalidateQueries({ queryKey: ['pronunciations', 'learner'] });

	return response;
}
