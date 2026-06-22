import type { QueryClient } from '@tanstack/react-query';
import { drillAPI } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';
import { celebrateBadgesFromApiResponse } from '@/lib/badges/celebrate-badge-unlock';

type CompleteDrillPayload = Parameters<typeof drillAPI.complete>[1];

/** Submit drill completion and refresh learner plan / assigned-drill lists. */
export async function completeLearnerDrill(
  queryClient: QueryClient,
  drillId: string,
  data: CompleteDrillPayload,
) {
  const result = await drillAPI.complete(drillId, data);
  celebrateBadgesFromApiResponse(result);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.drills.learner.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.badges.all }),
    queryClient.invalidateQueries({ queryKey: ["user-streak"] }),
  ]);
  return result;
}
