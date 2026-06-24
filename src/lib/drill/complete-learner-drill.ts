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

  // Badge evaluation runs in background on the server; check for unlocks without blocking UI
  void fetch('/api/v1/badges/evaluate', { method: 'POST' })
    .then((res) => (res.ok ? res.json() : null))
    .then((json) => celebrateBadgesFromApiResponse(json))
    .catch(() => {});

  void Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.drills.learner.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.badges.all }),
    queryClient.invalidateQueries({ queryKey: ['user-streak'] }),
    queryClient.invalidateQueries({ queryKey: ['progress-scorecard'] }),
  ]);
  return result;
}
