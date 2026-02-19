'use client';

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useConfidence } from '@/hooks/useConfidence';

export function HomeConfidenceCard() {
  const { data: confidence, isLoading } = useConfidence();

  // Calculate weekly change from history
  const weeklyChange = useMemo(() => {
    if (!confidence?.history || confidence.history.length === 0) return 0;

    const today = new Date();
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Find the score closest to 7 days ago
    // History is sorted by computedAt (implied by array push order), but let's be safe
    // Actually the history in model is sliced to last 20, assume they are chronological
    
    // We need a score from roughly 1 week ago. 
    // If no history > 1 week, maybe compare to oldest available?
    // Let's iterate backwards
    let previousScore = confidence.history[0].score; // Default to oldest
    
    // Try to find a specific entry around 7 days ago
    for (const entry of confidence.history) {
        const entryDate = new Date(entry.computedAt);
        if (entryDate <= oneWeekAgo) {
            // This is older than a week, so it's a good baseline? 
            // actually we want the score AT one week ago. 
            // Simplification: Just compare current vs oldest in the last week window?
            // Or compare current vs the entry closests to 7 days ago.
            // Let's just compare vs the first entry in history for now if history is short, 
            // or the one ~7 days ago if history is long.
        }
    }
    
    // Let's simplify: Compare current score vs the score from the earliest entry in the last 7 days?
    // Or just comparing vs the previous entry if we want "since last drill"?
    // The UI says "this week".
    
    // Let's filter history to find the score from ~1 week ago
    // If history is empty/short, 0 change.
    
    const weekOldEntry = confidence.history.find(h => new Date(h.computedAt) >= oneWeekAgo);
    const baselineScore = weekOldEntry ? weekOldEntry.score : confidence.history[0].score;
    
    return confidence.confidenceScore - baselineScore;
  }, [confidence]);

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-yellow-100/50 rounded-lg" />
            <div className="space-y-2">
              <div className="h-4 w-20 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="w-16 h-16 rounded-full bg-gray-100" />
        </div>
      </Card>
    );
  }

  const score = confidence?.confidenceScore ?? 0;
  const isPositive = weeklyChange >= 0;
  const absChange = Math.abs(weeklyChange);

  // Circle progress calculation
  const radius = 28;
  const circumference = 2 * Math.PI * radius; // ~176
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-sm font-medium font-satoshi text-gray-900">
              Confidence
            </p>
            <p className={`text-xs flex items-center gap-1 mt-1 ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              <span>{isPositive ? '↗' : '↘'}</span> 
              {isPositive ? '+' : '-'}{absChange}% this week
            </p>
          </div>
        </div>
        
        {/* Progress Circle */}
        <div className="relative w-16 h-16">
          <svg
            className="transform -rotate-90"
            width="64"
            height="64"
            viewBox="0 0 64 64"
          >
            {/* Background Circle */}
            <circle
              cx="32"
              cy="32"
              r={radius}
              stroke="#e5e7eb"
              strokeWidth="4"
              fill="none"
            />
            {/* Progress Circle */}
            <circle
              cx="32"
              cy="32"
              r={radius}
              stroke="#eab308" /* yellow-500 to match icon */
              strokeWidth="4"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-yellow-600">
              {score}%
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
