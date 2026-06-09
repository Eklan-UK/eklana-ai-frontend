import type { QueryClient } from '@tanstack/react-query';
import { weeklyChallengeAPI } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';

export async function completeWeeklyChallengeItem(
	queryClient: QueryClient,
	itemIndex: number,
	data?: { score?: number; weekStartDate?: string },
) {
	const response = await weeklyChallengeAPI.completeItem(
		itemIndex,
		data?.score != null ? { score: data.score } : undefined,
		data?.weekStartDate,
	);

	await queryClient.invalidateQueries({
		queryKey: queryKeys.weeklyChallenge.history(),
	});

	if (data?.weekStartDate) {
		await queryClient.invalidateQueries({
			queryKey: queryKeys.weeklyChallenge.week(data.weekStartDate),
		});
		await queryClient.invalidateQueries({
			queryKey: queryKeys.weeklyChallenge.item(data.weekStartDate, itemIndex),
		});
	} else {
		await queryClient.invalidateQueries({
			queryKey: queryKeys.weeklyChallenge.current(),
		});
		await queryClient.invalidateQueries({
			queryKey: queryKeys.weeklyChallenge.item('', itemIndex),
		});
	}

	return response;
}
