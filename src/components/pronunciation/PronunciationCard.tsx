'use client';

import React from 'react';
import { Mic, BarChart2, Volume2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { usePronunciation } from '@/hooks/usePronunciation';
import { useLearnerPronunciationAnalytics } from '@/hooks/usePronunciations';

// ── Circular Progress Ring ─────────────────────────────────────
function PronunciationRing({ score }: { score: number }) {
  // Ensure score is within bounds 0-100
  const validScore = Math.max(0, Math.min(100, score || 0));
  
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (validScore / 100) * circumference;

  return (
    <div className="relative w-28 h-28 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        {/* Track */}
        <circle
          cx="50" cy="50" r={radius}
          strokeWidth="8"
          stroke="currentColor"
          fill="none"
          className="text-muted"
        />
        {/* Progress */}
        <circle
          cx="50" cy="50" r={radius}
          strokeWidth="8"
          stroke="#22c55e"  /* Green-500 */
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center transform">
        <span className="text-3xl font-bold font-nunito text-foreground leading-none">
          {Math.round(validScore)}
        </span>
        <span className="text-[10px] text-muted-foreground font-satoshi uppercase tracking-wide mt-1">Avg Score</span>
      </div>
    </div>
  );
}

interface PronunciationCardProps {
  learnerId?: string;
}

// ── Main Card for Profile ──────────────────────────────────────
export function PronunciationCard({ learnerId = '' }: PronunciationCardProps) {
  const { data: metrics, isLoading, isError } = usePronunciation();
  const { data: analytics } = useLearnerPronunciationAnalytics(learnerId);

  if (isLoading) {
    return (
      <Card className="mb-6 animate-pulse p-6">
        <div className="flex items-center gap-6">
          <div className="w-28 h-28 rounded-full bg-muted" />
          <div className="flex-1 space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-8 bg-muted rounded w-1/2" />
          </div>
        </div>
      </Card>
    );
  }

  if (isError) {
    return null;
  }

  const score = metrics?.overallScore ?? 0;
  const totalWords = metrics?.totalWordsPronounced ?? 0;
  const difficultSounds = (analytics?.problemAreas?.topIncorrectPhonemes ?? []).slice(0, 5);

  return (
    <Card className="mb-6 !p-6 relative overflow-hidden">
      {/* Decorative background blob */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -mr-10 -mt-10 opacity-60 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-2 mb-6 relative z-10">
        <div className="p-1.5 bg-primary/15 rounded-lg">
          <Mic className="w-4 h-4 text-green-600" />
        </div>
        <h3 className="text-sm font-bold text-foreground font-satoshi uppercase tracking-wider">
          Pronunciation Performance
        </h3>
      </div>

      {/* Content */}
      <div className="flex flex-col sm:flex-row items-center gap-8 relative z-10">
        
        {/* Ring */}
        <PronunciationRing  score={score} />

        {/* Stats */}
        <div className="flex-1 text-center sm:text-left">
          <div className="mb-4">
            <p className="text-xs text-muted-foreground font-satoshi uppercase tracking-wider font-semibold mb-1">
              Total Words Analyzed
            </p>
            <p className="text-4xl font-extrabold font-nunito text-foreground tracking-tight">
              {totalWords.toLocaleString()}
            </p>
          </div>
          
          <div className="pt-4 border-t border-border flex items-center justify-center sm:justify-start gap-2">
            <BarChart2 className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground font-satoshi">
              Average across all vocabulary and roleplay drills
            </p>
          </div>
        </div>
      </div>

      {/* Difficult Sounds */}
      <div className="mt-6 pt-5 border-t border-border relative z-10">
        <p className="text-xs text-muted-foreground font-satoshi uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-green-600" />
          Difficult Sounds
        </p>
        {difficultSounds.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {difficultSounds.map((item: { phoneme: string; count: number }, idx: number) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-600/10 border border-green-600/20 text-sm font-medium text-foreground font-satoshi"
              >
                <span className="text-green-700">/{item.phoneme}/</span>
                <span className="text-xs text-muted-foreground">×{item.count}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground font-satoshi">
            Complete pronunciation drills to discover your difficult sounds.
          </p>
        )}
      </div>
    </Card>
  );
}
