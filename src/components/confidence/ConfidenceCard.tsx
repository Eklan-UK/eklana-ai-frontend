'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useProgressScorecard } from '@/hooks/useProgressScorecard';
import { getConfidenceColor } from '@/hooks/useConfidence';

// ── Sub-component: circular progress ring ──────────────────────
function ConfidenceRing({ score, color }: { score: number; color: string }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-28 h-28 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50" cy="50" r={radius}
          strokeWidth="8"
          stroke="currentColor"
          fill="none"
          className="text-muted"
        />
        <circle
          cx="50" cy="50" r={radius}
          strokeWidth="8"
          stroke={color}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-nunito text-foreground leading-none">
          {score}
        </span>
        <span className="text-xs text-muted-foreground font-satoshi">/ 100</span>
      </div>
    </div>
  );
}

// ── Trend badge ─────────────────────────────────────────────────
function TrendBadge({ trend }: { trend: 'improving' | 'stable' | 'declining' }) {
  if (trend === 'improving') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-satoshi">
        <TrendingUp className="w-3 h-3" /> Improving
      </span>
    );
  }
  if (trend === 'declining') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-satoshi">
        <TrendingDown className="w-3 h-3" /> Declining
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-satoshi">
      <Minus className="w-3 h-3" /> Stable
    </span>
  );
}

// ── Mini sub-score bar ──────────────────────────────────────────
function SubBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs text-muted-foreground font-satoshi">{label}</span>
        <span className="text-xs font-semibold font-satoshi" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ── Main ConfidenceCard ─────────────────────────────────────────
export function ConfidenceCard() {
  const { data: scorecard, isLoading, isError } = useProgressScorecard();

  if (isLoading) {
    return (
      <Card className="mb-6 p-4 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-28 h-28 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-3 bg-muted rounded w-2/3" />
          </div>
        </div>
      </Card>
    );
  }

  if (isError || !scorecard) {
    return null;
  }

  const color = getConfidenceColor(scorecard.confidenceLabel);

  return (
    <Card className="mb-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-[#22c55e]" />
        <h3 className="text-sm font-semibold text-foreground font-satoshi uppercase tracking-wide">
          Confidence Score
        </h3>
      </div>

      {/* Body */}
      <div className="flex items-center gap-5">
        <ConfidenceRing score={scorecard.confidence} color={color} />

        <div className="flex-1 min-w-0">
          {/* Label + Trend */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-lg font-bold font-nunito" style={{ color }}>
              {scorecard.confidenceLabel}
            </span>
            <TrendBadge trend={scorecard.confidenceTrend} />
          </div>

          {/* Sub-score bars — three pillars */}
          <div className="space-y-2">
            <SubBar label="Pronunciation" value={scorecard.pronunciation} color="#22c55e" />
            <SubBar label="Accuracy" value={scorecard.accuracy} color="#0284c7" />
            <SubBar label="Fluency" value={scorecard.fluency} color="#7c3aed" />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground font-satoshi">
        <span>Average of Pronunciation, Accuracy, and Fluency</span>
      </div>
    </Card>
  );
}
