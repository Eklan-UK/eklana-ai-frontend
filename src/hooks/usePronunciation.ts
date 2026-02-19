'use client';

import { useQuery } from '@tanstack/react-query';

export interface PronunciationMetrics {
  learnerId: string;
  overallScore: number;
  totalWordsPronounced: number;
  history: Array<{
    score: number;
    computedAt: string;
    wordsCount: number;
  }>;
  lastComputedAt: string;
}

// ── Learner: fetch own pronunciation ──────────────────────────
async function fetchPronunciation(): Promise<PronunciationMetrics> {
  const res = await fetch('/api/v1/pronunciation', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch pronunciation metrics');
  const data = await res.json();
  return data.data.pronunciation;
}

export function usePronunciation() {
  return useQuery<PronunciationMetrics>({
    queryKey: ['pronunciation'],
    queryFn: fetchPronunciation,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}

// ── Admin/tutor: fetch any learner's pronunciation ────────────
async function fetchLearnerPronunciation(learnerId: string): Promise<PronunciationMetrics> {
  const res = await fetch(`/api/v1/admin/pronunciation/${learnerId}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch learner pronunciation');
  const data = await res.json();
  return data.data.pronunciation;
}

export function useLearnerPronunciation(learnerId: string | undefined) {
  return useQuery<PronunciationMetrics>({
    queryKey: ['pronunciation', 'admin', learnerId],
    queryFn: () => fetchLearnerPronunciation(learnerId!),
    enabled: !!learnerId,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}
