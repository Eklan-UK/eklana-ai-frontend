/**
 * React Query Configuration
 * Replaces custom caching with React Query for better performance
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
      refetchOnMount: false, // Don't refetch on mount if data exists
    },
    mutations: {
      retry: 1,
    },
  },
});

// Query keys factory for type safety
export const queryKeys = {
  drills: {
    all: ["drills"] as const,
    lists: () => [...queryKeys.drills.all, "list"] as const,
    list: (filters?: Record<string, any>) =>
      [...queryKeys.drills.lists(), filters] as const,
    details: () => [...queryKeys.drills.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.drills.details(), id] as const,
    learner: {
      all: () => [...queryKeys.drills.all, "learner"] as const,
      list: (filters?: Record<string, any>) =>
        [...queryKeys.drills.learner.all(), "list", filters] as const,
    },
    tutor: {
      all: () => [...queryKeys.drills.all, "tutor"] as const,
      list: (filters?: Record<string, any>) =>
        [...queryKeys.drills.tutor.all(), "list", filters] as const,
    },
  },
  students: {
    all: ["students"] as const,
    lists: () => [...queryKeys.students.all, "list"] as const,
    list: (filters?: Record<string, any>) =>
      [...queryKeys.students.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.students.all, "detail", id] as const,
    tutor: {
      all: () => [...queryKeys.students.all, "tutor"] as const,
      list: (filters?: Record<string, any>) =>
        [...queryKeys.students.tutor.all(), "list", filters] as const,
    },
  },
  learners: {
    all: ["learners"] as const,
    detail: (id: string) => [...queryKeys.learners.all, "detail", id] as const,
    drills: (id: string) => [...queryKeys.learners.all, id, "drills"] as const,
  },
  pronunciations: {
    all: ["pronunciations"] as const,
    lists: () => [...queryKeys.pronunciations.all, "list"] as const,
    list: (filters?: Record<string, any>) =>
      [...queryKeys.pronunciations.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.pronunciations.all, "detail", id] as const,
    learner: {
      all: () => [...queryKeys.pronunciations.all, "learner"] as const,
      list: (filters?: Record<string, any>) =>
        [...queryKeys.pronunciations.learner.all(), "list", filters] as const,
      detail: (id: string) =>
        [...queryKeys.pronunciations.learner.all(), "detail", id] as const,
    },
    attempts: (pronunciationId: string) =>
      [...queryKeys.pronunciations.all, pronunciationId, "attempts"] as const,
  },
  activities: {
    all: ["activities"] as const,
    recent: (filters?: Record<string, any>) =>
      [...queryKeys.activities.all, "recent", filters] as const,
  },
};


