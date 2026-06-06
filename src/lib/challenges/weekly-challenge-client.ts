import type { QueryClient } from '@tanstack/react-query';
import { weeklyChallengeAPI } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';

export async function completeWeeklyChallengeItem(
	queryClient: QueryClient,
	itemIndex: number,
	data?: { score?: number },
) {
	const response = await weeklyChallengeAPI.completeItem(itemIndex, data);
	await queryClient.invalidateQueries({
		queryKey: queryKeys.weeklyChallenge.current(),
	});
	await queryClient.invalidateQueries({
		queryKey: queryKeys.weeklyChallenge.item(itemIndex),
	});
	return response;
}
