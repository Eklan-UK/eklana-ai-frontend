import { useQuery } from '@tanstack/react-query';
import { weeklyChallengeAPI } from '@/lib/api';

export function useWeeklyChallengeHistory() {
	const query = useQuery({
		queryKey: ['weekly-challenge-history'],
		queryFn: async () => {
			const response = await weeklyChallengeAPI.getHistory();
			return response?.data?.challenges ?? [];
		},
		staleTime: 1000 * 60 * 5,
	});

	return {
		challenges: query.data ?? [],
		isLoading: query.isLoading,
		isError: query.isError,
		refetch: query.refetch,
	};
}
