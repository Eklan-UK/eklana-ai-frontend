"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader2, Sparkles, TrendingUp, Lightbulb, MessageCircle } from "lucide-react";
import type { SessionSummaryPayload } from "@/types/ai-session-summary";

export type SessionReviewPhase = "loading" | "done" | "error" | "skipped";

interface SessionReviewModalProps {
  open: boolean;
  phase: SessionReviewPhase;
  summary: SessionSummaryPayload | null;
  errorMessage?: string;
  skipMessage?: string;
  /** Label for the main dismiss button (e.g. home vs practice hub). */
  primaryCtaLabel?: string;
  onBackToHome: () => void;
  /** Outline action: close modal and continue the session (aborts in-flight summary fetch when loading). */
  onStayInSession?: () => void;
  secondaryCtaLabel?: string;
}

export function SessionReviewModal({
  open,
  phase,
  summary,
  errorMessage,
  skipMessage,
  primaryCtaLabel = "Back to Home",
  onBackToHome,
  onStayInSession,
  secondaryCtaLabel = "Stay in session",
}: SessionReviewModalProps) {
  if (!open) return null;

  const showStay = Boolean(onStayInSession);

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const score = summary?.overallScore ?? 0;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card text-foreground shadow-xl">
        {phase === "loading" && (
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <h2 className="text-lg font-bold font-nunito text-foreground mb-2">
              Analyzing your conversation…
            </h2>
            <p className="text-sm font-satoshi text-muted-foreground mb-6">
              Generating personalized feedback on grammar, vocabulary, and flow.
            </p>
            <div className="flex flex-col gap-3 w-full">
              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                onClick={onBackToHome}
              >
                Skip summary · {primaryCtaLabel}
              </Button>
              {showStay && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  fullWidth
                  onClick={onStayInSession}
                >
                  {secondaryCtaLabel}
                </Button>
              )}
            </div>
          </div>
        )}

        {phase === "skipped" && (
          <div className="p-8">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 bg-primary/20 rounded-full flex items-center justify-center mb-3">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-lg font-bold font-nunito text-foreground">
                Thanks for stopping by
              </h2>
              <p className="text-sm font-satoshi text-text-secondary mt-2">
                {skipMessage ||
                  "Chat a bit longer next time to get a full AI summary of your English."}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button type="button" variant="primary" size="lg" fullWidth onClick={onBackToHome}>
                {primaryCtaLabel}
              </Button>
              {showStay && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  fullWidth
                  onClick={onStayInSession}
                >
                  {secondaryCtaLabel}
                </Button>
              )}
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="p-8">
            <h2 className="text-lg font-bold font-nunito text-foreground mb-2">
              Couldn&apos;t load summary
            </h2>
            <p className="text-sm font-satoshi text-text-secondary mb-6">
              {errorMessage || "Something went wrong. You can still head home."}
            </p>
            <div className="flex flex-col gap-3">
              <Button type="button" variant="primary" size="lg" fullWidth onClick={onBackToHome}>
                {primaryCtaLabel}
              </Button>
              {showStay && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  fullWidth
                  onClick={onStayInSession}
                >
                  {secondaryCtaLabel}
                </Button>
              )}
            </div>
          </div>
        )}

        {phase === "done" && summary && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold font-nunito text-foreground">
                Session review
              </h2>
            </div>

            <Card className="!p-5 border-border">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <TrendingUp className="w-6 h-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold font-satoshi text-foreground">
                      Overall
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      Based on this chat
                    </p>
                  </div>
                </div>
                <div className="relative w-14 h-14 flex-shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                    <circle
                      cx="32"
                      cy="32"
                      r={radius}
                      stroke="var(--color-muted)"
                      strokeWidth="5"
                      fill="none"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r={radius}
                      stroke="var(--color-primary)"
                      strokeWidth="5"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-extrabold font-nunito text-foreground">
                      {Math.round(score)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <p className="text-center text-base font-semibold font-nunito text-primary-dark bg-primary/10/80 rounded-xl px-4 py-3 border border-border">
              {summary.encouragement}
            </p>

            <div className="grid gap-3">
              <Card className="!p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Grammar
                </p>
                <p className="text-sm font-semibold text-foreground">{summary.grammar.headline}</p>
                {summary.grammar.detail && (
                  <p className="text-sm text-text-secondary mt-1">{summary.grammar.detail}</p>
                )}
              </Card>
              <Card className="!p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Vocabulary
                </p>
                <p className="text-sm font-semibold text-foreground">{summary.vocabulary.headline}</p>
                {summary.vocabulary.detail && (
                  <p className="text-sm text-text-secondary mt-1">{summary.vocabulary.detail}</p>
                )}
              </Card>
              <Card className="!p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Flow
                </p>
                <p className="text-sm font-semibold text-foreground">{summary.flow.headline}</p>
                {summary.flow.detail && (
                  <p className="text-sm text-text-secondary mt-1">{summary.flow.detail}</p>
                )}
              </Card>
            </div>

            {summary.strengths.length > 0 && (
              <Card className="!p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-bold font-satoshi text-foreground">Strengths</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-sm text-text-secondary">
                  {summary.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </Card>
            )}

            {summary.tips.length > 0 && (
              <Card className="!p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-amber-700" />
                  <span className="text-sm font-bold font-satoshi text-foreground">Tips</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-sm text-text-secondary">
                  {summary.tips.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </Card>
            )}

            <div className="flex flex-col gap-3 mt-2">
              <Button type="button" variant="primary" size="lg" fullWidth onClick={onBackToHome}>
                {primaryCtaLabel}
              </Button>
              {showStay && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  fullWidth
                  onClick={onStayInSession}
                >
                  {secondaryCtaLabel}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
