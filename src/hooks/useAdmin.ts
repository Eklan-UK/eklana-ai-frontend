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
  assignmentStatus?: 'saved' | 'assigned';
}) {
  return useQuery({
    queryKey: [...queryKeys.drills.all, "admin", "list", filters],
    queryFn: async () => {
      const response = await drillAPI.getAll({
        limit: filters?.limit || 100,
        type: filters?.type,
        difficulty: filters?.difficulty,
        assignmentStatus: filters?.assignmentStatus,
      });
      const drills =
        response.data?.drills ??
        response.drills ??
        [];
      return Array.isArray(drills) ? drills : [];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/** Aggregated analytics dashboard (platform-wide or selected learners). */
export function useAnalyticsDashboard(
  learnerIds?: string[],
  days = 30,
  enabled = true
) {
  const sortedIds = learnerIds?.length ? [...learnerIds].sort().join(',') : '';
  return useQuery({
    queryKey: ['admin', 'analytics', 'dashboard', sortedIds, days],
    queryFn: async () => {
      const response = await adminAPI.getAnalyticsDashboard({
        learnerIds: learnerIds?.length ? learnerIds : undefined,
        days,
      });
      return response.data ?? null;
    },
    enabled,
    staleTime: 1000 * 60 * 2,
  });
}

// Platform-wide drill analytics overview (admin)
export function usePlatformAnalyticsOverview() {
  return useQuery({
    queryKey: ["admin", "analytics", "overview"],
    queryFn: async () => {
      const response = await adminAPI.getPlatformAnalyticsOverview();
      return response.data ?? null;
    },
    staleTime: 1000 * 60 * 5,
  });
}

// Learners with analytics summary for admin analytics page
export function useAnalyticsLearners(filters?: {
  limit?: number;
  offset?: number;
  search?: string;
  signupDateFrom?: string;
  signupDateTo?: string;
  status?: 'active' | 'inactive';
}) {
  return useQuery({
    queryKey: ["admin", "analytics", "learners", filters],
    queryFn: async () => {
      const response = await adminAPI.getAnalyticsLearners(filters || {});
      return {
        learners: response.data?.learners || [],
        total: response.data?.pagination?.total || 0,
        pagination: response.data?.pagination,
      };
    },
    staleTime: 1000 * 60 * 2,
  });
}

// Get all learners (admin)
export function useAllLearners(filters?: {
  limit?: number;
  offset?: number;
  search?: string;
  signupDateFrom?: string;
  signupDateTo?: string;
  status?: 'active' | 'inactive';
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
      return response.data?.drill;
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
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: true,
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

// Get learner by ID
export function useLearnerById(learnerId: string) {
  return useQuery({
    queryKey: ["learners", "detail", learnerId],
    queryFn: async () => {
      const response = await adminService.getLearnerById(learnerId);
      return response.user;
    },
    enabled: !!learnerId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Get drills assigned to a specific learner
export function useLearnerDrills(learnerId: string, learnerEmail?: string) {
  return useQuery({
    queryKey: ["learners", learnerId, "drills"],
    queryFn: async () => {
      if (!learnerEmail) return [];
      const response = await drillAPI.getAll({
        studentEmail: learnerEmail,
        limit: 100,
      });
      return response.drills || [];
    },
    enabled: !!learnerId && !!learnerEmail,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Get drill assignments for a learner (admin/tutor)
export function useLearnerDrillAssignments(learnerId: string) {
  return useQuery({
    queryKey: ["learners", learnerId, "drill-assignments"],
    queryFn: async () => {
      const response = await adminAPI.getLearnerDrillAssignments(learnerId);
      return response.data;
    },
    enabled: !!learnerId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/** Grammar analytics for admin learner profile (optional date range). */
export function useLearnerGrammarAnalytics(
  learnerId: string,
  range?: { from?: string; to?: string }
) {
  return useQuery({
    queryKey: ["learners", learnerId, "grammar-analytics", range?.from, range?.to],
    queryFn: async () => {
      const response = await adminAPI.getLearnerGrammarAnalytics(learnerId, range);
      return response.data ?? null;
    },
    enabled: !!learnerId,
    staleTime: 1000 * 60 * 2,
  });
}

/** Sentence-writing analytics for admin learner profile (optional date range). */
export function useLearnerSentenceAnalytics(
  learnerId: string,
  range?: { from?: string; to?: string }
) {
  return useQuery({
    queryKey: ["learners", learnerId, "sentence-analytics", range?.from, range?.to],
    queryFn: async () => {
      const response = await adminAPI.getLearnerSentenceAnalytics(learnerId, range);
      return response.data ?? null;
    },
    enabled: !!learnerId,
    staleTime: 1000 * 60 * 2,
  });
}

/** Matching drill analytics for admin learner profile (optional date range). */
export function useLearnerMatchingAnalytics(
  learnerId: string,
  range?: { from?: string; to?: string }
) {
  return useQuery({
    queryKey: ["learners", learnerId, "matching-analytics", range?.from, range?.to],
    queryFn: async () => {
      const response = await adminAPI.getLearnerMatchingAnalytics(learnerId, range);
      return response.data ?? null;
    },
    enabled: !!learnerId,
    staleTime: 1000 * 60 * 2,
  });
}

/** Fill-in-the-blank analytics for admin learner profile (optional date range). */
export function useLearnerFillBlankAnalytics(
  learnerId: string,
  range?: { from?: string; to?: string }
) {
  return useQuery({
    queryKey: ["learners", learnerId, "fill-blank-analytics", range?.from, range?.to],
    queryFn: async () => {
      const response = await adminAPI.getLearnerFillBlankAnalytics(learnerId, range);
      return response.data ?? null;
    },
    enabled: !!learnerId,
    staleTime: 1000 * 60 * 2,
  });
}

/** Key phrase analytics for admin learner profile (optional date range). */
export function useLearnerKeyPhrasesAnalytics(
  learnerId: string,
  range?: { from?: string; to?: string }
) {
  return useQuery({
    queryKey: ["learners", learnerId, "key-phrases-analytics", range?.from, range?.to],
    queryFn: async () => {
      const response = await adminAPI.getLearnerKeyPhrasesAnalytics(learnerId, range);
      return response.data ?? null;
    },
    enabled: !!learnerId,
    staleTime: 1000 * 60 * 2,
  });
}

/** Platform-wide fill-in-the-blank analytics (admin). */
export function usePlatformFillBlankAnalytics(
  days = 30,
  learnerIds?: string[],
  enabled = true
) {
  const sortedIds = learnerIds?.length ? [...learnerIds].sort().join(',') : '';
  return useQuery({
    queryKey: ['admin', 'analytics', 'fill-blank', days, sortedIds],
    queryFn: async () => {
      const response = await adminAPI.getPlatformFillBlankAnalytics({
        days,
        learnerIds: learnerIds?.length ? learnerIds : undefined,
      });
      return response.data ?? null;
    },
    enabled,
    staleTime: 1000 * 60 * 2,
  });
}

/** Platform-wide key phrase analytics (admin). */
export function usePlatformKeyPhrasesAnalytics(
  days = 30,
  learnerIds?: string[],
  enabled = true
) {
  const sortedIds = learnerIds?.length ? [...learnerIds].sort().join(',') : '';
  return useQuery({
    queryKey: ['admin', 'analytics', 'key-phrases', days, sortedIds],
    queryFn: async () => {
      const response = await adminAPI.getPlatformKeyPhrasesAnalytics({
        days,
        learnerIds: learnerIds?.length ? learnerIds : undefined,
      });
      return response.data ?? null;
    },
    enabled,
    staleTime: 1000 * 60 * 2,
  });
}

/** Eklan Free Talk attempts (feedback + optional recording) for admin learner profile. */
export function useLearnerFreeTalkAttempts(learnerId: string) {
  return useQuery({
    queryKey: ["learners", learnerId, "free-talk-attempts"],
    queryFn: async () => {
      const response = await adminAPI.getLearnerFreeTalkAttempts(learnerId, { limit: 200 });
      const payload = response.data;
      const attempts = Array.isArray(payload?.attempts) ? payload.attempts : [];
      return {
        attempts,
        nextCursor: payload?.nextCursor ?? null,
      };
    },
    enabled: !!learnerId,
    staleTime: 1000 * 60 * 2,
  });
}

// Update a learner's name (admin)
export function useUpdateLearnerName(learnerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { firstName: string; lastName: string }) => {
      const res = await adminAPI.updateLearnerName(learnerId, data);
      return res.data.learner;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learners", "detail", learnerId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
      toast.success("Learner name updated");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update name");
    },
  });
}

// Update user subscription (admin)
export function useUpdateUserSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      userId: string;
      plan: "free" | "premium";
      months?: number;
      billingPeriod?: "monthly" | "quarterly" | "annual";
      zeroPauseProducts?: ("challenge" | "mastery")[];
      amount?: number;
      paymentMethod?: string;
      note?: string;
    }) => {
      return adminAPI.updateUserSubscription(data);
    },
    onSuccess: (response, variables) => {
      const updated = response?.data;
      if (updated?.userId) {
        queryClient.setQueriesData(
          { queryKey: [...queryKeys.students.all, "admin", "list"] },
          (old: { learners: Array<Record<string, unknown>>; total: number } | undefined) => {
            if (!old?.learners) return old;
            return {
              ...old,
              learners: old.learners.map((learner) =>
                String(learner._id) === String(variables.userId)
                  ? {
                      ...learner,
                      subscriptionPlan: updated.subscriptionPlan,
                      subscriptionBillingPeriod: updated.subscriptionBillingPeriod,
                      zeroPauseProducts: updated.zeroPauseProducts,
                      subscriptionActivatedAt: updated.subscriptionActivatedAt,
                      subscriptionExpiresAt: updated.subscriptionExpiresAt,
                    }
                  : learner
              ),
            };
          }
        );
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard", "stats"] });
      toast.success("Subscription updated");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update subscription");
    },
  });
}

// Get learners assigned to a specific tutor
export function useTutorAssignedStudents(tutorId: string, search?: string) {
  return useQuery({
    queryKey: ["admin", "tutor-assignments", tutorId, search],
    queryFn: () => adminAPI.getTutorAssignedStudents(tutorId, search ? { search } : undefined),
    enabled: !!tutorId,
    staleTime: 30_000,
  });
}

// Assign a learner to a tutor
export function useAssignTutorToStudent(tutorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (studentId: string) =>
      adminAPI.assignTutorToStudent(studentId, tutorId),
    onSuccess: () => {
      toast.success("Student assigned");
      queryClient.invalidateQueries({ queryKey: ["admin", "tutor-assignments", tutorId] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to assign student");
    },
  });
}

// Remove a learner from a tutor
export function useUnassignTutorFromStudent(tutorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (studentId: string) =>
      adminAPI.unassignTutorFromStudent(studentId, tutorId),
    onSuccess: () => {
      toast.success("Student removed");
      queryClient.invalidateQueries({ queryKey: ["admin", "tutor-assignments", tutorId] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to remove student");
    },
  });
}
