"use client";

import { useState, useMemo } from "react";
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
import { DrillCompletionScreen, DrillLayout, DrillProgress } from "./shared";
import { trackActivity } from "@/utils/activity-cache";

interface GrammarDrillProps {
  drill: any;
  assignmentId?: string;
}

interface PatternItem {
  pattern: string;
  example: string;
  hint?: string;
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
    }));
  }, [drill.grammar_items]);

  const totalPatterns = patternItems.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, PatternAnswer>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [startTime] = useState(Date.now());

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

  const updateCurrentAnswer = (field: keyof PatternAnswer, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentIndex]: {
        ...currentAnswer,
        [field]: value,
      },
    }));
  };

  const handlePrevious = () => {
    if (!isFirstPattern) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (!isCurrentPatternComplete) {
      toast.error("Please write both sentences before proceeding.");
      return;
    }
    if (!isLastPattern) {
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
            <p className="text-sm text-gray-500">
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
      {/* Context */}
      {drill.context && (
        <Card className="mb-4">
          <p className="text-sm text-gray-700">{drill.context}</p>
        </Card>
      )}

        {/* Progress */}
      {totalPatterns > 1 && (
        <DrillProgress
          current={currentIndex + 1}
          total={totalPatterns}
          label="Pattern"
        />
      )}

      {/* Pattern Display Card */}
      <Card className="mb-4 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold mb-3">
            <FileText className="w-3 h-3" />
            Grammar Pattern
          </div>
          
          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              {currentPattern?.pattern}
            </h1>
            <TTSButton text={currentPattern?.pattern || ""} size="md" />
          </div>
          
          {currentPattern?.hint && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <p className="text-sm text-amber-700">{currentPattern.hint}</p>
            </div>
          )}
                    </div>
      </Card>

      {/* Example Display - Always shown as guide */}
      <Card className="mb-4 bg-green-50 border-green-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-green-600" />
                    </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-1">
              Example (Use this as your guide)
            </p>
            <div className="flex items-center gap-2">
              <p className="text-lg text-green-900 font-medium">
                "{currentPattern?.example}"
              </p>
              <TTSButton text={currentPattern?.example || ""} size="sm" />
                </div>
                    </div>
                  </div>
      </Card>

      {/* Instructions */}
      <Card className="mb-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-2">
          <PenTool className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
            <p className="text-sm font-medium text-blue-900 mb-1">Your Task</p>
            <p className="text-sm text-blue-800">
              Write <strong>two different sentences</strong> using the pattern above. 
              Use the example as a guide for how to structure your sentences.
            </p>
                    </div>
                  </div>
      </Card>

      {/* Sentence 1 Input */}
      <Card className="mb-4">
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">
              1
            </span>
            First Sentence:
                </label>
          <Textarea
            className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all min-h-[100px] resize-none"
            placeholder="Write your first sentence using the pattern..."
            value={currentAnswer.sentence1}
            onChange={(e) => updateCurrentAnswer("sentence1", e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-2">
            {currentAnswer.sentence1.length} characters
                </p>
              </div>
      </Card>

      {/* Sentence 2 Input */}
      <Card className="mb-4">
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-xs font-bold">
              2
            </span>
            Second Sentence:
          </label>
          <Textarea
            className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all min-h-[100px] resize-none"
            placeholder="Write your second sentence using the pattern..."
            value={currentAnswer.sentence2}
            onChange={(e) => updateCurrentAnswer("sentence2", e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-2">
            {currentAnswer.sentence2.length} characters
          </p>
            </div>
        </Card>

      {/* Navigation Buttons */}
        <div className="flex gap-3">
        {/* Previous Button */}
        <Button
          variant="outline"
          size="lg"
          onClick={handlePrevious}
          disabled={isFirstPattern}
          className="flex-shrink-0"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Previous
        </Button>

        {/* Next or Submit Button */}
        {isLastPattern ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleSubmit}
            disabled={!isCurrentPatternComplete || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit for Review"
            )}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleNext}
            disabled={!isCurrentPatternComplete}
          >
            Next
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        )}
      </div>
      
      {/* Pattern Progress Indicators */}
      {totalPatterns > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {patternItems.map((_, idx) => {
            const answer = answers[idx];
            const isComplete =
              answer &&
              answer.sentence1.trim().length > 0 &&
              answer.sentence2.trim().length > 0;
            const isCurrent = idx === currentIndex;

            return (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-8 h-8 rounded-full text-sm font-medium transition-all ${
                  isCurrent
                    ? "bg-purple-500 text-white ring-2 ring-purple-300"
                    : isComplete
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
                title={`Pattern ${idx + 1}: ${patternItems[idx].pattern}`}
              >
                {idx + 1}
              </button>
            );
          })}
    </div>
      )}
    </DrillLayout>
  );
}
