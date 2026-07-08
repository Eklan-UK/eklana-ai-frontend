/**
 * React Query hooks for drills
 * Replaces useEffect + useState patterns with React Query
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { drillAPI, tutorAPI } from "@/lib/api";
import { completeLearnerDrill } from "@/lib/drill/complete-learner-drill";
import { queryKeys } from "@/lib/react-query";
import { toast } from "sonner";

function normalizeLearnerDrillItem(item: any): any {
  if (item.itemType === "free_talk_scenario") {
    return item;
  }
  if (item.drill && typeof item.drill === "object") {
    const drill = item.drill;
    if (drill._id != null && drill.type) {
      return {
        ...item,
        drill: {
          ...drill,
          _id: String(drill._id),
        },
      };
    }
  }
  if (item._id && item.type) {
    return {
      assignmentId: item.assignmentId || item._id,
      drill: {
        ...item,
        _id: String(item._id),
      },
      assignedBy: item.assignedBy,
      assignedAt: item.assignedAt || item.created_date,
      dueDate:
        item.dueDate ||
        new Date(
          new Date(item.date).getTime() +
            (item.duration_days || 1) * 24 * 60 * 60 * 1000
        ).toISOString(),
      status: item.status || "pending",
      completedAt: item.completedAt,
      latestAttempt: item.latestAttempt,
      hasBookmarks: item.hasBookmarks === true,
    };
  }
  return item;
}

function isLearnerDrillRow(item: any): boolean {
  if (item.itemType === "free_talk_scenario") return true;
  const drill = item.drill;
  if (drill && typeof drill === "object" && drill._id != null && !!drill.type) {
    return true;
  }
  if (process.env.NODE_ENV !== "production") {
    console.warn("[useDrills] Dropping malformed drill row:", item);
  }
  return false;
}

async function fetchLearnerDrills(filters?: { limit?: number; status?: 'pending' | 'in_progress' | 'completed' }) {
  const response: any = await drillAPI.getLearnerDrills(filters || { limit: 100 });

  let drillsData: any[] = [];
  if (response.data?.drills) {
    drillsData = response.data.drills;
  } else if (response.drills) {
    drillsData = response.drills;
  } else if (Array.isArray(response)) {
    drillsData = response;
  }

  return drillsData
    .map(normalizeLearnerDrillItem)
    .filter(isLearnerDrillRow);
}

async function fetchSavedDrills() {
  const response: any = await drillAPI.getSavedDrills();

  let drillsData: any[] = [];
  if (response.data?.drills) {
    drillsData = response.data.drills;
  } else if (response.drills) {
    drillsData = response.drills;
  } else if (Array.isArray(response)) {
    drillsData = response;
  }

  return drillsData
    .map(normalizeLearnerDrillItem)
    .filter(isLearnerDrillRow);
}

// Get learner drills
export function useLearnerDrills(filters?: { limit?: number; status?: 'pending' | 'in_progress' | 'completed' }) {
  return useQuery({
    queryKey: queryKeys.drills.learner.list(filters),
    queryFn: () => fetchLearnerDrills(filters),
    staleTime: 1000 * 60 * 2, // 2 minutes for learner drills
    refetchOnMount: true, // Override global false: refetch when stale/invalidated on mount (e.g. after drill completion)
  });
}

// Get bookmark-first saved drills (no assignment pagination cap)
export function useSavedDrills() {
  return useQuery({
    queryKey: queryKeys.drills.learner.saved(),
    queryFn: () => fetchSavedDrills(),
    staleTime: 1000 * 60 * 2,
    refetchOnMount: true,
  });
}

// Get tutor drills
export function useTutorDrills(filters?: {
  isActive?: boolean;
  assignmentStatus?: 'saved' | 'assigned';
}) {
  return useQuery({
    queryKey: queryKeys.drills.tutor.list(filters),
    queryFn: async () => {
      const response = await tutorAPI.getMyDrills(filters || {});
      return response.drills || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes for tutor drills
  });
}

// Get drill by ID
export function useDrill(drillId: string) {
  return useQuery({
    queryKey: queryKeys.drills.detail(drillId),
    queryFn: async () => {
      const response: any = await drillAPI.getById(drillId);
      // Handle both old and new response structures
      if (response?.data?.drill) {
        return response.data.drill;
      }
      if (response?.drill) {
        return response.drill;
      }
      // If response is the drill directly
      if (response?._id) {
        return response;
      }
      // Log for debugging
      console.error('Invalid drill response format:', response);
      throw new Error('Invalid response format: drill not found in response');
    },
    enabled: !!drillId,
  });
}

function invalidateDrillListQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.drills.tutor.all() });
  queryClient.invalidateQueries({ queryKey: queryKeys.drills.all });
}

// Delete drill mutation
export function useDeleteDrill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (drillId: string) => {
      return await drillAPI.delete(drillId);
    },
    onSuccess: () => {
      invalidateDrillListQueries(queryClient);
      toast.success("Drill deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete drill");
    },
  });
}

// Bulk delete drills mutation
export function useDeleteDrills() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (drillIds: string[]) => {
      const failures: string[] = [];
      for (const drillId of drillIds) {
        try {
          await drillAPI.delete(drillId);
        } catch {
          failures.push(drillId);
        }
      }
      return { deletedCount: drillIds.length - failures.length, failures };
    },
    onSuccess: ({ deletedCount, failures }) => {
      invalidateDrillListQueries(queryClient);
      if (deletedCount > 0) {
        toast.success(
          `Deleted ${deletedCount} drill${deletedCount !== 1 ? "s" : ""}`
        );
      }
      if (failures.length > 0) {
        toast.error(
          `Failed to delete ${failures.length} drill${failures.length !== 1 ? "s" : ""}`
        );
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete drills");
    },
  });
}

// Complete drill mutation
export function useCompleteDrill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      drillId,
      data,
    }: {
      drillId: string;
      data: any;
    }) => {
      return await completeLearnerDrill(queryClient, drillId, data);
    },
    onSuccess: () => {
      toast.success("Drill completed successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to complete drill");
    },
  });
}

// Prefetch drill data (for use on hover/focus for faster navigation)
export function usePrefetchDrill() {
  const queryClient = useQueryClient();

  return (drillId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.drills.detail(drillId),
      queryFn: async () => {
        const response: any = await drillAPI.getById(drillId);
        // Handle both old and new response structures
        if (response?.data?.drill) {
          return response.data.drill;
        }
        if (response?.drill) {
          return response.drill;
        }
        // If response is the drill directly
        if (response?._id) {
          return response;
        }
        // Log for debugging
        console.error('Invalid drill response format:', response);
        throw new Error('Invalid response format: drill not found in response');
      },
      staleTime: 1000 * 60 * 5, // 5 minutes
    });
  };
}

// Prefetch learner drills (for use when navigating to drills page)
export function usePrefetchLearnerDrills() {
  const queryClient = useQueryClient();

  return (filters?: { limit?: number }) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.drills.learner.list(filters),
      queryFn: () => fetchLearnerDrills(filters),
      staleTime: 1000 * 60 * 2, // 2 minutes
    });
  };
}
