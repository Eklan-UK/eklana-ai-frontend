"use client";

import { Fragment, useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { completeLearnerDrill } from "@/lib/drill/complete-learner-drill";
import { trackActivity } from "@/utils/activity-cache";
import { DrillCompletionScreen, DrillLayout, CheckpointScreen } from "./shared";
import type { DrillConfettiVariant } from "@/lib/drill-celebration";
import { DrillBookmarkToggle } from "@/components/drills/DrillBookmarkToggle";
import { playPracticeFeedback } from "@/lib/practice-feedback";
import {
  loadCheckpoint,
  saveCheckpoint,
  clearCheckpoint,
} from "@/lib/drill/drill-checkpoint";
import { useLocalDrillProgress } from "@/hooks/useLocalDrillProgress";

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

const TILE_BASE =
  "min-h-[3.5rem] w-full rounded-lg border px-2 py-3 text-center text-sm font-medium transition-colors duration-200 flex flex-col items-center justify-center gap-0.5";

function normalizeMatchText(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/** When texts match a row in `pairs` but tile ids differ (duplicate labels), pick an unused canonical index. */
function findUnmatchedCanonicalPairIndex(
  pairs: MatchPair[],
  leftItem: ShuffledItem,
  rightItem: ShuffledItem,
  matchedCanonical: Set<number>
): number {
  const L = normalizeMatchText(leftItem.text);
  const R = normalizeMatchText(rightItem.text);
  const candidates: number[] = [];
  pairs.forEach((p, i) => {
    if (matchedCanonical.has(i)) return;
    if (normalizeMatchText(p.left) === L && normalizeMatchText(p.right) === R) {
      candidates.push(i);
    }
  });
  if (candidates.length === 0) return -1;
  if (candidates.length === 1) return candidates[0];
  if (candidates.includes(leftItem.id)) return leftItem.id;
  if (candidates.includes(rightItem.id)) return rightItem.id;
  return candidates[0];
}

function restoreMatchedCanonicalIndices(
  pairs: MatchPair[],
  restoredKeys: Set<string>,
  leftItems: ShuffledItem[],
  rightItems: ShuffledItem[],
): Set<number> {
  const matched = new Set<number>();
  restoredKeys.forEach((key) => {
    const [leftIdStr, rightIdStr] = key.split("-");
    const leftId = Number(leftIdStr);
    const rightId = Number(rightIdStr);

    if (leftId === rightId) {
      matched.add(leftId);
      return;
    }

    const leftItem = leftItems.find((item) => item.id === leftId);
    const rightItem = rightItems.find((item) => item.id === rightId);
    if (leftItem && rightItem) {
      const canonicalIndex = findUnmatchedCanonicalPairIndex(
        pairs,
        leftItem,
        rightItem,
        matched,
      );
      if (canonicalIndex !== -1) {
        matched.add(canonicalIndex);
      }
    }
  });
  return matched;
}

function computeMatchingScore(
  pairsMatched: number,
  incorrectCount: number,
): number {
  const totalAttempts = pairsMatched + incorrectCount;
  if (totalAttempts === 0) return 0;
  return Math.round((pairsMatched / totalAttempts) * 100);
}

export default function MatchingDrill({ drill, assignmentId }: MatchingDrillProps) {
  const queryClient = useQueryClient();
  const localProgress = useLocalDrillProgress({
    drillId: String(drill._id),
    drillType: "matching",
    assignmentId,
  });
  const [pairs, setPairs] = useState<MatchPair[]>([]);
  const [leftItems, setLeftItems] = useState<ShuffledItem[]>([]);
  const [rightItems, setRightItems] = useState<ShuffledItem[]>([]);
  const [selectedLeftIndex, setSelectedLeftIndex] = useState<number | null>(null);
  const [selectedRightIndex, setSelectedRightIndex] = useState<number | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
  const [incorrectAttempts, setIncorrectAttempts] = useState<Set<string>>(new Set());
  const [isCompleted, setIsCompleted] = useState(false);
  const [celebrationSoundUrl, setCelebrationSoundUrl] = useState<string>();
  const [confettiVariant, setConfettiVariant] = useState<DrillConfettiVariant>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(Date.now());
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const [checkpointCount, setCheckpointCount] = useState(0);
  const [isLoadingCheckpoint, setIsLoadingCheckpoint] = useState(true);
  const matchTimingAnchorRef = useRef<number>(Date.now());
  const isSubmittingRef = useRef(false);
  const incorrectPairsRef = useRef<
    Array<{ left: string; right: string; attemptedMatch: string }>
  >([]);
  const pairMatchEventsRef = useRef<
    Array<{ durationSec: number; left: string; right: string }>
  >([]);
  const matchedCanonicalIndicesRef = useRef<Set<number>>(new Set());

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  useEffect(() => {
    const matchingPairs = drill.matching_pairs || [];

    const applyPairSetup = (restoredKeys: Set<string>) => {
      setPairs(matchingPairs);

      const leftShuffled: ShuffledItem[] = shuffleArray(
        matchingPairs.map((p: MatchPair, idx: number) => ({
          id: idx,
          text: p.left,
          translation: p.leftTranslation,
        })),
      );

      const rightShuffled: ShuffledItem[] = shuffleArray(
        matchingPairs.map((p: MatchPair, idx: number) => ({
          id: idx,
          text: p.right,
          translation: p.rightTranslation,
        })),
      );

      setLeftItems(leftShuffled);
      setRightItems(rightShuffled);

      if (restoredKeys.size > 0) {
        setMatchedPairs(new Set(restoredKeys));
        matchedCanonicalIndicesRef.current = restoreMatchedCanonicalIndices(
          matchingPairs,
          restoredKeys,
          leftShuffled,
          rightShuffled,
        );
      } else {
        setMatchedPairs(new Set());
        matchedCanonicalIndicesRef.current = new Set();
      }

      setIncorrectAttempts(new Set());
      setSelectedLeftIndex(null);
      setSelectedRightIndex(null);
      matchTimingAnchorRef.current = Date.now();
      incorrectPairsRef.current = [];
      pairMatchEventsRef.current = [];
    };

    if (!localProgress.isReady) return;

    let cancelled = false;
    setIsLoadingCheckpoint(true);
    setShowCheckpoint(false);

    const local = localProgress.hydrate();
    if (local) {
      const restoredKeys =
        local.partialResults.matchedPairKeys != null
          ? new Set(local.partialResults.matchedPairKeys as string[])
          : new Set<string>();
      setCheckpointCount(local.completedItemCount);
      applyPairSetup(restoredKeys);
      setIsLoadingCheckpoint(false);
      return;
    }

    if (!assignmentId) {
      applyPairSetup(new Set());
      setIsLoadingCheckpoint(false);
      return;
    }

    loadCheckpoint(String(drill._id), assignmentId).then((cp) => {
      if (cancelled) return;
      const restoredKeys =
        cp?.partialResults?.matchedPairKeys != null
          ? new Set(cp.partialResults.matchedPairKeys as string[])
          : new Set<string>();
      if (cp) {
        setCheckpointCount(cp.completedItemCount);
      }
      applyPairSetup(restoredKeys);
      setIsLoadingCheckpoint(false);
    });

    return () => {
      cancelled = true;
    };
  }, [localProgress.isReady, assignmentId, drill._id, drill.matching_pairs]);

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

  const handleLeftClick = (leftIndex: number) => {
    if (isLeftMatched(leftIndex)) return;

    if (selectedLeftIndex === leftIndex) {
      setSelectedLeftIndex(null);
      return;
    }

    setSelectedLeftIndex(leftIndex);

    if (selectedRightIndex !== null) {
      handleMatch(leftIndex, selectedRightIndex);
    }
  };

  const handleRightClick = (rightIndex: number) => {
    if (isRightMatched(rightIndex)) return;

    if (selectedRightIndex === rightIndex) {
      setSelectedRightIndex(null);
      return;
    }

    setSelectedRightIndex(rightIndex);

    if (selectedLeftIndex !== null) {
      handleMatch(selectedLeftIndex, rightIndex);
    }
  };

  const handleMatch = (leftIndex: number, rightIndex: number) => {
    const leftItem = leftItems[leftIndex];
    const rightItem = rightItems[rightIndex];

    const isCorrectById = leftItem.id === rightItem.id;
    const canonicalIndex = isCorrectById
      ? leftItem.id
      : findUnmatchedCanonicalPairIndex(
          pairs,
          leftItem,
          rightItem,
          matchedCanonicalIndicesRef.current
        );
    const isCorrect = isCorrectById || canonicalIndex !== -1;

    if (isCorrect) {
      matchedCanonicalIndicesRef.current.add(canonicalIndex);

      const now = Date.now();
      const durationSec =
        Math.round(((now - matchTimingAnchorRef.current) / 1000) * 100) / 100;
      matchTimingAnchorRef.current = now;
      const canonical = pairs[canonicalIndex];
      if (canonical) {
        pairMatchEventsRef.current = [
          ...pairMatchEventsRef.current,
          {
            durationSec: Math.max(0, durationSec),
            left: canonical.left,
            right: canonical.right,
          },
        ].slice(0, 100);
      }

      const pairKey = `${leftItem.id}-${rightItem.id}`;
      const newMatchedCount = matchedPairs.size + 1;
      const newMatchedPairs = new Set([...matchedPairs, pairKey]);
      setMatchedPairs(newMatchedPairs);
      setSelectedLeftIndex(null);
      setSelectedRightIndex(null);
      setIncorrectAttempts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(`${leftIndex}-${rightIndex}`);
        return newSet;
      });

      playPracticeFeedback("success");

      localProgress.persist({
        resumeFromIndex: newMatchedCount,
        completedItemCount: newMatchedCount,
        partialResults: { matchedPairKeys: [...newMatchedPairs] },
        startedAt: new Date(startTime).toISOString(),
      });

      const allMatched = newMatchedCount === pairs.length && pairs.length > 0;
      if (allMatched) {
        toast.success("All pairs matched! Press Submit to finish.");
        return;
      }

      toast.success("Correct match! ✓");

      if (newMatchedCount % 5 === 0 && assignmentId) {
        void saveCheckpoint(String(drill._id), {
          assignmentId,
          drillType: "matching",
          resumeFromIndex: newMatchedCount,
          completedItemCount: newMatchedCount,
          partialResults: { matchedPairKeys: [...newMatchedPairs] },
          startedAt: new Date(startTime),
        });
        setCheckpointCount(newMatchedCount);
        setShowCheckpoint(true);
      }
    } else {
      const rowForLeftId = pairs[leftItem.id];
      const rightColumnHint =
        rowForLeftId &&
        normalizeMatchText(rowForLeftId.left) === normalizeMatchText(leftItem.text)
          ? rowForLeftId.right
          : "";
      incorrectPairsRef.current = [
        ...incorrectPairsRef.current,
        {
          left: leftItem.text,
          right: rightColumnHint,
          attemptedMatch: rightItem.text,
        },
      ].slice(-50);
      const attemptKey = `${leftIndex}-${rightIndex}`;
      setIncorrectAttempts((prev) => new Set([...prev, attemptKey]));
      setSelectedLeftIndex(null);
      setSelectedRightIndex(null);

      playPracticeFeedback("failure");
      toast.error("Incorrect match. Try again!");

      setTimeout(() => {
        setIncorrectAttempts((prev) => {
          const newSet = new Set(prev);
          newSet.delete(attemptKey);
          return newSet;
        });
      }, 1000);
    }
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;

    if (!assignmentId) {
      toast.error("Assignment ID is missing. Cannot submit drill.");
      return;
    }

    if (pairs.length === 0) {
      toast.error("This drill has no matching pairs.");
      return;
    }

    if (matchedPairs.size !== pairs.length) {
      toast.error("Please match all pairs before submitting");
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    let succeeded = false;
    try {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      const pairsMatched = matchedPairs.size;
      const totalPairs = pairs.length;
      const incorrectCount = incorrectPairsRef.current.length;
      const accuracy = computeMatchingScore(pairsMatched, incorrectCount);
      const score = accuracy;

      const result = await completeLearnerDrill(queryClient, drill._id, {
        drillAssignmentId: assignmentId,
        score,
        timeSpent,
        matchingResults: {
          pairsMatched,
          totalPairs,
          accuracy,
          incorrectPairs:
            incorrectPairsRef.current.length > 0 ? incorrectPairsRef.current : undefined,
          pairMatchEvents:
            pairMatchEventsRef.current.length > 0 ? pairMatchEventsRef.current : undefined,
        },
        platform: "web",
      });

      setCelebrationSoundUrl(result.data?.effects?.soundUrl);
      setConfettiVariant(result.data?.effects?.confettiVariant);

      void clearCheckpoint(String(drill._id), assignmentId);
      localProgress.clear();
      succeeded = true;
      setIsCompleted(true);
      toast.success("Drill completed! Great job!");

      trackActivity("drill", drill._id, "completed", {
        title: drill.title,
        type: drill.type,
        score,
      });
    } catch (error: any) {
      toast.error("Failed to submit drill: " + (error.message || "Unknown error"));
    } finally {
      isSubmittingRef.current = false;
      if (!succeeded) {
        setIsSubmitting(false);
      }
    }
  };

  if (isLoadingCheckpoint) {
    return (
      <DrillLayout title={drill.title} headerRight={<DrillBookmarkToggle drillId={String(drill._id)} />}>
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
        totalCount={pairs.length}
        drillTitle={drill.title}
        onContinue={() => setShowCheckpoint(false)}
        onExit={() => {
          window.location.href = "/account/drills";
        }}
      />
    );
  }

  if (isCompleted) {
    return (
      <DrillCompletionScreen
        drillType="matching"
        celebrate
        celebrationSoundUrl={celebrationSoundUrl}
        confettiVariant={confettiVariant}
      />
    );
  }

  const matchedCount = matchedPairs.size;
  const allMatched = pairs.length > 0 && matchedCount === pairs.length;

  const tileClasses = (
    isMatched: boolean,
    isSelected: boolean,
    isIncorrect: boolean
  ) => {
    if (isMatched) {
      return `${TILE_BASE} border-emerald-500/60 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 cursor-default`;
    }
    if (isIncorrect) {
      return `${TILE_BASE} border-red-400/80 bg-red-500/15 text-red-900 dark:text-red-200`;
    }
    if (isSelected) {
      return `${TILE_BASE} border-border bg-card text-foreground ring-2 ring-emerald-500/40 ring-offset-1 ring-offset-background`;
    }
    return `${TILE_BASE} border-border bg-card text-foreground hover:border-border active:bg-muted`;
  };

  const drillIdStr = drill._id != null ? String(drill._id) : "";

  return (
    <DrillLayout
      title={drill.title}
      progress={{ current: matchedCount, total: pairs.length }}
      headerRight={
        drillIdStr ? (
          <DrillBookmarkToggle drillId={drillIdStr} className="-mr-1" />
        ) : null
      }
    >
      <div className="space-y-5 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
        <h2 className="text-lg font-bold text-foreground leading-snug">
          Tap the Matching pairs
        </h2>

        {drill.context ? (
          <div className="rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-foreground">
            {drill.context}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {leftItems.map((leftItem, rowIdx) => {
            const rightItem = rightItems[rowIdx];
            if (!rightItem) return null;

            const leftMatched = isLeftMatched(rowIdx);
            const rightMatched = isRightMatched(rowIdx);
            const leftSelected = selectedLeftIndex === rowIdx;
            const rightSelected = selectedRightIndex === rowIdx;
            const leftIncorrect = Array.from(incorrectAttempts).some((key) =>
              key.startsWith(`${rowIdx}-`)
            );
            const rightIncorrect = Array.from(incorrectAttempts).some((key) =>
              key.endsWith(`-${rowIdx}`)
            );

            return (
              <Fragment key={`row-${leftItem.id}-${rightItem.id}-${rowIdx}`}>
                <button
                  type="button"
                  onClick={() => handleLeftClick(rowIdx)}
                  disabled={leftMatched}
                  className={tileClasses(leftMatched, leftSelected, leftIncorrect)}
                >
                  <span className="break-words">{leftItem.text}</span>
                  {leftItem.translation ? (
                    <span className="text-xs font-normal text-muted-foreground">{leftItem.translation}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => handleRightClick(rowIdx)}
                  disabled={rightMatched}
                  className={tileClasses(rightMatched, rightSelected, rightIncorrect)}
                >
                  <span className="break-words">{rightItem.text}</span>
                  {rightItem.translation ? (
                    <span className="text-xs font-normal text-muted-foreground">{rightItem.translation}</span>
                  ) : null}
                </button>
              </Fragment>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="md"
          fullWidth
          onClick={() => void handleSubmit()}
          disabled={isSubmitting || !allMatched}
          className={
            isSubmitting || !allMatched
              ? "!rounded-full !border-transparent !bg-muted !text-muted-foreground hover:!bg-muted focus-visible:!ring-muted-foreground disabled:!opacity-100 cursor-not-allowed shadow-none"
              : "!rounded-full !border-transparent !bg-[#3B883E] !text-white hover:!bg-emerald-700 active:!bg-emerald-800 focus-visible:!ring-emerald-600 shadow-none"
          }
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
              Submitting...
            </>
          ) : (
            "Submit"
          )}
        </Button>
      </div>
    </DrillLayout>
  );
}
