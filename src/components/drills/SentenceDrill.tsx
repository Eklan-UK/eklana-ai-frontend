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
} from "lucide-react";
import { toast } from "sonner";
import { drillAPI } from "@/lib/api";
import { DrillCompletionScreen, DrillLayout, DrillProgress } from "./shared";

interface SentenceDrillProps {
  drill: any;
  assignmentId?: string;
}

interface WordItem {
  word: string;
  hint?: string;
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
    }));
  }

  // For 'sentence' type drills - use sentence_drill_word (single word)
  if (drill.sentence_drill_word) {
    return [{ word: drill.sentence_drill_word, hint: undefined }];
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
  const wordItems = useMemo(() => getWordItems(drill), [drill]);
  const totalWords = wordItems.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, WordAnswer>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [startTime] = useState(Date.now());

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

  const handleNext = () => {
    if (!isCurrentWordComplete) {
      toast.error("Please fill in all fields before proceeding.");
      return;
    }
    if (!isLastWord) {
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

      await drillAPI.complete(drill._id, {
        drillAssignmentId: assignmentId,
        score: 0, // Score will be calculated after review
        timeSpent,
        sentenceResults,
        platform: "web",
      });

      setIsCompleted(true);
      toast.success("Drill submitted! Your submission is pending review.");

      // Track activity
      try {
        await fetch("/api/v1/activities/recent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            type: "drill",
            resourceId: drill._id,
            action: "completed",
            metadata: { title: drill.title, type: drill.type },
          }),
        });
      } catch (error) {
        console.error("Failed to track activity:", error);
      }
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
            <p className="text-sm text-gray-500">
              This drill may not be configured correctly. Please contact your
              tutor.
            </p>
          </div>
        </Card>
      </DrillLayout>
    );
  }

  const progress = ((currentIndex + 1) / totalWords) * 100;

  return (
    <DrillLayout title={drill.title}>
      {/* Context */}
      {drill.context && (
        <Card className="mb-4">
          <p className="text-sm text-gray-700">{drill.context}</p>
        </Card>
      )}

      {/* Progress */}
      {totalWords > 1 && (
        <DrillProgress
          current={currentIndex + 1}
          total={totalWords}
          label="Word"
        />
      )}

      {/* Target Word Card */}
      <Card className="mb-4">
        <div className="text-center py-6">
          {currentWord?.word ? (
            <>
              <div className="flex items-center justify-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                  {currentWord.word}
                </h1>
                <TTSButton text={currentWord.word} size="lg" />
              </div>
              {currentWord.hint && (
                <p className="text-sm text-blue-600 mt-2 bg-blue-50 px-4 py-2 rounded-lg inline-block">
                  💡 Hint: {currentWord.hint}
                </p>
              )}
              <p className="text-sm text-gray-500 mt-3">
                Provide definition and two sentences
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 text-amber-600">
              <AlertCircle className="w-12 h-12" />
              <p className="text-lg font-medium">No target word found</p>
              <p className="text-sm text-gray-500">
                This drill may not be configured correctly. Please contact your
                tutor.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Definition Section */}
      <Card className="mb-4">
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-gray-600" />
            Definition:
          </label>
          <Textarea
            className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all min-h-[100px] resize-none"
            placeholder="Enter the definition of the word..."
            value={currentAnswer.definition}
            onChange={(e) => updateCurrentAnswer("definition", e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-2">
            {currentAnswer.definition.length} characters
          </p>
        </div>
      </Card>

      {/* Sentence 1 Section */}
      <Card className="mb-4">
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <PenTool className="w-4 h-4 text-gray-600" />
            Sentence 1:
          </label>
          <Textarea
            className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all min-h-[100px] resize-none"
            placeholder="Write a sentence using the word..."
            value={currentAnswer.sentence1}
            onChange={(e) => updateCurrentAnswer("sentence1", e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-2">
            {currentAnswer.sentence1.length} characters
          </p>
        </div>
      </Card>

      {/* Sentence 2 Section */}
      <Card className="mb-4">
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <PenTool className="w-4 h-4 text-gray-600" />
            Sentence 2:
          </label>
          <Textarea
            className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all min-h-[100px] resize-none"
            placeholder="Write another sentence using the word..."
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
          disabled={isFirstWord}
          className="flex-shrink-0"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Previous
        </Button>

        {/* Next or Submit Button */}
        {isLastWord ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleSubmit}
            disabled={!isCurrentWordComplete || isSubmitting}
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
            disabled={!isCurrentWordComplete}
          >
            Next
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        )}
      </div>

      {/* Word Progress Indicators */}
      {totalWords > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {wordItems.map((_, idx) => {
            const answer = answers[idx];
            const isComplete =
              answer &&
              answer.definition.trim().length > 0 &&
              answer.sentence1.trim().length > 0 &&
              answer.sentence2.trim().length > 0;
            const isCurrent = idx === currentIndex;

            return (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-8 h-8 rounded-full text-sm font-medium transition-all ${
                  isCurrent
                    ? "bg-green-500 text-white ring-2 ring-green-300"
                    : isComplete
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
                title={`Word ${idx + 1}: ${wordItems[idx].word}`}
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
