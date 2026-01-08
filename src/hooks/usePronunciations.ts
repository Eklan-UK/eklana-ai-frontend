/**
 * React Query hooks for pronunciations
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pronunciationAPI, pronunciationProblemAPI, pronunciationWordAPI } from "@/lib/api";
import { queryKeys } from "@/lib/react-query";
import { toast } from "sonner";

// Get all pronunciations (admin)
export function useAllPronunciations(filters?: {
  limit?: number;
  offset?: number;
  difficulty?: string;
  isActive?: boolean;
  search?: string;
}) {
  return useQuery({
    queryKey: ["pronunciations", "admin", "list", filters],
    queryFn: async () => {
      const response = await pronunciationAPI.getAll(filters);
      return {
        pronunciations: response.data?.pronunciations || [],
        pagination: response.data?.pagination || {},
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Get learner pronunciations
export function useLearnerPronunciations(filters?: {
  limit?: number;
  offset?: number;
  status?: string;
}) {
  return useQuery({
    queryKey: ["pronunciations", "learner", "my-pronunciations", filters],
    queryFn: async () => {
      const response = await pronunciationAPI.getLearnerPronunciations(filters);
      return {
        pronunciations: response.data?.pronunciations || [],
        pagination: response.data?.pagination || {},
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Get single pronunciation for learner (by ID)
export function useLearnerPronunciationById(pronunciationId: string) {
  return useQuery({
    queryKey: ["pronunciations", "learner", "detail", pronunciationId],
    queryFn: async () => {
      // Fetch all learner pronunciations and find the one by ID
      const response = await pronunciationAPI.getLearnerPronunciations();
      const pronunciations = response.data?.pronunciations || [];
      const found = pronunciations.find(
        (p: any) =>
          p.pronunciation?._id === pronunciationId ||
          p.pronunciation?._id?.toString() === pronunciationId
      );
      if (!found) {
        throw new Error("Pronunciation not found");
      }
      return {
        pronunciation: found.pronunciation,
        assignment: found,
      };
    },
    enabled: !!pronunciationId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Create pronunciation mutation
export function useCreatePronunciation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      return await pronunciationAPI.create(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pronunciations", "admin"] });
      toast.success("Pronunciation created successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create pronunciation");
    },
  });
}

// Assign pronunciation mutation
export function useAssignPronunciation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pronunciationId,
      data,
    }: {
      pronunciationId: string;
      data: { learnerIds: string[]; dueDate?: string };
    }) => {
      return await pronunciationAPI.assign(pronunciationId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pronunciations"] });
      queryClient.invalidateQueries({ queryKey: ["pronunciations", "learner"] });
      toast.success("Pronunciation assigned successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to assign pronunciation");
    },
  });
}

// Submit pronunciation attempt
export function useSubmitPronunciationAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pronunciationId,
      data,
    }: {
      pronunciationId: string;
      data: { assignmentId?: string; audioBase64: string; passingThreshold?: number };
    }) => {
      return await pronunciationAPI.submitAttempt(pronunciationId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pronunciations", "learner"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to submit attempt");
    },
  });
}

// Get pronunciation attempts
export function usePronunciationAttempts(pronunciationId: string, learnerId?: string) {
  return useQuery({
    queryKey: ["pronunciations", pronunciationId, "attempts", learnerId],
    queryFn: async () => {
      const response = await pronunciationAPI.getAttempts(pronunciationId, learnerId);
      return {
        attempts: response.data?.attempts || [],
        assignment: response.data?.assignment,
      };
    },
    enabled: !!pronunciationId,
    staleTime: 1000 * 60, // 1 minute
  });
}

// Get learner pronunciation analytics
export function useLearnerPronunciationAnalytics(learnerId: string) {
  return useQuery({
    queryKey: ["pronunciations", "learner", learnerId, "analytics"],
    queryFn: async () => {
      const response = await pronunciationAPI.getLearnerAnalytics(learnerId);
      return response.data;
    },
    enabled: !!learnerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// ===== Pronunciation Problems Hooks =====

// Get all pronunciation problems
export function usePronunciationProblems(filters?: {
  difficulty?: string;
  isActive?: boolean;
}) {
  return useQuery({
    queryKey: ["pronunciation-problems", "list", filters],
    queryFn: async () => {
      const response = await pronunciationProblemAPI.getAll(filters);
      return {
        problems: response.data?.problems || [],
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Get pronunciation problem by slug
export function usePronunciationProblem(slug: string) {
  return useQuery({
    queryKey: ["pronunciation-problems", slug],
    queryFn: async () => {
      const response = await pronunciationProblemAPI.getBySlug(slug);
      return {
        problem: response.data?.problem,
        words: response.data?.words || [],
        progress: response.data?.progress,
      };
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Create pronunciation problem mutation
export function useCreatePronunciationProblem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      phonemes: string[];
      difficulty?: string;
      estimatedTimeMinutes?: number;
      order?: number;
    }) => {
      return await pronunciationProblemAPI.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pronunciation-problems"] });
      toast.success("Pronunciation problem created successfully!");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || "Failed to create pronunciation problem");
    },
  });
}

// Get words in a problem
export function usePronunciationProblemWords(slug: string) {
  return useQuery({
    queryKey: ["pronunciation-problems", slug, "words"],
    queryFn: async () => {
      const response = await pronunciationProblemAPI.getWords(slug);
      return {
        words: response.data?.words || [],
      };
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Add word to problem mutation
export function useAddPronunciationWord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      slug,
      formData,
    }: {
      slug: string;
      formData: FormData;
    }) => {
      return await pronunciationProblemAPI.addWord(slug, formData);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pronunciation-problems", variables.slug, "words"] });
      queryClient.invalidateQueries({ queryKey: ["pronunciation-problems", variables.slug] });
      toast.success("Word added successfully!");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || "Failed to add word");
    },
  });
}

// Submit word attempt mutation
export function useSubmitPronunciationWordAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      wordId,
      data,
    }: {
      wordId: string;
      data: { audioBase64: string; passingThreshold?: number };
    }) => {
      return await pronunciationWordAPI.submitAttempt(wordId, data);
    },
    onSuccess: () => {
      // Invalidate all pronunciation problem queries to refresh progress
      queryClient.invalidateQueries({ queryKey: ["pronunciation-problems"] });
      queryClient.invalidateQueries({ queryKey: ["pronunciations", "learner"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || "Failed to submit attempt");
    },
  });
}

