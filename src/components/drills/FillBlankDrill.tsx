"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TTSButton } from "@/components/ui/TTSButton";
import {
  CheckCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { drillAPI } from "@/lib/api";
import { completeWeeklyChallengeItem } from "@/lib/challenges/weekly-challenge-client";
import type { WeeklyChallengeMeta } from "./DrillPracticeInterface";
import { DrillCompletionScreen, DrillLayout, DrillProgress } from "./shared";
import { trackActivity } from "@/utils/activity-cache";
interface FillBlankDrillProps {
  drill: any;
  assignmentId?: string;
  weeklyChallengeMeta?: WeeklyChallengeMeta;
}

const PASS_THRESHOLD = 70;

export default function FillBlankDrill({
  drill,
  assignmentId,
  weeklyChallengeMeta,
}: FillBlankDrillProps) {
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Record<number, string>>>({});
  const [submittedResults, setSubmittedResults] = useState<{
    score: number;
    passed: boolean;
  } | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(Date.now());

  const items = drill.fill_blank_items || [];
  const currentItem = items[currentIndex];

  // Parse sentence to extract blank positions
  const parseSentence = (sentence: string) => {
    const parts = sentence.split(/(___)/g);
    const blanks: number[] = [];
    parts.forEach((part, idx) => {
      if (part === "___") {
        blanks.push(Math.floor(idx / 2)); // Position in blank array
      }
    });
    return { parts, blanks };
  };

  // Render sentence with blanks
  const renderSentence = (
    item: any,
    showAnswers: boolean = false,
    itemIndex?: number,
  ) => {
    const sentenceIdx = itemIndex ?? currentIndex;
    const { parts } = parseSentence(item.sentence);
    let blankIndex = 0;

    return (
      <span className="text-lg leading-relaxed">
        {parts.map((part: string, partIdx: number) => {
          if (part === "___") {
            const blank = item.blanks[blankIndex];
            const currentAnswer = answers[sentenceIdx]?.[blankIndex] || "";
            const isCorrect =
              showAnswers && currentAnswer === blank.correctAnswer;
            blankIndex++;

            return (
              <span key={partIdx} className="inline-block mx-1">
                {showAnswers ? (
                  <span
                    className={`px-3 py-1.5 rounded border-2 font-medium ${
                      isCorrect
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-900 dark:text-emerald-200"
                        : "bg-red-100 border-red-500 text-red-800"
                    }`}
                  >
                    {currentAnswer || "___"}
                    {showAnswers && (
                      <span className="ml-2 text-xs">
                        {isCorrect ? (
                          <CheckCircle className="w-4 h-4 inline" />
                        ) : (
                          `✗ (${blank.correctAnswer})`
                        )}
                      </span>
                    )}
                  </span>
                ) : (
                  <select
                    value={currentAnswer}
                    onChange={(e) => {
                      setAnswers({
                        ...answers,
                        [sentenceIdx]: {
                          ...answers[sentenceIdx],
                          [blankIndex - 1]: e.target.value,
                        },
                      });
                    }}
                    className="px-3 py-1.5 border-2 border-blue-500 rounded bg-card min-w-[120px] text-base focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="">Select...</option>
                    {blank.options
                      .filter((opt: string) => opt.trim() !== "")
                      .map((option: string, optIdx: number) => (
                        <option key={optIdx} value={option}>
                          {option}
                        </option>
                      ))}
                  </select>
                )}
              </span>
            );
          }
          return <span key={partIdx}>{part}</span>;
        })}
      </span>
    );
  };

  const handleNext = () => {
    // Check if all blanks are filled
    const allFilled = currentItem.blanks.every(
      (_: any, blankIdx: number) => {
        return answers[currentIndex]?.[blankIdx];
      }
    );

    if (!allFilled) {
      toast.error("Please fill all blanks before proceeding");
      return;
    }

    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const allItemsComplete = items.every((item: any, itemIdx: number) => {
    return item.blanks.every((_: any, blankIdx: number) => {
      return answers[itemIdx]?.[blankIdx];
    });
  });

  const buildFillBlankResults = () => {
    const fillBlankResults = {
      items: items.map((item: any, itemIdx: number) => ({
        sentence: item.sentence,
        blanks: item.blanks.map((blank: any, blankIdx: number) => {
          const selectedAnswer = answers[itemIdx]?.[blankIdx] || "";
          const isCorrect = selectedAnswer === blank.correctAnswer;
          return {
            position: blank.position,
            selectedAnswer,
            correctAnswer: blank.correctAnswer,
            isCorrect,
          };
        }),
      })),
    };

    const totalBlanks = fillBlankResults.items.reduce(
      (sum: number, item: any) => sum + item.blanks.length,
      0,
    );
    const correctBlanks = fillBlankResults.items.reduce(
      (sum: number, item: any) =>
        sum + item.blanks.filter((b: any) => b.isCorrect).length,
      0,
    );
    const score =
      totalBlanks > 0 ? Math.round((correctBlanks / totalBlanks) * 100) : 0;

    return { fillBlankResults, totalBlanks, correctBlanks, score };
  };

  const handleRetry = () => {
    setSubmittedResults(null);
    setAnswers({});
    setCurrentIndex(0);
  };

  const handleSubmit = async () => {
    if (!assignmentId && !weeklyChallengeMeta) {
      toast.error("Assignment ID is missing. Cannot submit drill.");
      return;
    }

    if (!allItemsComplete) {
      toast.error("Please fill all blanks before submitting");
      return;
    }

    setIsSubmitting(true);
    try {
      const { fillBlankResults, totalBlanks, correctBlanks, score } =
        buildFillBlankResults();
      const passed = score >= PASS_THRESHOLD;

      if (passed) {
        if (weeklyChallengeMeta) {
          await completeWeeklyChallengeItem(
            queryClient,
            weeklyChallengeMeta.itemIndex,
            { score },
          );
        } else {
          await drillAPI.complete(drill._id, {
            drillAssignmentId: assignmentId!,
            score,
            timeSpent: Math.floor((Date.now() - startTime) / 1000),
            fillBlankResults: {
              ...fillBlankResults,
              totalBlanks,
              correctBlanks,
              score,
            },
            platform: "web",
          });
        }

        trackActivity("drill", drill._id, "completed", {
          title: drill.title,
          type: drill.type,
          score,
        });
        toast.success("Drill passed! Great job!");
      } else {
        toast.error(
          `Score: ${score}%. You need at least ${PASS_THRESHOLD}% to pass. Try again!`,
        );
      }

      setSubmittedResults({ score, passed });
    } catch (error: any) {
      toast.error("Failed to submit drill: " + (error.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCompleted) {
    return <DrillCompletionScreen drillType="fill_blank" />;
  }

  const currentItemComplete = currentItem?.blanks.every(
    (_: any, blankIdx: number) => {
      return answers[currentIndex]?.[blankIdx];
    }
  );

  return (
    <DrillLayout title={drill.title} showBack={true}>
      <div className="max-w-md md:max-w-2xl mx-auto px-4 md:px-8 py-6">
        <DrillProgress
          current={currentIndex + 1}
          total={items.length}
          label="sentences"
        />

        {submittedResults !== null ? (
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-2">Your Results</h2>
            <p
              className={`text-2xl font-bold mb-2 ${
                submittedResults.passed ? "text-emerald-600" : "text-red-600"
              }`}
            >
              Score: {submittedResults.score}%
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              {submittedResults.passed
                ? "You passed this drill!"
                : `You need at least ${PASS_THRESHOLD}% to complete this drill.`}
            </p>
            <div className="space-y-6 mb-6">
              {items.map((item: any, itemIdx: number) => {
                const itemAnswers = item.blanks.map(
                  (blank: any, blankIdx: number) => {
                    const selected = answers[itemIdx]?.[blankIdx] || "";
                    return {
                      selected,
                      correct: blank.correctAnswer,
                      isCorrect: selected === blank.correctAnswer,
                    };
                  }
                );
                const itemScore = Math.round(
                  (itemAnswers.filter((a: any) => a.isCorrect).length /
                    itemAnswers.length) *
                    100
                );

                return (
                  <div key={itemIdx} className="p-4 bg-muted rounded-lg">
                    <div className="mb-2">
                      {renderSentence(item, true, itemIdx)}
                    </div>
                    <div className="mt-3 text-sm">
                      <span
                        className={`font-semibold ${
                          itemScore === 100
                            ? "text-green-600"
                            : itemScore >= 50
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        Score: {itemScore}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {submittedResults.passed ? (
              <Button onClick={() => setIsCompleted(true)} className="w-full">
                Continue
              </Button>
            ) : (
              <Button onClick={handleRetry} className="w-full">
                <RotateCcw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            )}
          </Card>
        ) : (
          // Practice Screen
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-bold">
                Sentence {currentIndex + 1} of {items.length}
              </h2>
              {currentItem.audioUrl && (
                <TTSButton
                  text={currentItem.sentence}
                  audioUrl={currentItem.audioUrl}
                />
              )}
            </div>

            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              {renderSentence(currentItem, false)}
            </div>

            {/* Hints */}
            {currentItem.blanks.some((b: any) => b.hint) && (
              <div className="mb-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/25">
                <p className="text-sm font-semibold mb-2 text-foreground">
                  💡 Hints:
                </p>
                {currentItem.blanks.map((blank: any, blankIdx: number) => (
                  blank.hint && (
                    <p key={blankIdx} className="text-sm text-foreground mb-1">
                      Blank {blankIdx + 1}: {blank.hint}
                    </p>
                  )
                ))}
              </div>
            )}

            <div className="flex gap-4 mt-6">
              <Button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                variant="outline"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              {currentIndex === items.length - 1 ? (
                <Button
                  onClick={handleSubmit}
                  disabled={!currentItemComplete || !allItemsComplete || isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit"
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={!currentItemComplete}
                  className="flex-1"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
    </DrillLayout>
  );
}


