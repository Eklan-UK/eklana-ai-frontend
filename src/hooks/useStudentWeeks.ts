import { useQuery } from "@tanstack/react-query";
import { studentAPI } from "@/lib/api";

export const studentWeeksQueryKey = (studentId: string) =>
  ["student-weeks", studentId] as const;

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
  });
}
