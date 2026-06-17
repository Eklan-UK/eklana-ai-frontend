'use client';

import { useQuery } from '@tanstack/react-query';
import type { ConfidenceLabel } from '@/models/learner-confidence';

export interface ProgressScorecardMetrics {
	pronunciation: number;
	accuracy: number;
	fluency: number;
	confidence: number;
	pronunciationWeeklyChange: number;
	accuracyWeeklyChange: number;
	fluencyWeeklyChange: number;
	confidenceWeeklyChange: number;
	confidenceLabel: ConfidenceLabel;
	confidenceTrend: 'improving' | 'stable' | 'declining';
	sampleCounts: {
		pronunciationDrills: number;
		accuracyDrills: number;
		fluencyScenarios: number;
	};
}

async function fetchProgressScorecard(): Promise<ProgressScorecardMetrics> {
	const res = await fetch('/api/v1/progress/scorecard', { cache: 'no-store' });
	if (!res.ok) throw new Error('Failed to fetch progress scorecard');
	const data = await res.json();
	return data.data.scorecard as ProgressScorecardMetrics;
}

export function useProgressScorecard() {
	return useQuery<ProgressScorecardMetrics>({
		queryKey: ['progress-scorecard'],
		queryFn: fetchProgressScorecard,
		staleTime: 1000 * 60 * 5,
		retry: 1,
	});
}
