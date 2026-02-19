'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import {
  useConfidence,
  getConfidenceColor,
  getTrendIcon,
  type ConfidenceMetrics,
} from '@/hooks/useConfidence';

// ── Sub-component: circular progress ring ──────────────────────
function ConfidenceRing({ score, color }: { score: number; color: string }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

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
          stroke={color}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-nunito text-gray-900 leading-none">
          {score}
        </span>
        <span className="text-xs text-gray-400 font-satoshi">/ 100</span>
      </div>
    </div>
  );
}

// ── Trend icon ──────────────────────────────────────────────────
function TrendBadge({ trend }: { trend: ConfidenceMetrics['trend'] }) {
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
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-satoshi">
      <Minus className="w-3 h-3" /> Stable
    </span>
  );
}

// ── Main ConfidenceCard ─────────────────────────────────────────
export function ConfidenceCard() {
  const { data: confidence, isLoading, isError } = useConfidence();

  if (isLoading) {
    return (
      <Card className="mb-6 p-4 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-28 h-28 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-6 bg-gray-200 rounded w-1/3" />
            <div className="h-3 bg-gray-200 rounded w-2/3" />
          </div>
        </div>
      </Card>
    );
  }

  if (isError || !confidence) {
    return null; // silently skip if no data yet (new user)
  }

  const color = getConfidenceColor(confidence.label);

  return (
    <Card className="mb-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-[#22c55e]" />
        <h3 className="text-sm font-semibold text-gray-700 font-satoshi uppercase tracking-wide">
          Confidence Score
        </h3>
      </div>

      {/* Body */}
      <div className="flex items-center gap-5">
        {/* Ring */}
        <ConfidenceRing score={confidence.confidenceScore} color={color} />

        {/* Details */}
        <div className="flex-1 min-w-0">
          {/* Label + Trend */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className="text-lg font-bold font-nunito"
              style={{ color }}
            >
              {confidence.label}
            </span>
            <TrendBadge trend={confidence.trend} />
          </div>

          {/* Drills progress */}
          <p className="text-xs font-satoshi text-gray-500 mb-3">
            {confidence.drillsCompleted} of {confidence.drillsAssigned} drills completed
          </p>

          {/* Sub-score bars */}
          <div className="space-y-2">
            <SubBar
              label="Pronunciation"
              value={confidence.pronunciationConfidence}
              color="#22c55e"
            />
            <SubBar
              label="Completion"
              value={Math.round(confidence.completionRate * 100)}
              color="#3b82f6"
            />
          </div>
        </div>
      </div>

      {/* Footer formula hint */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400 font-satoshi">
        <span>Completion 40% + Quality 60%</span>
        <span>Based on Speechace scores</span>
      </div>
    </Card>
  );
}

// ── Mini sub-score bar ──────────────────────────────────────────
function SubBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs text-gray-500 font-satoshi">{label}</span>
        <span className="text-xs font-semibold font-satoshi" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
