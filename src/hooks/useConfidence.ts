'use client';

import { useQuery } from '@tanstack/react-query';

export interface ConfidenceMetrics {
  learnerId: string;
  drillsAssigned: number;
  drillsCompleted: number;
  completionRate: number;
  completionContribution: number;
  qualityScore: number;
  qualityContribution: number;
  pronunciationConfidence: number;
  completionConfidence: number;
  confidenceScore: number;
  label:
    | 'Excellent'
    | 'Very Good'
    | 'Good'
    | 'Average'
    | 'Developing'
    | 'Needs Improvement';
  trend: 'improving' | 'stable' | 'declining';
  history: Array<{
    score: number;
    label: string;
    computedAt: string;
    drillsCompleted: number;
  }>;
  lastComputedAt: string;
}

// ── Learner: fetch own confidence ──────────────────────────────
async function fetchConfidence(): Promise<ConfidenceMetrics> {
  const res = await fetch('/api/v1/confidence', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch confidence metrics');
  const data = await res.json();
  return data.data.confidence;
}

export function useConfidence() {
  return useQuery<ConfidenceMetrics>({
    queryKey: ['confidence'],
    queryFn: fetchConfidence,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}

// ── Admin/tutor: fetch any learner's confidence ────────────────
async function fetchLearnerConfidence(learnerId: string): Promise<ConfidenceMetrics> {
  const res = await fetch(`/api/v1/admin/confidence/${learnerId}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch learner confidence');
  const data = await res.json();
  return data.data.confidence;
}

export function useLearnerConfidence(learnerId: string | undefined) {
  return useQuery<ConfidenceMetrics>({
    queryKey: ['confidence', 'admin', learnerId],
    queryFn: () => fetchLearnerConfidence(learnerId!),
    enabled: !!learnerId,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}

// ── Helper: label → colour for UI ─────────────────────────────
export function getConfidenceColor(label: ConfidenceMetrics['label']): string {
  switch (label) {
    case 'Excellent':        return '#16a34a'; // green-700
    case 'Very Good':        return '#22c55e'; // green-500
    case 'Good':             return '#84cc16'; // lime-500
    case 'Average':          return '#eab308'; // yellow-500
    case 'Developing':       return '#f97316'; // orange-500
    case 'Needs Improvement': return '#ef4444'; // red-500
    default:                 return '#6b7280'; // gray-500
  }
}

export function getTrendIcon(trend: ConfidenceMetrics['trend']): string {
  switch (trend) {
    case 'improving': return '↑';
    case 'declining': return '↓';
    default:          return '→';
  }
}
