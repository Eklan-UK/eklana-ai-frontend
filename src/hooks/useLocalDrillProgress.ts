'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAuthStore } from '@/store/auth-store';
import {
  buildLocalDrillProgressV1,
  clearLocalDrillProgress,
  getLocalDrillProgress,
  resolveLocalProgressScope,
  setLocalDrillProgress,
  type LocalDrillProgressScope,
  type LocalDrillProgressV1,
  type WeeklyChallengeLocalMeta,
} from '@/lib/drill/local-drill-progress';

export type PersistLocalDrillProgressInput = {
  resumeFromIndex: number;
  completedItemCount: number;
  partialResults: Record<string, unknown>;
  startedAt?: string;
};

export type UseLocalDrillProgressOptions = {
  drillId: string;
  drillType: string;
  assignmentId?: string | null;
  weeklyChallengeMeta?: WeeklyChallengeLocalMeta | null;
  /** When true, clears any existing local progress once ready and skips hydrate restores */
  clearOnReady?: boolean;
};

function resolveUserId(user: { id?: string; _id?: string } | null | undefined): string | null {
  if (!user) return null;
  if (typeof user.id === 'string' && user.id) return user.id;
  if (typeof user._id === 'string' && user._id) return user._id;
  return null;
}

/**
 * Silent device-local drill resume. Flushes on pagehide / visibility hidden / unmount.
 * Prefer local over server checkpoints when hydrating (local is fresher between milestones).
 */
export function useLocalDrillProgress(options: UseLocalDrillProgressOptions) {
  const { drillId, drillType, assignmentId, weeklyChallengeMeta, clearOnReady } = options;
  const user = useAuthStore((s) => s.user);
  const userId = resolveUserId(user);

  const scope = useMemo(
    (): LocalDrillProgressScope =>
      resolveLocalProgressScope({
        drillId,
        assignmentId,
        weeklyChallengeMeta,
      }),
    [drillId, assignmentId, weeklyChallengeMeta],
  );

  const latestRef = useRef<LocalDrillProgressV1 | null>(null);
  const startedAtRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearedOnReadyRef = useRef(false);

  const isReady = Boolean(userId && drillId);

  const clearDebounce = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const write = useCallback(
    (input: PersistLocalDrillProgressInput) => {
      if (!userId || !drillId) return null;
      const progress = buildLocalDrillProgressV1({
        drillId,
        drillType,
        scope,
        resumeFromIndex: input.resumeFromIndex,
        completedItemCount: input.completedItemCount,
        partialResults: input.partialResults,
        startedAt: input.startedAt,
        previousStartedAt: startedAtRef.current ?? undefined,
      });
      startedAtRef.current = progress.startedAt;
      latestRef.current = progress;
      setLocalDrillProgress(userId, progress);
      return progress;
    },
    [userId, drillId, drillType, scope],
  );

  const persist = useCallback(
    (input: PersistLocalDrillProgressInput) => {
      clearDebounce();
      return write(input);
    },
    [clearDebounce, write],
  );

  const persistDebounced = useCallback(
    (input: PersistLocalDrillProgressInput, delayMs = 400) => {
      clearDebounce();
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        write(input);
      }, delayMs);
    },
    [clearDebounce, write],
  );

  const hydrate = useCallback((): LocalDrillProgressV1 | null => {
    if (!userId || !drillId) return null;
    const stored = getLocalDrillProgress(userId, scope);
    if (!stored) return null;
    latestRef.current = stored;
    startedAtRef.current = stored.startedAt;
    return stored;
  }, [userId, drillId, scope]);

  const clear = useCallback(() => {
    clearDebounce();
    latestRef.current = null;
    startedAtRef.current = null;
    if (!userId) return;
    clearLocalDrillProgress(userId, scope);
  }, [clearDebounce, userId, scope]);

  const flush = useCallback(() => {
    clearDebounce();
    if (!userId || !latestRef.current) return;
    setLocalDrillProgress(userId, {
      ...latestRef.current,
      lastUpdatedAt: new Date().toISOString(),
    });
  }, [clearDebounce, userId]);

  // Optional one-shot clear for redo entry
  useEffect(() => {
    if (!isReady || !clearOnReady || clearedOnReadyRef.current) return;
    clearedOnReadyRef.current = true;
    clear();
  }, [isReady, clearOnReady, clear]);

  // Sync flush on leave / background / unmount
  useEffect(() => {
    if (!isReady) return;

    const onPageHide = () => {
      flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    };

    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
      clearDebounce();
    };
  }, [isReady, flush, clearDebounce]);

  return {
    isReady,
    userId,
    scope,
    hydrate,
    persist,
    persistDebounced,
    clear,
    flush,
  };
}
