"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TTSButton } from "@/components/ui/TTSButton";
import { ArrowLeft, CheckCircle, XCircle, Volume2, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { drillAPI } from "@/lib/api";

interface VocabularyDrillProps {
  drill: any;
  assignmentId?: string;
}

export default function VocabularyDrill({ drill, assignmentId }: VocabularyDrillProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [attempts, setAttempts] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(Date.now());

  const targetSentences = drill.target_sentences || [];
  const currentSentence = targetSentences[currentIndex];
  const currentAnswer = answers[currentIndex] || "";
  const hasAnswer = currentAnswer.trim().length > 0;

  // Initialize attempts tracking
  useEffect(() => {
    const initialAttempts: Record<number, number> = {};
    targetSentences.forEach((_: any, index: number) => {
      initialAttempts[index] = 0;
    });
    setAttempts(initialAttempts);
  }, [targetSentences.length]);

  const handleAnswerChange = (value: string) => {
    setAnswers({
      ...answers,
      [currentIndex]: value,
    });
  };

  const handleNext = () => {
    // Validate answer before proceeding
    if (!hasAnswer) {
      toast.error("Please provide an answer before proceeding");
      return;
    }

    // Increment attempt for current question
    setAttempts({
      ...attempts,
      [currentIndex]: (attempts[currentIndex] || 0) + 1,
    });

    if (currentIndex < targetSentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // All questions answered - check if all have answers
      const allAnswered = targetSentences.every((_: any, idx: number) => {
        const answer = answers[idx];
        return answer && answer.trim().length > 0;
      });

      if (allAnswered) {
        setShowResults(true);
      } else {
        toast.error("Please answer all questions before reviewing");
        // Go to first unanswered question
        const firstUnanswered = targetSentences.findIndex((_: any, idx: number) => {
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
      // Calculate score (simple: all answered = 100%, can be improved with actual scoring)
      const totalQuestions = targetSentences.length;
      const answeredCount = targetSentences.filter((_: any, idx: number) => {
        const answer = answers[idx];
        return answer && answer.trim().length > 0;
      }).length;
      const score = Math.round((answeredCount / totalQuestions) * 100);
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);

      // Prepare vocabulary results with attempts
      const wordScores = targetSentences.map((sentence: any, index: number) => ({
        word: sentence.word || sentence.text,
        score: answers[index] && answers[index].trim().length > 0 ? 100 : 0,
        attempts: attempts[index] || 0,
      }));

      // Submit to API
      await drillAPI.complete(drill._id, {
        drillAssignmentId: assignmentId,
        score,
        timeSpent,
        vocabularyResults: {
          wordScores,
        },
        platform: 'web',
      });

      setIsCompleted(true);
      toast.success("Drill completed! Great job!");

      // Track completion in recent activities
      try {
        await fetch('/api/v1/activities/recent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            type: 'drill',
            resourceId: drill._id,
            action: 'completed',
            metadata: {
              title: drill.title,
              type: drill.type,
              score,
            },
          }),
        });
      } catch (error) {
        // Silently fail
        console.error('Failed to track activity:', error);
      }
    } catch (error: any) {
      toast.error("Failed to submit drill: " + (error.message || "Unknown error"));
      console.error("Error submitting drill:", error);
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Great Job!
            </h2>
            <p className="text-gray-600 mb-6">
              You've completed the vocabulary drill.
            </p>
            <Link href="/account">
              <Button variant="primary" size="lg" fullWidth>
                Continue Learning
              </Button>
            </Link>
          </Card>
        </div>
        
        <BottomNav />
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="min-h-screen bg-white pb-20 md:pb-0">
        <div className="h-6"></div>
        <Header title="Review Your Answers" />
        
        <div className="max-w-md mx-auto px-4 py-6">
          <Card className="mb-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Your Answers
            </h2>
            <div className="space-y-4">
              {targetSentences.map((sentence: any, index: number) => (
                <div key={index} className="border-b pb-4 last:border-0">
                  <div className="flex items-start gap-2 mb-2">
                    {sentence.word && (
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700">
                          Word: {sentence.word}
                        </p>
                        {sentence.wordTranslation && (
                          <p className="text-xs text-gray-500">
                            Translation: {sentence.wordTranslation}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Sentence: {sentence.text}
                  </p>
                  {sentence.translation && (
                    <p className="text-xs text-gray-500 mb-2">
                      Translation: {sentence.translation}
                    </p>
                  )}
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Your answer:</p>
                    <p className="text-sm font-medium text-gray-900">
                      {answers[index] || "No answer provided"}
                    </p>
                    {attempts[index] > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Attempts: {attempts[index]}
                      </p>
                    )}
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

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      <div className="h-6"></div>
      <Header title={drill.title} />
      
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Question {currentIndex + 1} of {targetSentences.length}</span>
            <span>{Math.round(((currentIndex + 1) / targetSentences.length) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${((currentIndex + 1) / targetSentences.length) * 100}%` }}
            />
          </div>
        </div>

        <Card className="mb-4">
          {currentSentence && (
            <div>
              {currentSentence.word && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Vocabulary Word
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-bold text-gray-900">
                      {currentSentence.word}
                    </p>
                    <TTSButton text={currentSentence.word} />
                  </div>
                  {currentSentence.wordTranslation && (
                    <p className="text-xs text-gray-500 mt-1">
                      {currentSentence.wordTranslation}
                    </p>
                  )}
                </div>
              )}
              
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Sentence to Practice
                </p>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <p className="text-base text-gray-900 flex-1">
                    {currentSentence.text}
                  </p>
                  <TTSButton text={currentSentence.text} />
                </div>
                {currentSentence.translation && (
                  <p className="text-xs text-gray-500 mt-2">
                    Translation: {currentSentence.translation}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Practice saying this sentence:
                </label>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  rows={3}
                  placeholder="Type or speak your answer here..."
                  value={answers[currentIndex] || ""}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                />
              </div>
            </div>
          )}
        </Card>

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
          >
            {currentIndex === targetSentences.length - 1 ? "Review" : "Next"}
          </Button>
          {!hasAnswer && (
            <p className="text-xs text-red-500 mt-1 text-center">
              Please provide an answer before proceeding
            </p>
          )}
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}

