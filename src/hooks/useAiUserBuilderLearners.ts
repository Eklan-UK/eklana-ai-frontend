import { useQuery } from "@tanstack/react-query";
import { adminAPI } from "@/lib/api";
import type { LearnerRecord } from "@/lib/ai-user-builder/learner-utils";

const PAGE_SIZE = 200;

/**
 * Fetches every learner for AI User Builder by paginating through the admin API.
 * The Learners table uses offset pagination; a single limit=1000 request can miss
 * learners or serve stale React Query cache from a different filter key.
 */
export function useAiUserBuilderLearners(enabled = true) {
  return useQuery({
    queryKey: ["admin", "ai-user-builder", "all-learners"],
    queryFn: async () => {
      const learners: LearnerRecord[] = [];
      let offset = 0;

      while (true) {
        const response = await adminAPI.getAllLearners({
          limit: PAGE_SIZE,
          offset,
        });
        const batch = (response.data?.learners ?? []) as LearnerRecord[];
        learners.push(...batch);

        const hasMore = response.data?.pagination?.hasMore;
        if (!hasMore || batch.length === 0) break;
        offset += PAGE_SIZE;
      }

      return { learners, total: learners.length };
    },
    enabled,
    staleTime: 1000 * 60 * 2,
    refetchOnMount: true,
  });
}
