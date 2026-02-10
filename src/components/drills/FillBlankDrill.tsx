"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TTSButton } from "@/components/ui/TTSButton";
import { CheckCircle, XCircle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { drillAPI } from "@/lib/api";
import { DrillCompletionScreen, DrillLayout, DrillProgress } from "./shared";
import { trackActivity } from "@/utils/activity-cache";
import { BookmarkButton } from "@/components/common/BookmarkButton";

interface FillBlankDrillProps {
  drill: any;
  assignmentId?: string;
}

export default function FillBlankDrill({ drill, assignmentId }: FillBlankDrillProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Record<number, string>>>({});
  const [showResults, setShowResults] = useState(false);
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
  const renderSentence = (item: any, showAnswers: boolean = false) => {
    const { parts } = parseSentence(item.sentence);
    let blankIndex = 0;

    return (
      <span className="text-lg leading-relaxed">
        {parts.map((part: string, idx: number) => {
          if (part === "___") {
            const blank = item.blanks[blankIndex];
            const currentAnswer = answers[currentIndex]?.[blankIndex] || "";
            const isCorrect =
              showAnswers && currentAnswer === blank.correctAnswer;
            blankIndex++;

            return (
              <span key={idx} className="inline-block mx-1">
                {showAnswers ? (
                  <span
                    className={`px-3 py-1.5 rounded border-2 font-medium ${
                      isCorrect
                        ? "bg-green-100 border-green-500 text-green-800"
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
                        [currentIndex]: {
                          ...answers[currentIndex],
                          [blankIndex - 1]: e.target.value,
                        },
                      });
                    }}
                    className="px-3 py-1.5 border-2 border-blue-500 rounded bg-white min-w-[120px] text-base focus:outline-none focus:ring-2 focus:ring-blue-300"
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
          return <span key={idx}>{part}</span>;
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
    } else {
      // All items completed
      setShowResults(true);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (!assignmentId) {
      toast.error("Assignment ID is missing. Cannot submit drill.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Calculate results
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
        0
      );
      const correctBlanks = fillBlankResults.items.reduce(
        (sum: number, item: any) =>
          sum + item.blanks.filter((b: any) => b.isCorrect).length,
        0
      );
      const score = totalBlanks > 0 ? Math.round((correctBlanks / totalBlanks) * 100) : 0;

      await drillAPI.complete(drill._id, {
        drillAssignmentId: assignmentId,
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

      setIsCompleted(true);
      toast.success("Drill completed! Great job!");

      trackActivity("drill", drill._id, "completed", {
        title: drill.title,
        type: drill.type,
        score,
      });

      // Refresh the page to update drill status
      router.refresh();
    } catch (error: any) {
      toast.error("Failed to submit drill: " + (error.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCompleted) {
    return <DrillCompletionScreen drillType="fill_blank" refreshOnMount={true} />;
  }

  const allItemsComplete = items.every((item: any, itemIdx: number) => {
    return item.blanks.every((_: any, blankIdx: number) => {
      return answers[itemIdx]?.[blankIdx];
    });
  });

  const currentItemComplete = currentItem?.blanks.every(
    (_: any, blankIdx: number) => {
      return answers[currentIndex]?.[blankIdx];
    }
  );

  return (
    <DrillLayout title={drill.title} showBack={true}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <DrillProgress
          current={currentIndex + 1}
          total={items.length}
          label="sentences"
        />

        {showResults ? (
          // Results Screen
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Review Your Answers</h2>
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
                  <div key={itemIdx} className="p-4 bg-gray-50 rounded-lg">
                    <div className="mb-2">
                      {renderSentence(item, true)}
                    </div>
                    {item.translation && (
                      <p className="text-sm text-gray-600 italic mt-2">
                        {item.translation}
                      </p>
                    )}
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
            <div className="flex gap-4 mt-6">
              <Button onClick={() => setShowResults(false)} variant="outline">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Go Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Drill"
                )}
              </Button>
            </div>
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
              <div className="mb-2">{renderSentence(currentItem, false)}</div>
              {currentItem.translation && (
                <p className="text-sm text-gray-600 italic mt-3 border-t pt-3">
                  Translation: {currentItem.translation}
                </p>
              )}
            </div>

            {/* Hints */}
            {currentItem.blanks.some((b: any) => b.hint) && (
              <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-sm font-semibold mb-2 text-yellow-800">
                  💡 Hints:
                </p>
                {currentItem.blanks.map((blank: any, blankIdx: number) => (
                  blank.hint && (
                    <p key={blankIdx} className="text-sm text-gray-700 mb-1">
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
              <Button
                onClick={handleNext}
                disabled={!currentItemComplete}
                className="flex-1"
              >
                {currentIndex === items.length - 1 ? "Review" : "Next"}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </Card>
        )}
      </div>
    </DrillLayout>
  );
}


