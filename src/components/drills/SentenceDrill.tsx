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
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { completeLearnerDrill } from "@/lib/drill/complete-learner-drill";
import { DrillCompletionScreen, DrillLayout } from "./shared";
import { trackActivity } from "@/utils/activity-cache";
import { BookmarkButton } from "@/components/common/BookmarkButton";

interface SentenceDrillProps {
  drill: any;
  assignmentId?: string;
}

interface WordItem {
  word: string;
  hint?: string;
  audioUrl?: string;
}

interface WordAnswer {
  definition: string;
  sentence1: string;
  sentence2: string;
}

// Helper to extract all words from drill data
function getWordItems(drill: any): WordItem[] {
  // For 'sentence_writing' type drills - use sentence_writing_items array
  if (drill.sentence_writing_items && drill.sentence_writing_items.length > 0) {
    return drill.sentence_writing_items.map((item: any) => ({
      word: item.word || "",
      hint: item.hint || undefined,
      audioUrl: item.audioUrl || undefined,
    }));
  }

  // For 'sentence' type drills - use sentence_drill_word (single word)
  if (drill.sentence_drill_word) {
    return [
      {
        word: drill.sentence_drill_word,
        hint: undefined,
        audioUrl: drill.sentence_drill_audio_url || undefined,
      },
    ];
  }

  // Fallback: check target_sentences
  if (drill.target_sentences && drill.target_sentences.length > 0) {
    return drill.target_sentences
      .filter((item: any) => item.word)
      .map((item: any) => ({
        word: item.word,
        hint: undefined,
      }));
  }

  return [];
}

export default function SentenceDrill({
  drill,
  assignmentId,
}: SentenceDrillProps) {
  const queryClient = useQueryClient();
  const wordItems = useMemo(() => getWordItems(drill), [drill]);
  const totalWords = wordItems.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, WordAnswer>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [startTime] = useState(Date.now());
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollToTopAfterNextRef = useRef(false);

  const currentWord = wordItems[currentIndex];
  const currentAnswer = answers[currentIndex] || {
    definition: "",
    sentence1: "",
    sentence2: "",
  };

  const isFirstWord = currentIndex === 0;
  const isLastWord = currentIndex === totalWords - 1;

  // Check if current word has all fields filled
  const isCurrentWordComplete =
    currentAnswer.definition.trim().length > 0 &&
    currentAnswer.sentence1.trim().length > 0 &&
    currentAnswer.sentence2.trim().length > 0;

  // Check if all words are complete
  const allWordsComplete = useMemo(() => {
    return wordItems.every((_, idx) => {
      const answer = answers[idx];
      return (
        answer &&
        answer.definition.trim().length > 0 &&
        answer.sentence1.trim().length > 0 &&
        answer.sentence2.trim().length > 0
      );
    });
  }, [wordItems, answers]);

  useEffect(() => {
    if (!scrollToTopAfterNextRef.current) return;
    scrollToTopAfterNextRef.current = false;
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentIndex]);

  const updateCurrentAnswer = (field: keyof WordAnswer, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentIndex]: {
        ...currentAnswer,
        [field]: value,
      },
    }));
  };

  const handlePrevious = () => {
    if (!isFirstWord) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  /** Next step, or submit when on the last word (same validation as before). */
  const handlePrimaryAction = async () => {
    if (!isCurrentWordComplete) {
      toast.error("Please fill in all fields before proceeding.");
      return;
    }
    if (isLastWord) {
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

    if (!allWordsComplete) {
      toast.error("Please complete all words before submitting.");
      // Find first incomplete word
      const firstIncomplete = wordItems.findIndex((_, idx) => {
        const answer = answers[idx];
        return (
          !answer ||
          answer.definition.trim().length === 0 ||
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

      // Build sentence results for all words
      const sentenceResults = {
        words: wordItems.map((item, idx) => ({
          word: item.word,
          definition: answers[idx]?.definition.trim() || "",
          sentences: [
            { text: answers[idx]?.sentence1.trim() || "", index: 0 },
            { text: answers[idx]?.sentence2.trim() || "", index: 1 },
          ],
        })),
        // Keep backwards compatibility - use first word for legacy format
        word: wordItems[0]?.word || "",
        definition: answers[0]?.definition.trim() || "",
        sentences: [
          { text: answers[0]?.sentence1.trim() || "", index: 0 },
          { text: answers[0]?.sentence2.trim() || "", index: 1 },
        ],
        reviewStatus: "pending",
      };

      await completeLearnerDrill(queryClient, drill._id, {
        drillAssignmentId: assignmentId,
        score: 0, // Score will be calculated after review
        timeSpent,
        sentenceResults,
        platform: "web",
      });

      setIsCompleted(true);
      toast.success("Drill submitted! Your submission is pending review.");

      // Track activity locally (no API call)
      trackActivity("drill", drill._id, "completed", {
        title: drill.title,
        type: drill.type,
      });
    } catch (error: any) {
      toast.error(
        "Failed to submit drill: " + (error.message || "Unknown error"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCompleted) {
    return (
      <DrillCompletionScreen
        title="Drill Submitted"
        message="Your submission has been sent for review. You'll be notified when your sentences have been reviewed."
        drillType="sentence"
      />
    );
  }

  if (totalWords === 0) {
    return (
      <DrillLayout title={drill.title}>
        <Card className="mb-4">
          <div className="flex flex-col items-center gap-3 text-amber-600 py-8">
            <AlertCircle className="w-12 h-12" />
            <p className="text-lg font-medium">No words found</p>
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
          className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain space-y-4 pb-8"
        >
      {/* Context */}
      {drill.context && (
        <Card className="mb-0">
          <p className="text-sm text-foreground">{drill.context}</p>
        </Card>
      )}

      {/* Target Word Card */}
      <Card className="mb-0">
        <div className="text-center py-6">
          {currentWord?.word ? (
            <>
              <div className="flex items-center justify-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                  {currentWord.word}
                </h1>
                <TTSButton text={currentWord.word} size="lg" audioUrl={currentWord.audioUrl} />
                <BookmarkButton
                  itemId={currentWord.word}
                  itemType="word"
                  content={currentWord.word}
                  context={currentWord.hint}
                  sourceDrillId={drill._id}
                />
              </div>
              {currentWord.hint && (
                <p className="text-sm text-blue-600 mt-2 bg-blue-50 px-4 py-2 rounded-lg inline-block">
                  💡 Hint: {currentWord.hint}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-3">
                Provide definition and two sentences
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 text-amber-600">
              <AlertCircle className="w-12 h-12" />
              <p className="text-lg font-medium">No target word found</p>
              <p className="text-sm text-muted-foreground">
                This drill may not be configured correctly. Please contact your
                tutor.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Definition Section */}
      <Card className="mb-0">
        <div className="mb-4">
          <label className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-muted-foreground" />
            Definition:
          </label>
          <Textarea
            className="w-full p-4 border border-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all min-h-[100px] resize-none bg-background text-foreground"
            placeholder="Enter the definition of the word..."
            value={currentAnswer.definition}
            onChange={(e) => updateCurrentAnswer("definition", e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {currentAnswer.definition.length} characters
          </p>
        </div>
      </Card>

      {/* Sentence 1 Section */}
      <Card className="mb-0">
        <div className="mb-4">
          <label className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <PenTool className="w-4 h-4 text-muted-foreground" />
            Sentence 1:
          </label>
          <Textarea
            className="w-full p-4 border border-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all min-h-[100px] resize-none bg-background text-foreground"
            placeholder="Write a sentence using the word..."
            value={currentAnswer.sentence1}
            onChange={(e) => updateCurrentAnswer("sentence1", e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {currentAnswer.sentence1.length} characters
          </p>
        </div>
      </Card>

      {/* Sentence 2 Section */}
      <Card className="mb-0">
        <div className="mb-4">
          <label className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <PenTool className="w-4 h-4 text-muted-foreground" />
            Sentence 2:
          </label>
          <Textarea
            className="w-full p-4 border border-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all min-h-[100px] resize-none bg-background text-foreground"
            placeholder="Write another sentence using the word..."
            value={currentAnswer.sentence2}
            onChange={(e) => updateCurrentAnswer("sentence2", e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {currentAnswer.sentence2.length} characters
          </p>
        </div>
      </Card>
        </div>

        {/* Fixed bottom navigation (assigned sentence / writing drill) */}
        <div className="shrink-0 -mx-4 px-4 md:-mx-8 md:px-8 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))] border-t border-border/90 bg-background/95 backdrop-blur-md shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
          <div className="relative flex min-h-12 items-center justify-between gap-2 sm:gap-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handlePrevious}
              disabled={isFirstWord || isSubmitting}
              className="z-10 min-h-12 shrink-0 px-4 sm:px-6"
            >
              <ChevronLeft className="w-5 h-5 shrink-0 sm:mr-1" />
              <span>Previous</span>
            </Button>
            <p className="pointer-events-none absolute left-1/2 top-1/2 z-0 max-w-[40%] -translate-x-1/2 -translate-y-1/2 text-center text-[11px] font-medium leading-tight text-muted-foreground tabular-nums sm:max-w-none sm:text-sm">
              Word {currentIndex + 1} of {totalWords}
            </p>
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={() => void handlePrimaryAction()}
              disabled={!isCurrentWordComplete || isSubmitting}
              className="z-10 min-h-12 min-w-[6.5rem] shrink-0 px-4 sm:min-w-[9rem] sm:px-6"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin sm:mr-2" />
                  <span className="hidden sm:inline">Submitting…</span>
                </>
              ) : isLastWord ? (
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
