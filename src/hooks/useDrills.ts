/**
 * React Query hooks for drills
 * Replaces useEffect + useState patterns with React Query
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { drillAPI, tutorAPI } from "@/lib/api";
import { queryKeys } from "@/lib/react-query";
import { toast } from "sonner";

// Get learner drills
export function useLearnerDrills(filters?: { limit?: number; status?: 'pending' | 'in_progress' | 'completed' }) {
  return useQuery({
    queryKey: queryKeys.drills.learner.list(filters),
    queryFn: async () => {
      const response: any = await drillAPI.getLearnerDrills(filters || { limit: 100 });
      
      // Handle different response structures
      let drillsData: any[] = [];
      if (response.data?.drills) {
        drillsData = response.data.drills;
      } else if (response.drills) {
        drillsData = response.drills;
      } else if (Array.isArray(response)) {
        drillsData = response;
      }

      // Normalize drill data structure
      return drillsData.map((item: any) => {
        if (item.drill && typeof item.drill === "object") {
          return item;
        }
        if (item._id && item.title) {
          return {
            assignmentId: item.assignmentId || item._id,
            drill: item,
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
          };
        }
        return item;
      });
    },
    staleTime: 1000 * 60 * 2, // 2 minutes for learner drills
  });
}

// Get tutor drills
export function useTutorDrills(filters?: { isActive?: boolean }) {
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

// Delete drill mutation
export function useDeleteDrill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (drillId: string) => {
      return await drillAPI.delete(drillId);
    },
    onSuccess: () => {
      // Invalidate and refetch drills
      queryClient.invalidateQueries({ queryKey: queryKeys.drills.tutor.all() });
      toast.success("Drill deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete drill");
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
      return await drillAPI.complete(drillId, data);
    },
    onSuccess: () => {
      // Invalidate learner drills to show updated status
      queryClient.invalidateQueries({ queryKey: queryKeys.drills.learner.all() });
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
      queryFn: async () => {
        const response: any = await drillAPI.getLearnerDrills(filters || { limit: 100 });
        let drillsData: any[] = [];
        if (response.data?.drills) {
          drillsData = response.data.drills;
        } else if (response.drills) {
          drillsData = response.drills;
        } else if (Array.isArray(response)) {
          drillsData = response;
        }
        return drillsData.map((item: any) => {
          if (item.drill && typeof item.drill === "object") {
            return item;
          }
          if (item._id && item.title) {
            return {
              assignmentId: item.assignmentId || item._id,
              drill: item,
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
            };
          }
          return item;
        });
      },
      staleTime: 1000 * 60 * 2, // 2 minutes
    });
  };
}
