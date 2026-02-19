'use client';

import React from 'react';
import { Mic, BarChart2, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { usePronunciation } from '@/hooks/usePronunciation';

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
          stroke="#f3f4f6"
          fill="none"
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
        <span className="text-3xl font-bold font-nunito text-gray-900 leading-none">
          {Math.round(validScore)}
        </span>
        <span className="text-[10px] text-gray-400 font-satoshi uppercase tracking-wide mt-1">Avg Score</span>
      </div>
    </div>
  );
}

// ── Main Card for Profile ──────────────────────────────────────
export function PronunciationCard() {
  const { data: metrics, isLoading, isError } = usePronunciation();

  if (isLoading) {
    return (
      <Card className="mb-6 animate-pulse p-6">
        <div className="flex items-center gap-6">
          <div className="w-28 h-28 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-8 bg-gray-200 rounded w-1/2" />
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

  return (
    <Card className="mb-6 !p-6 relative overflow-hidden">
      {/* Decorative background blob */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full blur-2xl -mr-10 -mt-10 opacity-60 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-2 mb-6 relative z-10">
        <div className="p-1.5 bg-green-100/50 rounded-lg">
          <Mic className="w-4 h-4 text-green-600" />
        </div>
        <h3 className="text-sm font-bold text-gray-800 font-satoshi uppercase tracking-wider">
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
            <p className="text-xs text-gray-500 font-satoshi uppercase tracking-wider font-semibold mb-1">
              Total Words Analyzed
            </p>
            <p className="text-4xl font-extrabold font-nunito text-gray-900 tracking-tight">
              {totalWords.toLocaleString()}
            </p>
          </div>
          
          <div className="pt-4 border-t border-gray-100 flex items-center justify-center sm:justify-start gap-2">
            <BarChart2 className="w-4 h-4 text-gray-400" />
            <p className="text-sm text-gray-500 font-satoshi">
              Average across all vocabulary and roleplay drills
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
