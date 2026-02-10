"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CheckCircle, XCircle, Loader2, Shuffle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { drillAPI } from "@/lib/api";
import { trackActivity } from "@/utils/activity-cache";
import { BookmarkButton } from "@/components/common/BookmarkButton";

interface MatchingDrillProps {
  drill: any;
  assignmentId?: string;
}

interface MatchPair {
  left: string;
  right: string;
  leftTranslation?: string;
  rightTranslation?: string;
}

interface ShuffledItem {
  id: number; // Original index in pairs array
  text: string;
  translation?: string;
}

export default function MatchingDrill({ drill, assignmentId }: MatchingDrillProps) {
  const router = useRouter();
  const [pairs, setPairs] = useState<MatchPair[]>([]);
  const [leftItems, setLeftItems] = useState<ShuffledItem[]>([]);
  const [rightItems, setRightItems] = useState<ShuffledItem[]>([]);
  const [selectedLeftIndex, setSelectedLeftIndex] = useState<number | null>(null);
  const [selectedRightIndex, setSelectedRightIndex] = useState<number | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set()); // Store as "leftId-rightId"
  const [incorrectAttempts, setIncorrectAttempts] = useState<Set<string>>(new Set()); // Track incorrect attempts
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(Date.now());

  // Shuffle array helper
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Initialize and shuffle both columns
  useEffect(() => {
    const matchingPairs = drill.matching_pairs || [];
    setPairs(matchingPairs);

    // Create shuffled items with original IDs
    const leftShuffled: ShuffledItem[] = shuffleArray(
      matchingPairs.map((p: MatchPair, idx: number) => ({
        id: idx,
        text: p.left,
        translation: p.leftTranslation,
      }))
    );

    const rightShuffled: ShuffledItem[] = shuffleArray(
      matchingPairs.map((p: MatchPair, idx: number) => ({
        id: idx,
        text: p.right,
        translation: p.rightTranslation,
      }))
    );

    setLeftItems(leftShuffled);
    setRightItems(rightShuffled);
    setMatchedPairs(new Set());
    setIncorrectAttempts(new Set());
    setSelectedLeftIndex(null);
    setSelectedRightIndex(null);
  }, [drill.matching_pairs]);

  // Check if item is matched
  const isLeftMatched = (leftIndex: number): boolean => {
    const leftItem = leftItems[leftIndex];
    return Array.from(matchedPairs).some((pairKey) => {
      const [leftId] = pairKey.split("-");
      return leftId === leftItem.id.toString();
    });
  };

  const isRightMatched = (rightIndex: number): boolean => {
    const rightItem = rightItems[rightIndex];
    return Array.from(matchedPairs).some((pairKey) => {
      const [, rightId] = pairKey.split("-");
      return rightId === rightItem.id.toString();
    });
  };

  // Handle left item selection
  const handleLeftClick = (leftIndex: number) => {
    // Don't allow selection if already matched
    if (isLeftMatched(leftIndex)) return;

    // If clicking the same item, deselect it
    if (selectedLeftIndex === leftIndex) {
      setSelectedLeftIndex(null);
      return;
    }

    // Select the left item
    setSelectedLeftIndex(leftIndex);

    // If right item is already selected, try to match
    if (selectedRightIndex !== null) {
      handleMatch(leftIndex, selectedRightIndex);
    }
  };

  // Handle right item selection
  const handleRightClick = (rightIndex: number) => {
    // Don't allow selection if already matched
    if (isRightMatched(rightIndex)) return;

    // If clicking the same item, deselect it
    if (selectedRightIndex === rightIndex) {
      setSelectedRightIndex(null);
      return;
    }

    // Select the right item
    setSelectedRightIndex(rightIndex);

    // If left item is already selected, try to match
    if (selectedLeftIndex !== null) {
      handleMatch(selectedLeftIndex, rightIndex);
    }
  };

  // Handle matching logic
  const handleMatch = (leftIndex: number, rightIndex: number) => {
    const leftItem = leftItems[leftIndex];
    const rightItem = rightItems[rightIndex];

    // Check if this is a correct match (same original ID)
    const isCorrect = leftItem.id === rightItem.id;

    if (isCorrect) {
      // Correct match - lock the pair
      const pairKey = `${leftItem.id}-${rightItem.id}`;
      setMatchedPairs((prev) => new Set([...prev, pairKey]));
      setSelectedLeftIndex(null);
      setSelectedRightIndex(null);
      setIncorrectAttempts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(`${leftIndex}-${rightIndex}`);
        return newSet;
      });

      toast.success("Correct match! ✓");

      // Check if all pairs are matched
      const allMatched = matchedPairs.size + 1 === pairs.length;
      if (allMatched) {
        // Auto-submit after a short delay
        setTimeout(() => {
          handleSubmit();
        }, 1000);
      }
    } else {
      // Incorrect match - show error feedback
      const attemptKey = `${leftIndex}-${rightIndex}`;
      setIncorrectAttempts((prev) => new Set([...prev, attemptKey]));
      setSelectedLeftIndex(null);
      setSelectedRightIndex(null);

      toast.error("Incorrect match. Try again!");

      // Clear error feedback after 1 second
      setTimeout(() => {
        setIncorrectAttempts((prev) => {
          const newSet = new Set(prev);
          newSet.delete(attemptKey);
          return newSet;
        });
      }, 1000);
    }
  };

  // Reset and reshuffle
  const handleReset = () => {
    const matchingPairs = drill.matching_pairs || [];

    const leftShuffled: ShuffledItem[] = shuffleArray(
      matchingPairs.map((p: MatchPair, idx: number) => ({
        id: idx,
        text: p.left,
        translation: p.leftTranslation,
      }))
    );

    const rightShuffled: ShuffledItem[] = shuffleArray(
      matchingPairs.map((p: MatchPair, idx: number) => ({
        id: idx,
        text: p.right,
        translation: p.rightTranslation,
      }))
    );

    setLeftItems(leftShuffled);
    setRightItems(rightShuffled);
    setMatchedPairs(new Set());
    setIncorrectAttempts(new Set());
    setSelectedLeftIndex(null);
    setSelectedRightIndex(null);
    toast.info("Reset! Items shuffled.");
  };

  // Submit drill completion
  const handleSubmit = async () => {
    if (!assignmentId) {
      toast.error("Assignment ID is missing. Cannot submit drill.");
      return;
    }

    const allMatched = matchedPairs.size === pairs.length;
    if (!allMatched) {
      toast.error("Please match all pairs before submitting");
      return;
    }

    setIsSubmitting(true);
    try {
      // All matches are correct (we only allow correct matches to be locked)
      const score = 100;
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);

      // Prepare matching results according to API schema
      const pairsMatched = matchedPairs.size;
      const totalPairs = pairs.length;
      const accuracy = totalPairs > 0 ? (pairsMatched / totalPairs) * 100 : 0;

      await drillAPI.complete(drill._id, {
        drillAssignmentId: assignmentId,
        score,
        timeSpent,
        matchingResults: {
          pairsMatched,
          totalPairs,
          accuracy,
          incorrectPairs: [], // All pairs are correct since we only allow correct matches
        },
        platform: "web",
      });

      setIsCompleted(true);
      toast.success("Drill completed! Great job!");

      // Track activity locally (no API call)
      trackActivity("drill", drill._id, "completed", {
              title: drill.title,
              type: drill.type,
              score,
        });

      // Refresh the page to update drill status
      router.refresh();
    } catch (error: any) {
      toast.error("Failed to submit drill: " + (error.message || "Unknown error"));
      setIsSubmitting(false);
    }
  };

  // Refresh on mount if completed
  useEffect(() => {
    if (isCompleted) {
      router.refresh();
    }
  }, [isCompleted, router]);

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-white pb-20 md:pb-0">
        <div className="h-6"></div>
        <Header title="Drill Completed" showBack={true} />
        <div className="max-w-md mx-auto px-4 py-6">
          <Card className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Great Job!</h2>
            <p className="text-gray-600 mb-6">You've completed the matching drill.</p>
            <Button 
              variant="primary" 
              size="lg" 
              fullWidth
              onClick={() => {
                router.refresh();
                router.push("/account");
              }}
            >
              Continue Learning
            </Button>
          </Card>
        </div>
        <BottomNav />
      </div>
    );
  }

  const matchedCount = matchedPairs.size;
  const progress = pairs.length > 0 ? (matchedCount / pairs.length) * 100 : 0;
  const allMatched = matchedCount === pairs.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 pb-20 md:pb-0">
      <div className="h-6"></div>
      <Header title={drill.title} showBack={true} />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Progress Bar */}
        <Card className="mb-6 bg-white/90 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Matched: {matchedCount} / {pairs.length}
            </span>
            <span className="text-sm font-bold text-blue-600">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </Card>

        {/* Instructions */}
        {drill.context && (
          <Card className="mb-6 bg-blue-50 border-blue-200">
            <p className="text-sm text-blue-800">{drill.context}</p>
          </Card>
        )}

        {/* Instructions Card */}
        <Card className="mb-6 bg-white/90 backdrop-blur-sm border-blue-200">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 font-bold text-sm">i</span>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">How to Play</h3>
              <p className="text-xs text-gray-600">
                Select an item from the left column, then select its matching item from the right
                column. Correct matches will be locked. Match all pairs to complete the drill.
              </p>
            </div>
          </div>
        </Card>

        {/* Matching Interface */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Left Column */}
          <Card className="p-4 bg-white/90 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Column A
            </h3>
            <div className="space-y-3">
              {leftItems.map((item, index) => {
                const isMatched = isLeftMatched(index);
                const isSelected = selectedLeftIndex === index;
                const isIncorrect = Array.from(incorrectAttempts).some((key) =>
                  key.startsWith(`${index}-`)
                );

                return (
                  <button
                    key={`left-${item.id}-${index}`}
                    onClick={() => handleLeftClick(index)}
                    disabled={isMatched}
                    className={`w-full p-4 rounded-xl text-left transition-all duration-200 group ${
                      isMatched
                        ? "bg-green-100 border-2 border-green-500 cursor-default opacity-75"
                        : isSelected
                          ? "bg-blue-100 border-2 border-blue-500 shadow-md scale-105"
                          : isIncorrect
                            ? "bg-red-50 border-2 border-red-300 animate-pulse"
                            : "bg-white border-2 border-gray-200 hover:border-blue-300 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.text}</p>
                        {item.translation && (
                          <p className="text-xs text-gray-500 mt-1">{item.translation}</p>
                        )}
                      </div>
                      {isMatched && (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 ml-2" />
                      )}
                      {isSelected && !isMatched && (
                        <div className="w-5 h-5 border-2 border-blue-500 rounded-full flex-shrink-0 ml-2" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Right Column */}
          <Card className="p-4 bg-white/90 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
              Column B
            </h3>
            <div className="space-y-3">
              {rightItems.map((item, index) => {
                const isMatched = isRightMatched(index);
                const isSelected = selectedRightIndex === index;
                const isIncorrect = Array.from(incorrectAttempts).some((key) =>
                  key.endsWith(`-${index}`)
                );

                return (
                  <button
                    key={`right-${item.id}-${index}`}
                    onClick={() => handleRightClick(index)}
                    disabled={isMatched}
                    className={`w-full p-4 rounded-xl text-left transition-all duration-200 group ${
                      isMatched
                        ? "bg-green-100 border-2 border-green-500 cursor-default opacity-75"
                        : isSelected
                          ? "bg-indigo-100 border-2 border-indigo-500 shadow-md scale-105"
                          : isIncorrect
                            ? "bg-red-50 border-2 border-red-300 animate-pulse"
                            : "bg-white border-2 border-gray-200 hover:border-indigo-300 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.text}</p>
                        {item.translation && (
                          <p className="text-xs text-gray-500 mt-1">{item.translation}</p>
                        )}
                      </div>
                      {isMatched && (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 ml-2" />
                      )}
                      {isSelected && !isMatched && (
                        <div className="w-5 h-5 border-2 border-indigo-500 rounded-full flex-shrink-0 ml-2" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={handleReset}
            className="gap-2"
            disabled={isSubmitting}
          >
            <Shuffle className="w-4 h-4" />
            Shuffle & Reset
          </Button>
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={handleSubmit}
            disabled={isSubmitting || !allMatched}
            className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : allMatched ? (
              "Complete Drill"
            ) : (
              `Match ${pairs.length - matchedCount} more pair${pairs.length - matchedCount !== 1 ? "s" : ""}`
            )}
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
