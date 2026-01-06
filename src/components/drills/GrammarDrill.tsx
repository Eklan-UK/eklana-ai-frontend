"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TTSButton } from "@/components/ui/TTSButton";
import { CheckCircle, Loader2, Sparkles, Lightbulb } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { drillAPI } from "@/lib/api";

interface GrammarDrillProps {
  drill: any;
  assignmentId?: string;
}

export default function GrammarDrill({ drill, assignmentId }: GrammarDrillProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(Date.now());

  const items = drill.grammar_items || [];
  const currentItem = items[currentIndex];
  const currentAnswer = answers[currentIndex] || "";
  const hasAnswer = currentAnswer.trim().length > 0;

  // Parse pattern to create fill-in-the-blank
  const createPatternWithBlanks = (pattern: string) => {
    // Replace placeholders like {word} or [word] with input fields
    return pattern;
  };

  const handleAnswerChange = (value: string) => {
    setAnswers({
      ...answers,
      [currentIndex]: value,
    });
  };

  const handleNext = () => {
    if (!hasAnswer) {
      toast.error("Please complete the grammar pattern before proceeding");
      return;
    }

    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      const allAnswered = items.every((_: any, idx: number) => {
        const answer = answers[idx];
        return answer && answer.trim().length > 0;
      });

      if (allAnswered) {
        setShowResults(true);
      } else {
        toast.error("Please answer all questions before reviewing");
        const firstUnanswered = items.findIndex((_: any, idx: number) => {
          const answer = answers[idx];
          return !answer || answer.trim().length === 0;
        });
        if (firstUnanswered !== -1) {
          setCurrentIndex(firstUnanswered);
        }
      }
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
      const totalQuestions = items.length;
      const answeredCount = items.filter((_: any, idx: number) => {
        const answer = answers[idx];
        return answer && answer.trim().length > 0;
      }).length;
      const score = Math.round((answeredCount / totalQuestions) * 100);
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);

      const grammarResults = items.map((item: any, index: number) => ({
        pattern: item.pattern,
        answer: answers[index] || "",
        hint: item.hint || "",
        example: item.example || "",
      }));

      await drillAPI.complete(drill._id, {
        drillAssignmentId: assignmentId,
        score,
        timeSpent,
        grammarResults: {
          patterns: grammarResults,
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
            <p className="text-gray-600 mb-6">You've completed the grammar drill.</p>
            <Link href="/account">
              <Button variant="primary" size="lg" fullWidth>Continue Learning</Button>
            </Link>
          </Card>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 pb-20 md:pb-0">
        <div className="h-6"></div>
        <Header title="Review Your Answers" />
        
        <div className="max-w-2xl mx-auto px-4 py-6">
          <Card className="mb-4 bg-white/90 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-pink-500" />
              Your Grammar Patterns
            </h2>
            <div className="space-y-6">
              {items.map((item: any, index: number) => (
                <div key={index} className="border-b border-gray-200 pb-6 last:border-0 last:pb-0">
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-8 h-8 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </span>
                      <h3 className="text-lg font-bold text-gray-900">Pattern</h3>
                    </div>
                    <p className="text-base text-gray-700 font-mono bg-gray-50 p-3 rounded-lg">
                      {item.pattern}
                    </p>
                    {item.example && (
                      <p className="text-xs text-gray-500 mt-2">Example: {item.example}</p>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Your answer:</p>
                    <p className="text-sm text-gray-900 font-mono">{answers[index] || "No answer provided"}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowResults(false)}
            >
              Review Again
            </Button>
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
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

  const progress = items.length > 0 ? ((currentIndex + 1) / items.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 pb-20 md:pb-0">
      <div className="h-6"></div>
      <Header title={drill.title} />
      
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Progress */}
        <Card className="mb-6 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Pattern {currentIndex + 1} of {items.length}
            </span>
            <span className="text-sm font-bold text-pink-600">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-pink-500 to-purple-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </Card>

        {/* Context */}
        {drill.context && (
          <Card className="mb-6 bg-pink-50 border-pink-200">
            <p className="text-sm text-pink-800">{drill.context}</p>
          </Card>
        )}

        {/* Main Card */}
        <Card className="mb-6 bg-white/90 backdrop-blur-sm shadow-lg">
          {currentItem && (
            <div>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-purple-400 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
                      {currentIndex + 1}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-700 mb-1">Grammar Pattern</h2>
                      <p className="text-xs text-gray-500">Complete this pattern</p>
                    </div>
                  </div>
                  <Sparkles className="w-6 h-6 text-pink-500" />
                </div>

                <div className="bg-gradient-to-r from-pink-100 to-purple-100 p-4 rounded-xl mb-4">
                  <p className="text-lg font-mono text-gray-900 text-center">
                    {currentItem.pattern}
                  </p>
                </div>

                {currentItem.example && (
                  <div className="flex items-start gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg mb-4">
                    <Sparkles className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-purple-800 mb-1">Example</p>
                      <p className="text-sm text-purple-900 font-mono">{currentItem.example}</p>
                    </div>
                  </div>
                )}

                {currentItem.hint && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <Lightbulb className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-yellow-800 mb-1">Hint</p>
                      <p className="text-sm text-yellow-900">{currentItem.hint}</p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Write a sentence using this pattern:
                </label>
                <textarea
                  className="w-full p-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all min-h-[120px] resize-none font-mono"
                  placeholder="Type your sentence here..."
                  value={currentAnswer}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-2">
                  {currentAnswer.length} characters
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Navigation */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            Previous
          </Button>
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={handleNext}
            disabled={!hasAnswer}
            className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
          >
            {currentIndex === items.length - 1 ? "Review" : "Next"}
          </Button>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
