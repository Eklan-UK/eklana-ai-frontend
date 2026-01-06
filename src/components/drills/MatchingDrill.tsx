"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TTSButton } from "@/components/ui/TTSButton";
import { CheckCircle, XCircle, Loader2, Shuffle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { drillAPI } from "@/lib/api";

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

export default function MatchingDrill({ drill, assignmentId }: MatchingDrillProps) {
  const [pairs, setPairs] = useState<MatchPair[]>([]);
  const [leftItems, setLeftItems] = useState<string[]>([]);
  const [rightItems, setRightItems] = useState<string[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [selectedRight, setSelectedRight] = useState<number | null>(null);
  const [matches, setMatches] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const matchingPairs = drill.matching_pairs || [];
    setPairs(matchingPairs);
    
    // Shuffle items for practice
    const left = matchingPairs.map((p: MatchPair) => p.left);
    const right = matchingPairs.map((p: MatchPair) => p.right);
    
    // Shuffle right side
    const shuffledRight = [...right].sort(() => Math.random() - 0.5);
    
    setLeftItems(left);
    setRightItems(shuffledRight);
  }, [drill.matching_pairs]);

  const handleLeftClick = (index: number) => {
    if (matches[index] !== undefined) return; // Already matched
    
    if (selectedLeft === index) {
      setSelectedLeft(null);
    } else {
      setSelectedLeft(index);
      if (selectedRight !== null) {
        handleMatch(index, selectedRight);
      }
    }
  };

  const handleRightClick = (rightIndex: number) => {
    const matchedLeftIndex = Object.keys(matches).find(
      key => matches[parseInt(key)] === rightIndex
    );
    if (matchedLeftIndex !== undefined) return; // Already matched
    
    if (selectedRight === rightIndex) {
      setSelectedRight(null);
    } else {
      setSelectedRight(rightIndex);
      if (selectedLeft !== null) {
        handleMatch(selectedLeft, rightIndex);
      }
    }
  };

  const handleMatch = (leftIndex: number, rightIndex: number) => {
    const leftItem = leftItems[leftIndex];
    const rightItem = rightItems[rightIndex];
    
    // Check if this is a correct match
    const correctPair = pairs.find((p: MatchPair) => p.left === leftItem && p.right === rightItem);
    
    if (correctPair) {
      setMatches({ ...matches, [leftIndex]: rightIndex });
      toast.success("Correct match!");
    } else {
      toast.error("Incorrect match. Try again!");
    }
    
    setSelectedLeft(null);
    setSelectedRight(null);
  };

  const handleReset = () => {
    setMatches({});
    setSelectedLeft(null);
    setSelectedRight(null);
    const shuffledRight = [...rightItems].sort(() => Math.random() - 0.5);
    setRightItems(shuffledRight);
    toast.info("Reset!");
  };

  const handleSubmit = async () => {
    if (!assignmentId) {
      toast.error("Assignment ID is missing. Cannot submit drill.");
      return;
    }

    const allMatched = leftItems.length === Object.keys(matches).length;
    if (!allMatched) {
      toast.error("Please match all pairs before submitting");
      return;
    }

    setIsSubmitting(true);
    try {
      // Calculate score
      let correctMatches = 0;
      Object.entries(matches).forEach(([leftIdx, rightIdx]) => {
        const leftItem = leftItems[parseInt(leftIdx)];
        const rightItem = rightItems[rightIdx];
        const isCorrect = pairs.some((p: MatchPair) => p.left === leftItem && p.right === rightItem);
        if (isCorrect) correctMatches++;
      });
      
      const score = Math.round((correctMatches / pairs.length) * 100);
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);

      await drillAPI.complete(drill._id, {
        drillAssignmentId: assignmentId,
        score,
        timeSpent,
        matchingResults: {
          pairs: pairs.map((pair: MatchPair, idx: number) => ({
            left: pair.left,
            right: pair.right,
            matched: Object.entries(matches).some(
              ([leftIdx, rightIdx]: [string, number]) => 
                leftItems[parseInt(leftIdx)] === pair.left && 
                rightItems[rightIdx] === pair.right
            ),
          })),
        },
        platform: 'web',
      });

      setIsCompleted(true);
      toast.success("Drill completed! Great job!");

      try {
        await fetch('/api/v1/activities/recent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            type: 'drill',
            resourceId: drill._id,
            action: 'completed',
            metadata: { title: drill.title, type: drill.type, score },
          }),
        });
      } catch (error) {
        console.error('Failed to track activity:', error);
      }
    } catch (error: any) {
      toast.error("Failed to submit drill: " + (error.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-white pb-20 md:pb-0">
        <div className="h-6"></div>
        <Header title="Drill Completed" />
        <div className="max-w-md mx-auto px-4 py-6">
          <Card className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Great Job!</h2>
            <p className="text-gray-600 mb-6">You've completed the matching drill.</p>
            <Link href="/account">
              <Button variant="primary" size="lg" fullWidth>Continue Learning</Button>
            </Link>
          </Card>
        </div>
        <BottomNav />
      </div>
    );
  }

  const matchedCount = Object.keys(matches).length;
  const progress = pairs.length > 0 ? (matchedCount / pairs.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 pb-20 md:pb-0">
      <div className="h-6"></div>
      <Header title={drill.title} />
      
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Progress Bar */}
        <Card className="mb-6 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Matched: {matchedCount} / {pairs.length}
            </span>
            <span className="text-sm font-bold text-green-600">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </Card>

        {/* Instructions */}
        {drill.context && (
          <Card className="mb-6 bg-green-50 border-green-200">
            <p className="text-sm text-green-800">{drill.context}</p>
          </Card>
        )}

        {/* Matching Interface */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Left Column */}
          <Card className="p-4 bg-white/90 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Column A
            </h3>
            <div className="space-y-3">
              {leftItems.map((item, index) => {
                const isMatched = matches[index] !== undefined;
                const isSelected = selectedLeft === index;
                const matchedRightIndex = matches[index];
                
                return (
                  <button
                    key={index}
                    onClick={() => handleLeftClick(index)}
                    disabled={isMatched}
                    className={`w-full p-4 rounded-xl text-left transition-all duration-200 ${
                      isMatched
                        ? 'bg-green-100 border-2 border-green-500 cursor-default'
                        : isSelected
                        ? 'bg-green-100 border-2 border-green-500 shadow-md scale-105'
                        : 'bg-white border-2 border-gray-200 hover:border-green-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item}</p>
                        {pairs.find((p: MatchPair) => p.left === item)?.leftTranslation && (
                          <p className="text-xs text-gray-500 mt-1">
                            {pairs.find((p: MatchPair) => p.left === item)?.leftTranslation}
                          </p>
                        )}
                      </div>
                      {isMatched && (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 ml-2" />
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
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              Column B
            </h3>
            <div className="space-y-3">
              {rightItems.map((item, index) => {
                const matchedLeftIndex = Object.keys(matches).find(
                  key => matches[parseInt(key)] === index
                );
                const isMatched = matchedLeftIndex !== undefined;
                const isSelected = selectedRight === index;
                
                return (
                  <button
                    key={index}
                    onClick={() => handleRightClick(index)}
                    disabled={isMatched}
                    className={`w-full p-4 rounded-xl text-left transition-all duration-200 ${
                      isMatched
                        ? 'bg-green-100 border-2 border-green-500 cursor-default'
                        : isSelected
                        ? 'bg-emerald-100 border-2 border-emerald-500 shadow-md scale-105'
                        : 'bg-white border-2 border-gray-200 hover:border-emerald-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item}</p>
                        {pairs.find((p: MatchPair) => p.right === item)?.rightTranslation && (
                          <p className="text-xs text-gray-500 mt-1">
                            {pairs.find((p: MatchPair) => p.right === item)?.rightTranslation}
                          </p>
                        )}
                      </div>
                      {isMatched && (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 ml-2" />
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
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={() => {
              if (matchedCount === pairs.length) {
                handleSubmit();
              } else {
                toast.info(`Please match all ${pairs.length} pairs`);
              }
            }}
            disabled={isSubmitting || matchedCount < pairs.length}
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
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
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
