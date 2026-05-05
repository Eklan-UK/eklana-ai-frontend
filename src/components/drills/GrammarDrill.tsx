"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { TTSButton } from "@/components/ui/TTSButton";
import {
  Loader2,
  BookOpen,
  PenTool,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { drillAPI } from "@/lib/api";
import { DrillCompletionScreen, DrillLayout } from "./shared";
import { trackActivity } from "@/utils/activity-cache";
import { BookmarkButton } from "@/components/common/BookmarkButton";

interface GrammarDrillProps {
  drill: any;
  assignmentId?: string;
}

interface PatternItem {
  pattern: string;
  example: string;
  hint?: string;
  patternAudioUrl?: string;
  exampleAudioUrl?: string;
}

interface PatternAnswer {
  sentence1: string;
  sentence2: string;
}

export default function GrammarDrill({
  drill,
  assignmentId,
}: GrammarDrillProps) {
  const patternItems: PatternItem[] = useMemo(() => {
    return (drill.grammar_items || []).map((item: any) => ({
      pattern: item.pattern || "",
      example: item.example || "",
      hint: item.hint || undefined,
      patternAudioUrl: item.patternAudioUrl || undefined,
      exampleAudioUrl: item.exampleAudioUrl || undefined,
    }));
  }, [drill.grammar_items]);

  const totalPatterns = patternItems.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, PatternAnswer>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [startTime] = useState(Date.now());
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollToTopAfterNextRef = useRef(false);

  const currentPattern = patternItems[currentIndex];
  const currentAnswer = answers[currentIndex] || {
    sentence1: "",
    sentence2: "",
  };

  const isFirstPattern = currentIndex === 0;
  const isLastPattern = currentIndex === totalPatterns - 1;

  // Check if current pattern has both sentences filled
  const isCurrentPatternComplete =
    currentAnswer.sentence1.trim().length > 0 &&
    currentAnswer.sentence2.trim().length > 0;

  // Check if all patterns are complete
  const allPatternsComplete = useMemo(() => {
    return patternItems.every((_, idx) => {
      const answer = answers[idx];
      return (
        answer &&
        answer.sentence1.trim().length > 0 &&
        answer.sentence2.trim().length > 0
      );
    });
  }, [patternItems, answers]);

  useEffect(() => {
    if (!scrollToTopAfterNextRef.current) return;
    scrollToTopAfterNextRef.current = false;
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentIndex]);

  const updateCurrentAnswer = (field: keyof PatternAnswer, value: string) => {
    setAnswers((prev) => {
      const existing = prev[currentIndex] ?? {
        sentence1: "",
        sentence2: "",
      };
      return {
        ...prev,
        [currentIndex]: {
          ...existing,
          [field]: value,
        },
      };
    });
  };

  const handlePrevious = () => {
    if (!isFirstPattern) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  /** Advance to next pattern, or submit on the last pattern. */
  const handlePrimaryAction = async () => {
    if (!isCurrentPatternComplete) {
      toast.error("Please write both sentences before proceeding.");
      return;
    }
    if (isLastPattern) {
      await handleSubmit();
    } else {
      scrollToTopAfterNextRef.current = true;
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSubmit = async () => {
    if (!assignmentId) {
      toast.error("Assignment ID is missing. Cannot submit drill.");
      return;
    }

    if (!allPatternsComplete) {
      toast.error("Please complete all patterns before submitting.");
      // Find first incomplete pattern
      const firstIncomplete = patternItems.findIndex((_, idx) => {
        const answer = answers[idx];
        return (
          !answer ||
          answer.sentence1.trim().length === 0 ||
          answer.sentence2.trim().length === 0
        );
      });
      if (firstIncomplete !== -1) {
        setCurrentIndex(firstIncomplete);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);

      // Build grammar results for submission
      const grammarResults = {
        patterns: patternItems.map((item, idx) => ({
          pattern: item.pattern,
          example: item.example,
          hint: item.hint || "",
          sentences: [
            { text: answers[idx]?.sentence1.trim() || "", index: 0 },
            { text: answers[idx]?.sentence2.trim() || "", index: 1 },
          ],
        })),
        reviewStatus: "pending",
      };

      await drillAPI.complete(drill._id, {
        drillAssignmentId: assignmentId,
        score: 0, // Score will be calculated after review
        timeSpent,
        grammarResults,
        platform: "web",
      });

      setIsCompleted(true);
      toast.success("Drill submitted! Your submission is pending review.");

      // Track activity locally (no API call)
      trackActivity("drill", drill._id, "completed", {
        title: drill.title,
        type: drill.type,
      });

      // Do not call router.refresh() here: it races setIsCompleted and refetches the
      // server page before React commits, remounting GrammarDrill at pattern 0.
      // DrillCompletionScreen uses refreshOnMount to refresh after the completion UI shows.
    } catch (error: any) {
      toast.error(
        "Failed to submit drill: " + (error.message || "Unknown error")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCompleted) {
    return (
      <DrillCompletionScreen
        title="Drill Submitted"
        message="Your grammar sentences have been submitted for review. You'll be notified when your work has been reviewed."
        drillType="grammar"
        returnPath="/account/drills"
        returnLabel="Back to My Plan"
        refreshOnMount={true}
      />
    );
  }

  if (totalPatterns === 0) {
    return (
      <DrillLayout title={drill.title}>
        <Card className="mb-4">
          <div className="flex flex-col items-center gap-3 text-amber-600 py-8">
            <AlertCircle className="w-12 h-12" />
            <p className="text-lg font-medium">No patterns found</p>
            <p className="text-sm text-muted-foreground">
              This drill may not be configured correctly. Please contact your
              tutor.
            </p>
          </div>
        </Card>
      </DrillLayout>
    );
  }

  return (
    <DrillLayout title={drill.title}>
      <div className="flex flex-col h-[calc(100svh-8.75rem)] max-h-[calc(100svh-8.75rem)] md:h-[calc(100svh-9.25rem)] md:max-h-[calc(100svh-9.25rem)] min-h-0 gap-3">
        <div
          ref={scrollAreaRef}
          className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto overscroll-y-contain pb-8 sm:gap-10"
        >
      {/* Context */}
      {drill.context && (
        <Card className="mb-0 w-full shrink-0" padding="lg">
          <p className="text-sm text-foreground leading-relaxed">{drill.context}</p>
        </Card>
      )}

      {/* Pattern Display Card */}
      <Card className="mb-0 w-full shrink-0 bg-gradient-to-r from-primary-500/10 to-pink-500/10 border border-border" padding="lg">
        <div className="text-center py-2 sm:py-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-xs font-semibold mb-3">
            <FileText className="w-3 h-3" />
            Grammar Pattern
          </div>

          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {currentPattern?.pattern}
            </h1>
            <TTSButton
              text={currentPattern?.pattern || ""}
              size="md"
              audioUrl={currentPattern?.patternAudioUrl}
            />
            <BookmarkButton
              itemId={currentPattern?.pattern || ""}
              itemType="sentence"
              content={currentPattern?.pattern || ""}
              context={currentPattern?.hint}
              sourceDrillId={drill._id}
            />
          </div>

          {currentPattern?.hint && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <p className="text-sm text-amber-800 dark:text-amber-200">{currentPattern.hint}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Example Display - Always shown as guide */}
      <Card className="mb-0 w-full shrink-0 bg-emerald-500/10 border-emerald-500/25" padding="lg">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">
              Example (Use this as your guide)
            </p>
            <div className="flex items-center gap-2">
              <p className="text-lg text-foreground font-medium">
                "{currentPattern?.example}"
              </p>
              <TTSButton
                text={currentPattern?.example || ""}
                size="sm"
                audioUrl={currentPattern?.exampleAudioUrl}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Instructions */}
      <Card className="mb-0 w-full shrink-0 bg-sky-500/10 border-sky-500/25" padding="lg">
        <div className="flex items-start gap-2">
          <PenTool className="w-5 h-5 text-sky-600 dark:text-sky-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Your Task</p>
            <p className="text-sm text-muted-foreground">
              Write <strong>two different sentences</strong> using the pattern above.
              Use the example as a guide for how to structure your sentences.
            </p>
          </div>
        </div>
      </Card>

      {/* Sentence 1 Input */}
      <Card className="mb-0 w-full shrink-0" padding="lg">
        <div>
          <label className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-bold">
              1
            </span>
            First Sentence:
          </label>
          <Textarea
            className="w-full p-4 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all min-h-[100px] resize-none"
            placeholder="Write your first sentence using the pattern..."
            value={currentAnswer.sentence1}
            onChange={(e) => updateCurrentAnswer("sentence1", e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {currentAnswer.sentence1.length} characters
          </p>
        </div>
      </Card>

      {/* Sentence 2 Input */}
      <Card className="mb-0 w-full shrink-0" padding="lg">
        <div>
          <label className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-xs font-bold">
              2
            </span>
            Second Sentence:
          </label>
          <Textarea
            className="w-full p-4 border border-border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all min-h-[100px] resize-none"
            placeholder="Write your second sentence using the pattern..."
            value={currentAnswer.sentence2}
            onChange={(e) => updateCurrentAnswer("sentence2", e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {currentAnswer.sentence2.length} characters
          </p>
        </div>
      </Card>
        </div>

        <div className="shrink-0 -mx-4 px-4 md:-mx-8 md:px-8 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))] border-t border-border/90 bg-background/95 backdrop-blur-md shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
          <div className="relative flex min-h-12 items-center justify-between gap-2 sm:gap-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handlePrevious}
              disabled={isFirstPattern || isSubmitting}
              className="z-10 min-h-12 shrink-0 px-4 sm:px-6"
            >
              <ChevronLeft className="w-5 h-5 shrink-0 sm:mr-1" />
              <span>Previous</span>
            </Button>
            <p className="pointer-events-none absolute left-1/2 top-1/2 z-0 max-w-[40%] -translate-x-1/2 -translate-y-1/2 text-center text-[11px] font-medium leading-tight text-muted-foreground tabular-nums sm:max-w-none sm:text-sm">
              Pattern {currentIndex + 1} of {totalPatterns}
            </p>
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={() => void handlePrimaryAction()}
              disabled={!isCurrentPatternComplete || isSubmitting}
              className="z-10 min-h-12 min-w-[6.5rem] shrink-0 px-4 sm:min-w-[9rem] sm:px-6"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin sm:mr-2" />
                  <span className="hidden sm:inline">Submitting…</span>
                </>
              ) : isLastPattern ? (
                <>
                  <span className="sm:hidden">Submit</span>
                  <span className="hidden sm:inline">Submit for Review</span>
                </>
              ) : (
                <>
                  <span>Next</span>
                  <ChevronRight className="ml-1 h-5 w-5 shrink-0" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </DrillLayout>
  );
}
