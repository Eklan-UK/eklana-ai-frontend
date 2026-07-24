import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { studentAPI } from "@/lib/api";

export const studentWeeksQueryKey = (studentId: string) =>
  ["student-weeks", studentId] as const;

/** Refetch cached week data (including inactive queries) after drill create/assign. */
export async function invalidateStudentWeeks(
  queryClient: QueryClient,
  studentIds: string | string[],
) {
  const ids = Array.isArray(studentIds) ? studentIds : [studentIds];
  await Promise.all(
    ids
      .filter(Boolean)
      .map((studentId) =>
        queryClient.invalidateQueries({
          queryKey: studentWeeksQueryKey(studentId),
          refetchType: "all",
        }),
      ),
  );
}

export function useStudentWeeks(studentId: string, enabled = true) {
  return useQuery({
    queryKey: studentWeeksQueryKey(studentId),
    queryFn: async () => {
      const response = await studentAPI.getStudentWeeks(studentId);
      return (
        response.data ?? {
          weeks: [],
          anchorDate: new Date().toISOString(),
          currentWeek: 1,
        }
      );
    },
    enabled: enabled && !!studentId,
    staleTime: 1000 * 60 * 2,
    // Global QueryClient sets refetchOnMount: false; week detail must refresh
    // after returning from drill create flows that invalidate this query.
    refetchOnMount: true,
  });
}

export function useCreateStudentWeek(studentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => studentAPI.createStudentWeek(studentId),
    onSuccess: async () => {
      await invalidateStudentWeeks(queryClient, studentId);
      // Learner list "Week N" badge reads drillBuilderWeekCount from these queries.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", "ai-drill-builder", "all-learners"],
        }),
        queryClient.invalidateQueries({ queryKey: ["students"] }),
      ]);
      toast.success("Week added");
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to add week";
      toast.error(message);
    },
  });
}
