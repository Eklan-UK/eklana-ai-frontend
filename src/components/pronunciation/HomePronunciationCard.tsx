'use client';

import React, { useMemo } from 'react';
import { Mic, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { usePronunciation } from '@/hooks/usePronunciation';

export function HomePronunciationCard() {
  const { data: metrics, isLoading } = usePronunciation();

  // Calculate weekly change from history if available
  const weeklyChange = useMemo(() => {
    if (!metrics?.history || metrics.history.length === 0) return 0;
    
    // Sort history by date desc
    const sortedHistory = [...metrics.history].sort((a, b) => 
      new Date(b.computedAt).getTime() - new Date(a.computedAt).getTime()
    );
    
    const latest = sortedHistory[0];
    const score = latest.score;
    
    // Find entry ~1 week ago (or oldest if less than week)
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oldEntry = sortedHistory.find(h => new Date(h.computedAt) <= oneWeekAgo) || sortedHistory[sortedHistory.length - 1];
    
    return score - oldEntry.score;
  }, [metrics]);

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-200 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-3 w-16 bg-gray-200 rounded" />
            </div>
            <div className="w-14 h-14 rounded-full bg-gray-200" />
        </div>
      </Card>
    );
  }

  const score = metrics?.overallScore ?? 0;
  // Ensure score is within valid range 0-100
  const validScore = Math.max(0, Math.min(100, score));
  
  const isPositive = weeklyChange >= 0;
  const absChange = Math.abs(weeklyChange);

  // Circle progress
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (validScore / 100) * circumference;

  return (
    <Card className="!p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
            <Mic className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-bold font-satoshi text-gray-900">
              Pronunciation
            </p>
            <div className={`text-xs flex items-center gap-1 mt-0.5 font-medium ${
              isPositive ? 'text-green-600' : 'text-red-500'
            }`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{isPositive ? '+' : '-'}{absChange}% this week</span>
            </div>
          </div>
        </div>
        
        {/* Progress Circle */}
        <div className="relative w-14 h-14 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
            {/* Background Circle */}
            <circle
              cx="32" cy="32" r={radius}
              stroke="#f3f4f6"
              strokeWidth="5"
              fill="none"
            />
            {/* Progress Circle */}
            <circle
              cx="32" cy="32" r={radius}
              stroke="#22c55e" /* green-500 */
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-extrabold font-nunito text-gray-900">
              {Math.round(validScore)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
