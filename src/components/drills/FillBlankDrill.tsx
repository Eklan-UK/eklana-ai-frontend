"use client";

import { useState, useEffect } from "react";
import { useDrillScoreCelebration } from "@/hooks/useDrillScoreCelebration";
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
import { completeLearnerDrill } from "@/lib/drill/complete-learner-drill";
import { completeWeeklyChallengeItem } from "@/lib/challenges/weekly-challenge-client";
import type { WeeklyChallengeMeta } from "./DrillPracticeInterface";
import { DrillCompletionScreen, DrillLayout, DrillProgress, CheckpointScreen } from "./shared";
import {
  loadCheckpoint,
  saveCheckpoint,
  clearCheckpoint,
} from "@/lib/drill/drill-checkpoint";
import { useLocalDrillProgress } from "@/hooks/useLocalDrillProgress";
import { weeklyChallengeAPI } from "@/lib/api";
import { trackActivity } from "@/utils/activity-cache";
import { DrillBookmarkToggle } from "@/components/drills/DrillBookmarkToggle";
import { playPracticeFeedback, playPerfectItemCelebration } from "@/lib/practice-feedback";

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
  const localProgress = useLocalDrillProgress({
    drillId: String(drill._id),
    drillType: "fill_blank",
    assignmentId,
    weeklyChallengeMeta,
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Record<number, string>>>({});
  const [submittedResults, setSubmittedResults] = useState<{
    score: number;
    passed: boolean;
  } | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(Date.now());
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const [checkpointCount, setCheckpointCount] = useState(0);
  const [isLoadingCheckpoint, setIsLoadingCheckpoint] = useState(true);

  useEffect(() => {
    if (!localProgress.isReady) return;

    let cancelled = false;
    setIsLoadingCheckpoint(true);
    setShowCheckpoint(false);

    const applyPartial = (
      resumeFromIndex: number,
      completedCount: number,
      partial: Record<string, unknown>,
    ) => {
      setCurrentIndex(resumeFromIndex);
      if (partial.answers) {
        setAnswers(partial.answers as Record<number, Record<number, string>>);
      }
      if (typeof partial.submittedCount === "number") {
        setSubmittedCount(partial.submittedCount as number);
      } else {
        setSubmittedCount(completedCount);
      }
      setCheckpointCount(completedCount);
    };

    const local = localProgress.hydrate();
    if (local) {
      applyPartial(local.resumeFromIndex, local.completedItemCount, local.partialResults);
      setIsLoadingCheckpoint(false);
      return;
    }

    if (!assignmentId && !weeklyChallengeMeta) {
      setIsLoadingCheckpoint(false);
      return;
    }

    if (weeklyChallengeMeta) {
      weeklyChallengeAPI
        .getCheckpoint(weeklyChallengeMeta.weekStartDate, weeklyChallengeMeta.itemIndex)
        .then((res) => {
          if (cancelled) return;
          const cp = res.data?.checkpoint as Record<string, unknown> | null;
          if (cp) {
            applyPartial(
              typeof cp.resumeFromIndex === "number" ? cp.resumeFromIndex : 0,
              typeof cp.completedCount === "number" ? cp.completedCount : 0,
              (cp.partialResults as Record<string, unknown>) ?? {},
            );
          }
          setIsLoadingCheckpoint(false);
        })
        .catch(() => { if (!cancelled) setIsLoadingCheckpoint(false); });
    } else {
      loadCheckpoint(String(drill._id), assignmentId!).then((cp) => {
        if (cancelled) return;
        if (cp) {
          applyPartial(cp.resumeFromIndex, cp.completedItemCount, cp.partialResults);
        }
        setIsLoadingCheckpoint(false);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [localProgress.isReady, assignmentId, drill._id, weeklyChallengeMeta]);

  const items = drill.fill_blank_items || [];
  const currentItem = items[currentIndex];

  useDrillScoreCelebration(
    submittedResults === null ? null : submittedResults.passed,
    undefined,
    submittedResults?.score,
  );

  // Parse sentence to extract blank positions
  const parseSentence = (sentence: string) => {
    // Collapse any run of 2+ underscores into exactly "___" so a long run
    // doesn't produce multiple blank slots from a single placeholder.
    const normalized = sentence.replace(/_{2,}/g, '___');
    const parts = normalized.split(/(___)/g);
    const blanks: number[] = [];
    parts.forEach((part, idx) => {
      if (part === "___") {
        blanks.push(Math.floor(idx / 2));
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
    if (!item) return null;
    const sentenceIdx = itemIndex ?? currentIndex;
    const { parts } = parseSentence(item.sentence || "");
    let blankIndex = 0;

    return (
      <span className="text-lg leading-relaxed">
        {parts.map((part: string, partIdx: number) => {
          if (part === "___") {
            const currentBlankIdx = blankIndex;
            const blank = (item.blanks || [])[currentBlankIdx];
            const currentAnswer = answers[sentenceIdx]?.[currentBlankIdx] || "";
            const isCorrect =
              showAnswers && currentAnswer === (blank?.correctAnswer || "");
            blankIndex++;

            if (!blank) {
              return (
                <span key={partIdx} className="inline-block mx-1">
                  <select disabled className="px-3 py-1.5 border-2 border-muted rounded bg-card min-w-[120px] text-base opacity-40">
                    <option>Select...</option>
                  </select>
                </span>
              );
            }

            return (
              <span key={partIdx} className="inline-block mx-1">
                {showAnswers ? (
                  <span
                    className={`px-3 py-1.5 rounded border-2 font-medium ${
                      isCorrect
                        ? "bg-emerald-500/15 border-emerald-500 text-gray-900 dark:text-foreground"
                        : "bg-red-100 border-red-500 text-red-800"
                    }`}
                  >
                    {currentAnswer || "___"}
                    {showAnswers && (
                      <span className="ml-2 text-xs">
                        {isCorrect ? (
                          <CheckCircle className="w-4 h-4 inline" />
                        ) : (
                          `✗ (${blank.correctAnswer || ""})`
                        )}
                      </span>
                    )}
                  </span>
                ) : (
                  <select
                    value={currentAnswer}
                    disabled={sentenceIdx < submittedCount}
                    onChange={(e) => {
                      if (sentenceIdx < submittedCount) return;
                      const value = e.target.value;
                      setAnswers({
                        ...answers,
                        [sentenceIdx]: {
                          ...answers[sentenceIdx],
                          [currentBlankIdx]: value,
                        },
                      });
                      if (value) {
                        if (value === (blank.correctAnswer || "")) {
                          playPerfectItemCelebration();
                        } else {
                          playPracticeFeedback("failure");
                        }
                      }
                    }}
                    className="px-3 py-1.5 border-2 border-blue-500 rounded bg-card min-w-[120px] text-base focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-80 disabled:bg-muted/40"
                  >
                    <option value="">Select...</option>
                    {(blank.options || [])
                      .filter((opt: string) => opt && opt.trim() !== "")
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

    const newSubmittedCount = Math.max(submittedCount, currentIndex + 1);
    setSubmittedCount(newSubmittedCount);

    localProgress.persist({
      resumeFromIndex: currentIndex < items.length - 1 ? currentIndex + 1 : currentIndex,
      completedItemCount: newSubmittedCount,
      partialResults: { answers, submittedCount: newSubmittedCount },
      startedAt: new Date(startTime).toISOString(),
    });

    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);

      if (newSubmittedCount % 5 === 0) {
        if (assignmentId) {
          void saveCheckpoint(String(drill._id), {
            assignmentId,
            drillType: "fill_blank",
            resumeFromIndex: currentIndex + 1,
            completedItemCount: newSubmittedCount,
            partialResults: { answers, submittedCount: newSubmittedCount },
            startedAt: new Date(startTime),
          });
          setCheckpointCount(newSubmittedCount);
          setShowCheckpoint(true);
        } else if (weeklyChallengeMeta) {
          void weeklyChallengeAPI.saveCheckpoint(
            weeklyChallengeMeta.weekStartDate,
            weeklyChallengeMeta.itemIndex,
            {
              drillType: "fill_blank",
              resumeFromIndex: currentIndex + 1,
              completedCount: newSubmittedCount,
              partialResults: { answers, submittedCount: newSubmittedCount },
            },
          );
          setCheckpointCount(newSubmittedCount);
          setShowCheckpoint(true);
        }
      }
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
    if (assignmentId) void clearCheckpoint(String(drill._id), assignmentId);
    else if (weeklyChallengeMeta) void weeklyChallengeAPI.clearCheckpoint(weeklyChallengeMeta.weekStartDate, weeklyChallengeMeta.itemIndex);
    localProgress.clear();
    setSubmittedResults(null);
    setAnswers({});
    setCurrentIndex(0);
    setSubmittedCount(0);
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
      setSubmittedCount(items.length);
      const { fillBlankResults, totalBlanks, correctBlanks, score } =
        buildFillBlankResults();
      const passed = score >= PASS_THRESHOLD;

      if (weeklyChallengeMeta) {
        await completeWeeklyChallengeItem(
          queryClient,
          weeklyChallengeMeta.itemId,
          {
            score,
            weekStartDate: weeklyChallengeMeta.weekStartDate,
          },
        );
        void weeklyChallengeAPI.clearCheckpoint(weeklyChallengeMeta.weekStartDate, weeklyChallengeMeta.itemIndex);
        localProgress.clear();
        trackActivity("drill", drill._id, "completed", {
          title: drill.title,
          type: drill.type,
          score,
        });
      } else {
        await completeLearnerDrill(queryClient, drill._id, {
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
        void clearCheckpoint(String(drill._id), assignmentId!);
        localProgress.clear();
        trackActivity("drill", drill._id, "completed", {
          title: drill.title,
          type: drill.type,
          score,
        });
      }

      if (passed) {
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

  if (isLoadingCheckpoint) {
    return (
      <DrillLayout title={drill.title} showBack={true} headerRight={<DrillBookmarkToggle drillId={String(drill._id)} />}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DrillLayout>
    );
  }

  if (showCheckpoint) {
    return (
      <CheckpointScreen
        completedCount={checkpointCount}
        totalCount={items.length}
        drillTitle={drill.title}
        onContinue={() => setShowCheckpoint(false)}
        onExit={() => {
          window.location.href = weeklyChallengeMeta
            ? `/account/practice/weekly-challenge/${weeklyChallengeMeta.weekStartDate}`
            : "/account/drills";
        }}
      />
    );
  }

  if (isCompleted) {
    const returnPath = weeklyChallengeMeta
      ? `/account/practice/weekly-challenge/${encodeURIComponent(weeklyChallengeMeta.weekStartDate)}`
      : "/account/drills";
    return (
      <DrillCompletionScreen
        drillType={weeklyChallengeMeta ? "Vocabulary" : "fill_blank"}
        returnPath={returnPath}
        returnLabel={weeklyChallengeMeta ? "Back to Challenge" : "Back to My Plan"}
        celebrate={false}
      />
    );
  }

  const currentItemComplete = currentItem?.blanks.every(
    (_: any, blankIdx: number) => {
      return answers[currentIndex]?.[blankIdx];
    }
  );

  return (
    <DrillLayout
      title={drill.title}
      showBack={true}
      headerRight={<DrillBookmarkToggle drillId={String(drill._id)} />}
    >
      <div className="max-w-md md:max-w-2xl mx-auto px-4 md:px-8 py-6">
        <DrillProgress
          current={submittedCount}
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
                const itemScore =
                  itemAnswers.length === 0
                    ? 0
                    : Math.round(
                        (itemAnswers.filter((a: any) => a.isCorrect).length /
                          itemAnswers.length) *
                          100
                      );

                return (
                  <div key={itemIdx} className="p-4 bg-muted rounded-lg">
                    {item.context?.trim() && (
                      <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                        {item.context}
                      </p>
                    )}
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
            {!currentItem ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No items found.</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-xl font-bold">
                    Sentence {currentIndex + 1} of {items.length}
                  </h2>
                  <div className="flex items-center gap-1 shrink-0">
                    <TTSButton
                      text={currentItem.sentence}
                      audioUrl={currentItem.audioUrl}
                    />
                    <DrillBookmarkToggle drillId={String(drill._id)} />
                  </div>
                </div>

                {currentItem.context?.trim() && (
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {currentItem.context}
                  </p>
                )}

                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  {renderSentence(currentItem, false)}
                </div>

                {/* Hints */}
                {currentItem.blanks?.some((b: any) => b.hint) && (
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
              </>
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
