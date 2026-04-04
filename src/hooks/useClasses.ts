/**
 * React Query hooks for admin Classes (Phase 1).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classesAPI } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';
import { toast } from 'sonner';
import type { CreateAdminClassBody } from '@/domain/classes/class.api.types';

export function useAdminClasses(filters?: {
  bucket?: 'today' | 'upcoming';
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: queryKeys.classes.list(filters),
    queryFn: async () => {
      const res = await classesAPI.list(filters);
      return res.data;
    },
    staleTime: 1000 * 60,
  });
}

export function useAdminClassDetail(classSeriesId: string | null) {
  return useQuery({
    queryKey: queryKeys.classes.detail(classSeriesId ?? ''),
    queryFn: async () => {
      const res = await classesAPI.getById(classSeriesId!);
      return res.data;
    },
    enabled: !!classSeriesId,
    staleTime: 1000 * 60,
  });
}

export function useCreateAdminClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAdminClassBody) => classesAPI.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
      queryClient.invalidateQueries({ queryKey: ['tutor', 'classes'] });
      queryClient.invalidateQueries({ queryKey: ['learner', 'classes'] });
      toast.success('Class scheduled');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to schedule class');
    },
  });
}

export function useDeleteAdminClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (classSeriesId: string) => classesAPI.delete(classSeriesId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
      queryClient.invalidateQueries({ queryKey: ['tutor', 'classes'] });
      queryClient.invalidateQueries({ queryKey: ['learner', 'classes'] });
      toast.success('Schedule removed');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove schedule');
    },
  });
}

/** Tutor dashboard: classes assigned to the logged-in tutor (Phase 2). */
export function useTutorClasses(filters?: {
  bucket?: 'today' | 'upcoming';
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: queryKeys.classes.tutorList(filters),
    queryFn: async () => {
      const res = await classesAPI.tutorList(filters);
      return res.data;
    },
    staleTime: 1000 * 60,
  });
}

/** Learner: enrolled classes (Phase 3). */
export function useLearnerClasses(filters?: {
  bucket?: 'today' | 'upcoming';
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: queryKeys.classes.learnerList(filters),
    queryFn: async () => {
      const res = await classesAPI.learnerList(filters);
      return res.data;
    },
    staleTime: 1000 * 60,
  });
}

export function useLearnerSession(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.classes.learnerSession(sessionId ?? ''),
    queryFn: async () => {
      const res = await classesAPI.learnerSession(sessionId!);
      return res.data;
    },
    enabled: !!sessionId,
    staleTime: 1000 * 30,
  });
}

/** Learner: POST attendance when joining (Phase 4). */
export function useRecordLearnerAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      status,
    }: {
      sessionId: string;
      status?: 'present' | 'late';
    }) => classesAPI.recordLearnerAttendance(sessionId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tutor', 'sessions'],
      });
    },
  });
}

/** Tutor: roster for a session (Phase 4). */
export function useTutorSessionAttendance(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.classes.tutorSessionAttendance(sessionId ?? ''),
    queryFn: async () => {
      const res = await classesAPI.getTutorSessionAttendance(sessionId!);
      return res.data;
    },
    enabled: !!sessionId,
    staleTime: 1000 * 30,
  });
}

/** Learner: alternative slots same UTC week (Phase 5). */
export function useLearnerRescheduleOptions(
  sessionId: string | null,
  opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.classes.learnerRescheduleOptions(sessionId ?? ''),
    queryFn: async () => {
      const res = await classesAPI.learnerRescheduleOptions(sessionId!);
      return res.data;
    },
    enabled: !!sessionId && opts?.enabled !== false,
    staleTime: 1000 * 60,
  });
}

export function useLearnerRescheduleSession(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { newStartUtc: string; newEndUtc: string }) =>
      classesAPI.learnerReschedule(sessionId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
      queryClient.invalidateQueries({ queryKey: ['tutor', 'classes'] });
      queryClient.invalidateQueries({ queryKey: ['learner', 'classes'] });
      queryClient.invalidateQueries({
        queryKey: queryKeys.classes.learnerSession(sessionId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.classes.learnerRescheduleOptions(sessionId),
      });
      toast.success('Session rescheduled');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not reschedule');
    },
  });
}
