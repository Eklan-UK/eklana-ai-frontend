/**
 * React Query hooks for admin operations
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAPI, drillAPI } from "@/lib/api";
import { queryKeys } from "@/lib/react-query";
import { toast } from "sonner";
import { adminService } from "@/services/admin.service";

// Get all drills (admin)
export function useAllDrills(filters?: {
  limit?: number;
  type?: string;
  difficulty?: string;
}) {
  return useQuery({
    queryKey: [...queryKeys.drills.all, "admin", "list", filters],
    queryFn: async () => {
      const response = await drillAPI.getAll({
        limit: filters?.limit || 100,
        type: filters?.type,
        difficulty: filters?.difficulty,
      });
      return response.drills || [];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Get all learners (admin)
export function useAllLearners(filters?: {
  limit?: number;
  offset?: number;
  role?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: [...queryKeys.students.all, "admin", "list", filters],
    queryFn: async () => {
      const response = await adminAPI.getAllLearners(filters || {});
      return {
        learners: response.data?.learners || [],
        total: (response.data?.pagination as any)?.total || (response.data as any)?.total || 0,
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Get drill by ID (admin)
export function useDrillById(drillId: string) {
  return useQuery({
    queryKey: queryKeys.drills.detail(drillId),
    queryFn: async () => {
      const response = await drillAPI.getById(drillId);
      return response.drill;
    },
    enabled: !!drillId,
    staleTime: 1000 * 60 * 2,
  });
}

// Assign drill mutation
export function useAssignDrill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      drillId,
      data,
    }: {
      drillId: string;
      data: { userIds: string[]; dueDate?: string };
    }) => {
      return await drillAPI.assign(drillId, data);
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.drills.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
      toast.success("Drill assigned successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to assign drill");
    },
  });
}

// Get dashboard stats
export function useDashboardStats() {
  return useQuery({
    queryKey: ["admin", "dashboard", "stats"],
    queryFn: async () => {
      return await adminService.getDashboardStats();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get recent learners (for dashboard)
export function useRecentLearners(limit: number = 10) {
  return useQuery({
    queryKey: ["admin", "dashboard", "learners", limit],
    queryFn: async () => {
      const response = await adminService.getLearners({ limit });
      return response.users || [];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Get drill assignments for a specific drill
export function useDrillAssignments(drillId: string) {
  return useQuery({
    queryKey: ["admin", "drills", drillId, "assignments"],
    queryFn: async () => {
      const response = await fetch(`/api/v1/drills/${drillId}/assignments`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch drill assignments');
      }
      const data = await response.json();
      return data;
    },
    enabled: !!drillId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
