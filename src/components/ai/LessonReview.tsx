"use client";

import {
  ArrowRight,
  CircleCheck,
  Target,
  Trophy,
  Volume2,
  X,
  Zap,
} from "lucide-react";

interface ReviewMetric {
  value: number;
  label: string;
}

interface TurnFeedback {
  turnNumber: number;
  feedback: string;
  rating: "strong" | "adequate" | "needs_work";
}

interface LessonReviewData {
  responseSpeedSeconds: number;
  responseSpeedLabel: string;
  sentenceAccuracy: ReviewMetric;
  pronunciation: ReviewMetric;
  confidence: ReviewMetric;
  level: number;
  levelBefore?: number;
  levelAfter?: number;
  levelChanged?: boolean;
  progressToNextLevel: number;
  strengths?: string[];
  weaknesses?: string[];
  nextSteps?: string[];
  turnFeedback?: TurnFeedback[];
}

interface LessonReviewProps {
  open: boolean;
  data: LessonReviewData | null;
  onClose: () => void;
  onPracticeWeakAreas: () => void;
  onDoneForToday: () => void;
}

function metricProgress(value: number): string {
  return `${Math.max(0, Math.min(100, value))}%`;
}

function MetricRow({
  icon,
  title,
  valueText,
  subtitle,
  progress,
}: {
  icon: React.ReactNode;
  title: string;
  valueText: string;
  subtitle: string;
  progress: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="text-[16px] font-semibold text-slate-800">{title}</span>
        </div>
        <div className="text-right">
          <p className="text-[31px] font-bold text-emerald-600 leading-none">{valueText}</p>
          <p className="text-[14px] text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: metricProgress(progress) }}
        />
      </div>
    </div>
  );
}

function LevelChangeBadge({ levelBefore, levelAfter }: { levelBefore: number; levelAfter: number }) {
  const leveledUp = levelAfter > levelBefore;
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
        leveledUp
          ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
          : "bg-amber-100 text-amber-700 border border-amber-200"
      }`}
    >
      <Trophy className="w-3.5 h-3.5" />
      {leveledUp ? `Level Up! ${levelBefore} → ${levelAfter}` : `Level ${levelBefore} → ${levelAfter}`}
    </div>
  );
}

export function LessonReview({
  open,
  data,
  onClose,
  onPracticeWeakAreas,
  onDoneForToday,
}: LessonReviewProps) {
  if (!open || !data) return null;

  const levelBefore = data.levelBefore ?? data.level;
  const levelAfter = data.levelAfter ?? data.level;
  const levelChanged = data.levelChanged ?? levelAfter !== levelBefore;

  const strengths = data.strengths ?? [];
  const weaknesses = data.weaknesses ?? [];
  const nextSteps = data.nextSteps ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-black/30 overflow-y-auto">
      <div className="min-h-full flex items-end justify-center">
        <div className="w-full max-w-2xl bg-white rounded-t-3xl p-4 pb-8 shadow-2xl">

          {/* ── Header ── */}
          <div className="px-4 pt-4 pb-3 border-b border-slate-100">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-[36px] font-bold text-slate-800 leading-tight">Lesson Review</h2>
                <p className="text-[18px] text-slate-500 leading-tight">Here&apos;s how you did</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {levelChanged && (
                  <LevelChangeBadge levelBefore={levelBefore} levelAfter={levelAfter} />
                )}
                <button
                  type="button"
                  aria-label="Close review"
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-slate-700" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-4">
            {/* ── Metrics ── */}
            <div className="bg-slate-50 rounded-3xl p-4 space-y-5 border border-slate-200">
              <MetricRow
                icon={<Zap className="w-[18px] h-[18px] text-blue-500" />}
                title="Response speed"
                valueText={`${data.responseSpeedSeconds.toFixed(1)}s`}
                subtitle={data.responseSpeedLabel}
                progress={Math.min(100, (2 / Math.max(data.responseSpeedSeconds, 0.1)) * 100)}
              />
              <MetricRow
                icon={<Target className="w-[18px] h-[18px] text-emerald-500" />}
                title="Sentence accuracy"
                valueText={`${data.sentenceAccuracy.value}%`}
                subtitle={data.sentenceAccuracy.label}
                progress={data.sentenceAccuracy.value}
              />
              <MetricRow
                icon={<Volume2 className="w-[18px] h-[18px] text-orange-500" />}
                title="Pronunciation"
                valueText={`${data.pronunciation.value}%`}
                subtitle={data.pronunciation.label}
                progress={data.pronunciation.value}
              />
              <MetricRow
                icon={<CircleCheck className="w-[18px] h-[18px] text-violet-500" />}
                title="Confidence"
                valueText={`${data.confidence.value}%`}
                subtitle={data.confidence.label}
                progress={data.confidence.value}
              />
            </div>

            {/* ── Level card ── */}
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[16px] text-slate-600">Your Level</p>
                  <p className="text-[36px] leading-none font-bold text-slate-900">Level {levelAfter}</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-violet-600 flex items-center justify-center shadow-lg">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-[14px] text-slate-700">Progress to Level {levelAfter + 1}</p>
                  <p className="text-[14px] font-semibold text-violet-600">
                    {Math.round(data.progressToNextLevel)}%
                  </p>
                </div>
                <div className="mt-1.5 h-2.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-600 transition-all"
                    style={{ width: metricProgress(data.progressToNextLevel) }}
                  />
                </div>
              </div>
            </div>

            {/* ── Qualitative feedback ── */}
            {(strengths.length > 0 || weaknesses.length > 0 || nextSteps.length > 0) && (
              <div className="space-y-3">

                {strengths.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                    <p className="text-sm font-semibold text-emerald-700 mb-2">What went well</p>
                    <ul className="space-y-1.5">
                      {strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CircleCheck className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-emerald-800">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {weaknesses.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <p className="text-sm font-semibold text-amber-700 mb-2">Needs work</p>
                    <ul className="space-y-1.5">
                      {weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500 font-bold text-xs flex items-center justify-center">●</span>
                          <span className="text-sm text-amber-800">{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {nextSteps.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                    <p className="text-sm font-semibold text-blue-700 mb-2">Next steps</p>
                    <ul className="space-y-1.5">
                      {nextSteps.map((n, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <ArrowRight className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-blue-800">{n}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* ── Sticky action bar ── */}
          <div className="sticky bottom-0 border-t border-slate-200 bg-white/85 backdrop-blur-md px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onPracticeWeakAreas}
                className="w-full h-12 rounded-full bg-emerald-600 text-white text-[16px] font-semibold hover:bg-emerald-700 transition-colors"
              >
                Practice Weak Areas
              </button>
              <button
                type="button"
                onClick={onDoneForToday}
                className="w-full h-12 rounded-full border border-emerald-600 text-emerald-700 text-[16px] font-semibold hover:bg-emerald-50 transition-colors"
              >
                Done for Today
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
