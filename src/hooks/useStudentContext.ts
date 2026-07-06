import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  studentAPI,
  type StudentContextData,
  type UpsertStudentContextInput,
} from "@/lib/api";

export const studentContextQueryKey = (studentId: string) =>
  ["student-context", studentId] as const;

function isNotFoundError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("not found") || msg.includes("404");
  }
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 404;
}

export function useStudentContext(studentId: string, enabled = true) {
  return useQuery({
    queryKey: studentContextQueryKey(studentId),
    queryFn: async () => {
      try {
        const response = await studentAPI.getStudentContext(studentId);
        return response.data ?? null;
      } catch (error: unknown) {
        if (isNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    },
    enabled: enabled && !!studentId,
    staleTime: 1000 * 60 * 5,
    retry: (failureCount, error) => {
      if (isNotFoundError(error)) return false;
      return failureCount < 1;
    },
  });
}

export function useUpsertStudentContext(studentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpsertStudentContextInput) =>
      studentAPI.upsertStudentContext(studentId, data),
    onSuccess: (response) => {
      queryClient.setQueryData<StudentContextData | null>(
        studentContextQueryKey(studentId),
        response.data ?? null,
      );
    },
  });
}
