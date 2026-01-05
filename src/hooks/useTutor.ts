/**
 * React Query hooks for tutor operations
 */
import { useQuery } from "@tanstack/react-query";
import { tutorAPI } from "@/lib/api";
import { queryKeys } from "@/lib/react-query";

// Get tutor's students
export function useTutorStudents(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: [...queryKeys.students.all, "tutor", "list", params],
    queryFn: async () => {
      const response = await tutorAPI.getStudents(params);
      return {
        students: response.students || [],
        total: response.total || 0,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

