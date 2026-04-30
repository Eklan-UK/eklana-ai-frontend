/**
 * React Query hooks for admin Classes (Phase 1).
 */
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { classesAPI, tutorAPI } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';
import { toast } from 'sonner';
import type {
  AdminClassListItemDTO,
  ClassBucket,
  CreateAdminClassBody,
} from '@/domain/classes/class.api.types';

type AdminSessionQueryData = {
  classTitle: string;
  tutorName: string;
  session: {
    id: string;
    classSeriesId: string;
    startUtc: string;
    endUtc: string;
    status: string;
    isReschedule?: boolean;
  };
};

function applyAdminSessionRescheduleToCache(
  queryClient: QueryClient,
  sessionId: string,
  newStartUtc: string,
  newEndUtc: string,
) {
  queryClient.setQueryData(
    queryKeys.classes.adminSession(sessionId),
    (old: AdminSessionQueryData | undefined) => {
      if (!old) return old;
      return {
        ...old,
        session: {
          ...old.session,
          startUtc: newStartUtc,
          endUtc: newEndUtc,
          isReschedule: true,
        },
      };
    },
  );
}

type ClassListQueryData = {
  classes: AdminClassListItemDTO[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore?: boolean;
  };
};

function formatTimeLabel(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function patchClassListDataOnReschedule(
  old: ClassListQueryData | undefined,
  classSeriesId: string,
  newStartUtc: string,
  newEndUtc: string,
): ClassListQueryData | undefined {
  if (!old) return old;
  const start = new Date(newStartUtc);
  const end = new Date(newEndUtc);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return old;

  const nextSessionLabel = start.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeRange = `${formatTimeLabel(start)} – ${formatTimeLabel(end)}`;
  const scheduleDays = start.toLocaleDateString('en-US', { weekday: 'long' });

  const now = new Date();
  const isToday =
    start.getFullYear() === now.getFullYear() &&
    start.getMonth() === now.getMonth() &&
    start.getDate() === now.getDate();
  const bucket: ClassBucket = isToday ? 'today' : 'upcoming';

  return {
    ...old,
    classes: old.classes.map((row) => {
      if (row.id !== classSeriesId) return row;
      const drawer = row.drawer
        ? {
            ...row.drawer,
            sessionTimeRange: timeRange.replace(' – ', ' - '),
            nextSessionFull: nextSessionLabel,
          }
        : { nextSessionFull: nextSessionLabel, sessionTimeRange: timeRange.replace(' – ', ' - ') };
      return {
        ...row,
        nextSessionStartUtc: newStartUtc,
        nextSessionIsReschedule: true,
        nextSessionLabel,
        timeRange,
        scheduleDays,
        bucket,
        drawer,
      };
    }),
  };
}

function isClassListQueryKey(key: readonly unknown[] | undefined, role: 'admin' | 'tutor' | 'learner') {
  if (!key || key.length < 3) return false;
  if (role === 'admin') {
    return key[0] === 'admin' && key[1] === 'classes' && key[2] === 'list';
  }
  if (role === 'tutor') {
    return key[0] === 'tutor' && key[1] === 'classes' && key[2] === 'list';
  }
  return key[0] === 'learner' && key[1] === 'classes' && key[2] === 'list';
}

/**
 * List rows must reflect the new next-session time while off-screen; React Query
 * can keep inactive list data stale. Patch caches + call after invalidate.
 */
function patchClassListCachesAfterReschedule(
  queryClient: QueryClient,
  classSeriesId: string,
  newStartUtc: string,
  newEndUtc: string,
) {
  (['admin', 'tutor', 'learner'] as const).forEach((role) => {
    queryClient.setQueriesData(
      { predicate: (q) => isClassListQueryKey(q.queryKey as readonly unknown[], role) },
      (old) => patchClassListDataOnReschedule(old as ClassListQueryData, classSeriesId, newStartUtc, newEndUtc),
    );
  });
}

function readClassSeriesIdFromSessionCache(
  queryClient: QueryClient,
  sessionId: string,
  source: 'admin' | 'tutor',
) {
  const k =
    source === 'admin'
      ? queryKeys.classes.adminSession(sessionId)
      : queryKeys.classes.tutorSession(sessionId);
  return queryClient.getQueryData<AdminSessionQueryData | undefined>(k)?.session
    .classSeriesId;
}

async function refetchAllClassListQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.refetchQueries({ queryKey: ['admin', 'classes', 'list'], type: 'all' }),
    queryClient.refetchQueries({ queryKey: ['tutor', 'classes', 'list'], type: 'all' }),
    queryClient.refetchQueries({ queryKey: ['learner', 'classes', 'list'], type: 'all' }),
  ]);
}

export function useAdminClasses(filters?: {
  bucket?: import('@/domain/classes/class.api.types').ClassBucket;
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
    refetchInterval: 1000 * 60,
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
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
      queryClient.invalidateQueries({ queryKey: ['tutor', 'classes'] });
      queryClient.invalidateQueries({ queryKey: ['learner', 'classes'] });
      toast.success('Class scheduled');
      const w = res.data?.calendarSyncWarning;
      if (w) {
        toast.warning(w, { duration: 12_000 });
      }
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
  bucket?: import('@/domain/classes/class.api.types').ClassBucket;
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
    refetchInterval: 1000 * 60,
  });
}

/** Learner: enrolled classes (Phase 3). */
export function useLearnerClasses(filters?: {
  bucket?: import('@/domain/classes/class.api.types').ClassBucket;
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

/** Ended sessions for the Past tab (newest first). */
export function useLearnerPastSessions(filters?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: queryKeys.classes.learnerPastSessions(filters),
    queryFn: async () => {
      const res = await classesAPI.learnerPastSessions(filters);
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
      queryClient.invalidateQueries({
        queryKey: ['learner', 'sessions', 'past'],
      });
      queryClient.invalidateQueries({
        queryKey: ['learner', 'classes', 'list'],
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

export function useTutorSession(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.classes.tutorSession(sessionId ?? ''),
    queryFn: async () => {
      const res = await classesAPI.tutorSession(sessionId!);
      return res.data;
    },
    enabled: !!sessionId,
    staleTime: 1000 * 30,
  });
}

export function useTutorRescheduleOptions(
  sessionId: string | null,
  opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.classes.tutorRescheduleOptions(sessionId ?? ''),
    queryFn: async () => {
      const res = await classesAPI.tutorRescheduleOptions(sessionId!);
      return res.data;
    },
    enabled: !!sessionId && opts?.enabled !== false,
    staleTime: 1000 * 60,
  });
}

export function useAdminSession(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.classes.adminSession(sessionId ?? ""),
    queryFn: async () => {
      const res = await classesAPI.adminSession(sessionId!);
      return res.data;
    },
    enabled: !!sessionId,
    staleTime: 1000 * 30,
  });
}

export function useAdminRescheduleOptions(
  sessionId: string | null,
  opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.classes.adminRescheduleOptions(sessionId ?? ""),
    queryFn: async () => {
      const res = await classesAPI.adminRescheduleOptions(sessionId!);
      return res.data;
    },
    enabled: !!sessionId && opts?.enabled !== false,
    staleTime: 1000 * 60,
  });
}

/** Tutor: weekly availability editor. */
export function useTutorAvailability() {
  return useQuery({
    queryKey: queryKeys.classes.tutorAvailability,
    queryFn: async () => {
      const res = await classesAPI.getTutorAvailability();
      return res.data;
    },
    staleTime: 1000 * 60,
  });
}

export function useTutorGoogleCalendarStatus() {
  return useQuery({
    queryKey: ['tutor', 'google-calendar-status'],
    queryFn: async () => {
      const res = await tutorAPI.getGoogleCalendarStatus();
      return res.data;
    },
    staleTime: 1000 * 60,
  });
}

export function useDisconnectTutorGoogleCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => tutorAPI.disconnectGoogleCalendar(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tutor', 'google-calendar-status'],
      });
      toast.success('Google Calendar disconnected');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not disconnect Google Calendar');
    },
  });
}

export function useUpdateTutorAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      body: import('@/domain/tutor-availability/tutor-availability.api.types').TutorAvailabilityResponse,
    ) => classesAPI.updateTutorAvailability(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.tutorAvailability });
      queryClient.invalidateQueries({ queryKey: ['learner'] });
      toast.success('Availability saved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not save availability');
    },
  });
}

/** Learner: tutor hours when enrolled (read-only). */
export function useLearnerTutorAvailability(tutorId: string | null) {
  return useQuery({
    queryKey: queryKeys.classes.learnerTutorAvailability(tutorId ?? ''),
    queryFn: async () => {
      const res = await classesAPI.getLearnerTutorAvailability(tutorId!);
      return res.data;
    },
    enabled: !!tutorId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useTutorRescheduleSession(sessionId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (body: {
      newStartUtc: string;
      newEndUtc: string;
      reservationId: string;
      reservationToken: string;
    }) => classesAPI.tutorReschedule(sessionId, body),
    onSuccess: async (_res, variables) => {
      const classSeriesId = readClassSeriesIdFromSessionCache(
        queryClient,
        sessionId,
        'tutor',
      );
      if (classSeriesId) {
        patchClassListCachesAfterReschedule(
          queryClient,
          classSeriesId,
          variables.newStartUtc,
          variables.newEndUtc,
        );
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.classes.all,
          refetchType: 'all',
        }),
        queryClient.invalidateQueries({ queryKey: ['tutor', 'classes'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['learner', 'classes'], refetchType: 'all' }),
      ]);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.classes.tutorSession(sessionId),
          refetchType: 'all',
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.classes.tutorRescheduleOptions(sessionId),
          refetchType: 'all',
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.classes.tutorSessionAttendance(sessionId),
          refetchType: 'all',
        }),
      ]);
      await refetchAllClassListQueries(queryClient);
      toast.success('Session rescheduled');
      router.push('/tutor/classes');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not reschedule');
    },
  });
}

export function useAdminRescheduleSession(sessionId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (body: {
      newStartUtc: string;
      newEndUtc: string;
      reservationId: string;
      reservationToken: string;
    }) => classesAPI.adminReschedule(sessionId, body),
    onSuccess: async (_res, variables) => {
      const classSeriesId = readClassSeriesIdFromSessionCache(
        queryClient,
        sessionId,
        'admin',
      );
      applyAdminSessionRescheduleToCache(
        queryClient,
        sessionId,
        variables.newStartUtc,
        variables.newEndUtc,
      );
      if (classSeriesId) {
        patchClassListCachesAfterReschedule(
          queryClient,
          classSeriesId,
          variables.newStartUtc,
          variables.newEndUtc,
        );
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.classes.all,
          refetchType: 'all',
        }),
        queryClient.invalidateQueries({ queryKey: ['tutor', 'classes'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['learner', 'classes'], refetchType: 'all' }),
      ]);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.classes.adminSession(sessionId),
          refetchType: 'all',
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.classes.adminRescheduleOptions(sessionId),
          refetchType: 'all',
        }),
      ]);
      await refetchAllClassListQueries(queryClient);
      toast.success('Session rescheduled');
      router.push('/admin/classes');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not reschedule');
    },
  });
}

export function useAdminRescheduleSessionDirect(sessionId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (body: { newStartUtc: string; newEndUtc: string }) =>
      classesAPI.adminRescheduleDirect(sessionId, body),
    onSuccess: async (_res, variables) => {
      const classSeriesId = readClassSeriesIdFromSessionCache(
        queryClient,
        sessionId,
        'admin',
      );
      applyAdminSessionRescheduleToCache(
        queryClient,
        sessionId,
        variables.newStartUtc,
        variables.newEndUtc,
      );
      if (classSeriesId) {
        patchClassListCachesAfterReschedule(
          queryClient,
          classSeriesId,
          variables.newStartUtc,
          variables.newEndUtc,
        );
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.classes.all,
          refetchType: 'all',
        }),
        queryClient.invalidateQueries({ queryKey: ['tutor', 'classes'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['learner', 'classes'], refetchType: 'all' }),
      ]);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.classes.adminSession(sessionId),
          refetchType: 'all',
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.classes.adminRescheduleOptions(sessionId),
          refetchType: 'all',
        }),
      ]);
      await refetchAllClassListQueries(queryClient);
      toast.success('Session rescheduled');
      router.push('/admin/classes');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not reschedule');
    },
  });
}

/** Pessimistic hold for a selected reschedule time (tutor). */
export function useTutorReserveRescheduleSlot(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { startUtc: string; endUtc: string }) => {
      const res = await classesAPI.tutorReserveRescheduleSlot(sessionId, body);
      if (!res.data) {
        throw new Error('Could not reserve this time');
      }
      return res.data;
    },
    onError: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.classes.tutorRescheduleOptions(sessionId),
      });
    },
  });
}

/** Pessimistic hold for a selected reschedule time (admin). */
export function useAdminReserveRescheduleSlot(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { startUtc: string; endUtc: string }) => {
      const res = await classesAPI.adminReserveRescheduleSlot(sessionId, body);
      if (!res.data) {
        throw new Error('Could not reserve this time');
      }
      return res.data;
    },
    onError: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.classes.adminRescheduleOptions(sessionId),
      });
    },
  });
}
