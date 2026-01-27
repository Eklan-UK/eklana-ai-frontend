"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Target,
  HelpCircle,
  ChevronRight,
  PartyPopper,
  RotateCcw,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import Link from "next/link";
import { dailyFocusAPI } from "@/lib/api";

interface DailyFocus {
  _id: string;
  title: string;
  focusType: string;
  practiceFormat: string;
  description?: string;
  estimatedMinutes: number;
  difficulty: string;
  showExplanationsAfterSubmission: boolean;
  fillInBlankQuestions: Array<{
    sentence: string;
    sentenceAudioUrl?: string;
    correctAnswer: string;
    options?: string[];
    optionsAudioUrls?: string[];
    hint?: string;
    explanation?: string;
  }>;
  matchingQuestions: Array<{
    left: string;
    leftAudioUrl?: string;
    right: string;
    rightAudioUrl?: string;
    hint?: string;
    explanation?: string;
  }>;
  multipleChoiceQuestions: Array<{
    question: string;
    questionAudioUrl?: string;
    options: string[];
    optionsAudioUrls?: string[];
    correctIndex: number;
    hint?: string;
    explanation?: string;
  }>;
  vocabularyQuestions: Array<{
    word: string;
    wordAudioUrl?: string;
    definition: string;
    definitionAudioUrl?: string;
    exampleSentence?: string;
    exampleAudioUrl?: string;
    pronunciation?: string;
    hint?: string;
    explanation?: string;
  }>;
  totalQuestions: number;
}

type QuestionType = "fillInBlank" | "matching" | "multipleChoice" | "vocabulary";

interface UserAnswer {
  type: QuestionType;
  index: number;
  answer: string | number;
  isCorrect?: boolean;
}

export default function DailyFocusPracticePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [dailyFocus, setDailyFocus] = useState<DailyFocus | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<UserAnswer[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState<string>("");
  const [showHint, setShowHint] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);
  const [startTime] = useState(Date.now());
  const [badgeUnlocked, setBadgeUnlocked] = useState<any>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Play pre-generated audio from URL
  const playAudio = (audioUrl: string | undefined, id: string) => {
    if (!audioUrl) {
      toast.error("Audio not available");
      return;
    }
    
    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    setPlayingAudio(id);
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    audio.onended = () => {
      setPlayingAudio(null);
      audioRef.current = null;
    };
    
    audio.onerror = () => {
      setPlayingAudio(null);
      audioRef.current = null;
      toast.error("Failed to play audio");
    };
    
    audio.play().catch(() => {
      setPlayingAudio(null);
      toast.error("Failed to play audio");
    });
  };

  // Build flat list of all questions
  const [allQuestions, setAllQuestions] = useState<
    Array<{
      type: QuestionType;
      data: any;
      index: number;
    }>
  >([]);

  useEffect(() => {
    fetchDailyFocus();
  }, [id]);

  // Load cached progress on mount
  useEffect(() => {
    if (dailyFocus && id) {
      loadProgress();
    }
  }, [dailyFocus, id]);

  // Auto-save progress
  useEffect(() => {
    if (dailyFocus && answers.length > 0) {
      // Clear existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      // Set new timeout for auto-save
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveProgress();
      }, 2000); // Save 2 seconds after last change
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [answers, currentQuestionIndex, dailyFocus]);

  // Save progress on unmount
  useEffect(() => {
    return () => {
      if (dailyFocus && answers.length > 0) {
        saveProgress();
      }
    };
  }, []);

  const fetchDailyFocus = async () => {
    try {
      setLoading(true);
      const response = await dailyFocusAPI.getById(id);
      const data = response.dailyFocus || response.data?.dailyFocus;

      if (!data) {
        throw new Error("Failed to fetch daily focus");
      }

      setDailyFocus(data);

      // Build flat question list
      const questions: Array<{ type: QuestionType; data: any; index: number }> = [];
      
      data.fillInBlankQuestions?.forEach((q: any, i: number) => {
        questions.push({ type: "fillInBlank", data: q, index: i });
      });
      
      data.matchingQuestions?.forEach((q: any, i: number) => {
        questions.push({ type: "matching", data: q, index: i });
      });
      
      data.multipleChoiceQuestions?.forEach((q: any, i: number) => {
        questions.push({ type: "multipleChoice", data: q, index: i });
      });
      
      data.vocabularyQuestions?.forEach((q: any, i: number) => {
        questions.push({ type: "vocabulary", data: q, index: i });
      });

      setAllQuestions(questions);
    } catch (error: any) {
      toast.error(error.message || "Failed to load practice");
      router.push("/account");
    } finally {
      setLoading(false);
    }
  };

  // Load cached progress
  const loadProgress = async () => {
    try {
      const response = await dailyFocusAPI.getProgress(id);
      const progress = response.data?.progress;

      if (progress && !progress.isCompleted) {
        // Restore progress
        setCurrentQuestionIndex(progress.currentQuestionIndex || 0);
        
        // Restore answers
        const restoredAnswers: UserAnswer[] = progress.answers
          .filter((a: any) => a.isSubmitted)
          .map((a: any) => ({
            type: a.questionType as QuestionType,
            index: a.questionIndex,
            answer: a.userAnswer,
            isCorrect: a.isCorrect,
          }));
        setAnswers(restoredAnswers);

        // Check if we need to set current answer for current question
        const currentAnswerData = progress.answers.find(
          (a: any) => a.questionIndex === progress.currentQuestionIndex && !a.isSubmitted
        );
        if (currentAnswerData) {
          setCurrentAnswer(currentAnswerData.userAnswer || "");
        }
      } else if (progress?.isCompleted) {
        // Already completed - set practice mode
        setIsCompleted(true);
        setIsPracticeMode(true);
        toast.info("You've already completed this today. This is practice mode.");
      }
    } catch (error: any) {
      // No progress found or error - start fresh
      console.log("No cached progress found");
    }
  };

  // Save progress
  const saveProgress = async () => {
    if (!dailyFocus || isCompleted) return;

    try {
      const progressAnswers = allQuestions.map((q, idx) => {
        const answer = answers.find(a => a.index === q.index && a.type === q.type);
        return {
          questionType: q.type,
          questionIndex: q.index,
          userAnswer: answer?.answer || (idx === currentQuestionIndex ? currentAnswer : ""),
          isCorrect: answer?.isCorrect,
          isSubmitted: !!answer,
        };
      });

      await dailyFocusAPI.saveProgress(id, {
        currentQuestionIndex,
        answers: progressAnswers,
        isCompleted: false,
      });
    } catch (error: any) {
      console.error("Failed to save progress:", error);
      // Don't show error toast for auto-save failures
    }
  };

  const currentQuestion = allQuestions[currentQuestionIndex];
  const totalQuestions = allQuestions.length;
  const progress = totalQuestions > 0 ? ((currentQuestionIndex + 1) / totalQuestions) * 100 : 0;

  const handleSubmitAnswer = () => {
    if (!currentQuestion) return;

    let isCorrect = false;
    const { type, data, index } = currentQuestion;

    if (type === "fillInBlank") {
      isCorrect = currentAnswer.toLowerCase().trim() === data.correctAnswer.toLowerCase().trim();
    } else if (type === "multipleChoice") {
      isCorrect = parseInt(currentAnswer) === data.correctIndex;
    } else if (type === "matching") {
      isCorrect = currentAnswer.toLowerCase().trim() === data.right.toLowerCase().trim();
    } else if (type === "vocabulary") {
      // For vocabulary, check if they can recall the definition
      isCorrect = currentAnswer.toLowerCase().includes(data.definition.toLowerCase().substring(0, 20));
    }

    const newAnswer: UserAnswer = {
      type,
      index,
      answer: currentAnswer,
      isCorrect,
    };

    setAnswers([...answers, newAnswer]);
    setIsSubmitted(true);

    if (isCorrect) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ["#22c55e", "#16a34a"],
      });
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setCurrentAnswer("");
      setShowHint(false);
      setIsSubmitted(false);
      saveProgress(); // Save when moving to next question
    } else {
      // Show final results
      setShowResults(true);
      const correctCount = answers.filter((a) => a.isCorrect).length;
      if (correctCount === totalQuestions) {
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors: ["#22c55e", "#16a34a", "#fbbf24", "#f59e0b"],
        });
      }
    }
  };

  // Submit completion
  const handleComplete = async () => {
    if (!dailyFocus) return;

    const correctCount = answers.filter((a) => a.isCorrect).length;
    const score = Math.round((correctCount / totalQuestions) * 100);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    // Validate all questions answered
    if (answers.length !== totalQuestions) {
      toast.error("Please answer all questions before submitting");
      return;
    }

    // Check if score >= 70%
    if (score < 70) {
      toast.error("You need at least 70% to complete the daily focus. Keep practicing!");
      return;
    }

    // If already completed (practice mode), don't submit
    if (isPracticeMode || isCompleted) {
      toast.info("You've already completed this today. This is practice mode.");
      return;
    }

    setIsSubmittingCompletion(true);

    try {
      const response = await dailyFocusAPI.complete(id, {
        score,
        correctAnswers: correctCount,
        totalQuestions,
        timeSpent,
        answers: answers.map(a => ({
          questionType: a.type,
          questionIndex: a.index,
          userAnswer: a.answer,
          isCorrect: a.isCorrect,
        })),
      });

      const result = response.data || response;
      
      if (result.streakUpdated) {
        toast.success("Daily focus completed! Your streak has been updated! 🔥");
      } else {
        toast.success("Daily focus completed!");
      }

      if (result.badgeUnlocked) {
        setBadgeUnlocked(result.badgeUnlocked);
        // Show badge unlock celebration
        confetti({
          particleCount: 200,
          spread: 120,
          origin: { y: 0.5 },
          colors: ["#fbbf24", "#f59e0b", "#d97706", "#92400e"],
        });
        toast.success(`🎉 Badge Unlocked: ${result.badgeUnlocked.badgeName}!`, {
          duration: 5000,
        });
      }

      setIsCompleted(true);
    } catch (error: any) {
      console.error("Failed to submit completion:", error);
      toast.error(error.message || "Failed to submit completion");
    } finally {
      setIsSubmittingCompletion(false);
    }
  };

  const renderQuestion = () => {
    if (!currentQuestion) return null;

    const { type, data } = currentQuestion;

    switch (type) {
      case "fillInBlank":
        return (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-2xl p-6">
              <div className="flex items-start justify-between gap-3">
                <p className="text-lg text-gray-900 leading-relaxed flex-1">
                  {data.sentence.split("___").map((part: string, i: number, arr: string[]) => (
                    <span key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        <span className="inline-block min-w-[100px] border-b-2 border-green-500 mx-1">
                          {isSubmitted ? (
                            <span className={answers[currentQuestionIndex]?.isCorrect ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                              {currentAnswer || "___"}
                            </span>
                          ) : (
                            "___"
                          )}
                        </span>
                      )}
                    </span>
                  ))}
                </p>
                {data.sentenceAudioUrl && (
                  <button
                    onClick={() => playAudio(data.sentenceAudioUrl, `fib-sentence-${currentQuestion.index}`)}
                    className={`p-2 rounded-full transition-all ${
                      playingAudio === `fib-sentence-${currentQuestion.index}`
                        ? "bg-green-100 text-green-600 animate-pulse"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {!isSubmitted && (
              <>
                {data.options && data.options.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {data.options.map((option: string, i: number) => (
                      <button
                        key={i}
                        onClick={() => setCurrentAnswer(option)}
                        className={`p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                          currentAnswer === option
                            ? "border-green-500 bg-green-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <span>{option}</span>
                        {data.optionsAudioUrls?.[i] && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              playAudio(data.optionsAudioUrls[i], `fib-option-${currentQuestion.index}-${i}`);
                            }}
                            className={`p-1.5 rounded-full ${
                              playingAudio === `fib-option-${currentQuestion.index}-${i}`
                                ? "bg-green-200 text-green-700 animate-pulse"
                                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                            }`}
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
                    autoFocus
                  />
                )}
              </>
            )}

            {isSubmitted && !answers[currentQuestionIndex]?.isCorrect && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-red-700 font-medium">
                  Correct answer: <span className="font-bold">{data.correctAnswer}</span>
                </p>
              </div>
            )}
          </div>
        );

      case "multipleChoice":
        return (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-2xl p-6">
              <div className="flex items-start justify-between gap-3">
                <p className="text-lg text-gray-900 flex-1">{data.question}</p>
                {data.questionAudioUrl && (
                  <button
                    onClick={() => playAudio(data.questionAudioUrl, `mc-question-${currentQuestion.index}`)}
                    className={`p-2 rounded-full transition-all ${
                      playingAudio === `mc-question-${currentQuestion.index}`
                        ? "bg-green-100 text-green-600 animate-pulse"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {data.options.map((option: string, i: number) => {
                const isSelected = currentAnswer === String(i);
                const isCorrectOption = i === data.correctIndex;
                
                let optionClass = "border-gray-200 hover:border-gray-300";
                if (isSubmitted) {
                  if (isCorrectOption) {
                    optionClass = "border-green-500 bg-green-50";
                  } else if (isSelected && !isCorrectOption) {
                    optionClass = "border-red-500 bg-red-50";
                  }
                } else if (isSelected) {
                  optionClass = "border-green-500 bg-green-50";
                }

                return (
                  <button
                    key={i}
                    onClick={() => !isSubmitted && setCurrentAnswer(String(i))}
                    disabled={isSubmitted}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${optionClass}`}
                  >
                    <span className="w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-sm font-bold shrink-0">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1">{option}</span>
                    {data.optionsAudioUrls?.[i] && !isSubmitted && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playAudio(data.optionsAudioUrls[i], `mc-option-${currentQuestion.index}-${i}`);
                        }}
                        className={`p-1.5 rounded-full shrink-0 ${
                          playingAudio === `mc-option-${currentQuestion.index}-${i}`
                            ? "bg-green-200 text-green-700 animate-pulse"
                            : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                        }`}
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    )}
                    {isSubmitted && isCorrectOption && (
                      <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                    )}
                    {isSubmitted && isSelected && !isCorrectOption && (
                      <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case "matching":
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 rounded-2xl p-6">
              <p className="text-sm text-blue-600 font-medium mb-2">Match this:</p>
              <div className="flex items-center justify-between gap-3">
                <p className="text-2xl font-bold text-gray-900">{data.left}</p>
                {data.leftAudioUrl && (
                  <button
                    onClick={() => playAudio(data.leftAudioUrl, `match-left-${currentQuestion.index}`)}
                    className={`p-2 rounded-full transition-all ${
                      playingAudio === `match-left-${currentQuestion.index}`
                        ? "bg-blue-200 text-blue-700 animate-pulse"
                        : "bg-white/50 text-blue-600 hover:bg-white"
                    }`}
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {!isSubmitted ? (
              <input
                type="text"
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                placeholder="Type the matching word/phrase..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
                autoFocus
              />
            ) : (
              <div className={`rounded-xl p-4 ${answers[currentQuestionIndex]?.isCorrect ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                <div className="flex items-center justify-between">
                  <p className="font-medium">
                    {answers[currentQuestionIndex]?.isCorrect ? (
                      <span className="text-green-700">Correct! ✓</span>
                    ) : (
                      <span className="text-red-700">
                        Correct answer: <span className="font-bold">{data.right}</span>
                      </span>
                    )}
                  </p>
                  {data.rightAudioUrl && (
                    <button
                      onClick={() => playAudio(data.rightAudioUrl, `match-right-${currentQuestion.index}`)}
                      className={`p-2 rounded-full transition-all ${
                        playingAudio === `match-right-${currentQuestion.index}`
                          ? "bg-green-200 text-green-700 animate-pulse"
                          : "bg-white text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case "vocabulary":
        // Check if this is grammar focus type (hide definition)
        const isGrammarFocus = dailyFocus?.focusType === "grammar";
        
        return (
          <div className="space-y-6">
            <div className="bg-purple-50 rounded-2xl p-6 text-center">
              <p className="text-sm text-purple-600 font-medium mb-2">
                {isGrammarFocus ? "Use this word correctly:" : "Define this word:"}
              </p>
              <div className="flex items-center justify-center gap-3">
                <p className="text-3xl font-bold text-gray-900">{data.word}</p>
                {data.wordAudioUrl && (
                  <button
                    onClick={() => playAudio(data.wordAudioUrl, `vocab-word-${currentQuestion.index}`)}
                    className={`p-2 rounded-full transition-all ${
                      playingAudio === `vocab-word-${currentQuestion.index}`
                        ? "bg-purple-200 text-purple-700 animate-pulse"
                        : "bg-white/50 text-purple-600 hover:bg-white"
                    }`}
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                )}
              </div>
              {data.pronunciation && (
                <p className="text-gray-500 mt-2">{data.pronunciation}</p>
              )}
            </div>

            {!isSubmitted ? (
              <textarea
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                placeholder={isGrammarFocus ? "Use the word in a sentence..." : "Type the definition..."}
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none resize-none"
                autoFocus
              />
            ) : (
              <div className="space-y-4">
                {/* Only show definition if not grammar focus */}
                {!isGrammarFocus && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm text-green-600 font-medium mb-1">Definition:</p>
                        <p className="text-gray-900">{data.definition}</p>
                      </div>
                      {data.definitionAudioUrl && (
                        <button
                          onClick={() => playAudio(data.definitionAudioUrl, `vocab-def-${currentQuestion.index}`)}
                          className={`p-2 rounded-full transition-all shrink-0 ${
                            playingAudio === `vocab-def-${currentQuestion.index}`
                              ? "bg-green-200 text-green-700 animate-pulse"
                              : "bg-white text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {data.exampleSentence && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm text-gray-500 font-medium mb-1">Example:</p>
                        <p className="text-gray-700 italic">"{data.exampleSentence}"</p>
                      </div>
                      {data.exampleAudioUrl && (
                        <button
                          onClick={() => playAudio(data.exampleAudioUrl, `vocab-example-${currentQuestion.index}`)}
                          className={`p-2 rounded-full transition-all shrink-0 ${
                            playingAudio === `vocab-example-${currentQuestion.index}`
                              ? "bg-gray-300 text-gray-700 animate-pulse"
                              : "bg-white text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (!dailyFocus) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">Daily focus not found</p>
      </div>
    );
  }

  // Results screen
  if (showResults) {
    const correctCount = answers.filter((a) => a.isCorrect).length;
    const score = Math.round((correctCount / totalQuestions) * 100);

    return (
      <div className="min-h-screen bg-white pb-20">
        <div className="max-w-md mx-auto px-4 py-8">
          <Card className="text-center py-8">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mb-6">
              {score >= 70 ? (
                <PartyPopper className="w-12 h-12 text-white" />
              ) : (
                <Target className="w-12 h-12 text-white" />
              )}
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {score >= 70 ? "Great Job!" : "Keep Practicing!"}
            </h1>

            {isPracticeMode && (
              <div className="mb-4 px-4 py-2 bg-yellow-100 border border-yellow-300 rounded-lg">
                <p className="text-sm text-yellow-800 font-medium">Practice Mode</p>
                <p className="text-xs text-yellow-700">This attempt won't count toward your streak</p>
              </div>
            )}

            {badgeUnlocked && (
              <div className="mb-4 px-4 py-3 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-lg text-white">
                <p className="text-lg font-bold mb-1">🎉 Badge Unlocked!</p>
                <p className="text-sm">{badgeUnlocked.badgeName}</p>
              </div>
            )}

            <p className="text-gray-600 mb-6">
              You scored <span className="font-bold text-green-600">{score}%</span>
            </p>

            <div className="flex justify-center gap-8 mb-8">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{correctCount}</p>
                <p className="text-sm text-gray-500">Correct</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-red-500">{totalQuestions - correctCount}</p>
                <p className="text-sm text-gray-500">Incorrect</p>
              </div>
            </div>

            {score < 70 && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 font-medium mb-1">Score too low</p>
                <p className="text-xs text-red-600">
                  You need at least 70% to complete the daily focus. Keep practicing!
                </p>
              </div>
            )}

            <div className="space-y-3">
              {score >= 70 && !isPracticeMode && !isCompleted && (
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={handleComplete}
                  disabled={isSubmittingCompletion}
                >
                  {isSubmittingCompletion ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Complete Daily Focus"
                  )}
                </Button>
              )}
              
              <Link href="/account">
                <Button variant="primary" size="lg" fullWidth>
                  Back to Dashboard
                </Button>
              </Link>
              
              <Button
                variant="outline"
                size="lg"
                fullWidth
                onClick={() => {
                  setCurrentQuestionIndex(0);
                  setAnswers([]);
                  setCurrentAnswer("");
                  setIsSubmitted(false);
                  setShowResults(false);
                  setShowHint(false);
                  setIsPracticeMode(true);
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-6">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.back()}
              className="p-2 bg-white/20 rounded-full hover:bg-white/30"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <p className="text-sm text-green-100">Today's Focus</p>
              <h1 className="text-lg font-bold">{dailyFocus.title}</h1>
              {isPracticeMode && (
                <p className="text-xs text-green-200 mt-1">Practice Mode</p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-white/20 rounded-full h-2">
              <div
                className="bg-white rounded-full h-2 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm font-medium">
              {currentQuestionIndex + 1}/{totalQuestions}
            </span>
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="max-w-md mx-auto px-4 py-6">
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-500 capitalize">
              {currentQuestion?.type.replace(/([A-Z])/g, " $1").trim()}
            </span>
            {currentQuestion?.data.hint && !isSubmitted && (
              <button
                onClick={() => setShowHint(!showHint)}
                className="flex items-center gap-1 text-sm text-blue-600"
              >
                <HelpCircle className="w-4 h-4" />
                {showHint ? "Hide" : "Show"} Hint
              </button>
            )}
          </div>

          {showHint && currentQuestion?.data.hint && !isSubmitted && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-sm text-blue-700">{currentQuestion.data.hint}</p>
            </div>
          )}

          {renderQuestion()}

          {/* Explanation after submission */}
          {isSubmitted && dailyFocus.showExplanationsAfterSubmission && currentQuestion?.data.explanation && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-sm font-medium text-amber-700 mb-1">Explanation:</p>
              <p className="text-sm text-amber-800">{currentQuestion.data.explanation}</p>
            </div>
          )}
        </Card>

        {/* Action buttons */}
        <div className="space-y-3">
          {!isSubmitted ? (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleSubmitAnswer}
              disabled={!currentAnswer}
            >
              Check Answer
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleNext}
            >
              {currentQuestionIndex < totalQuestions - 1 ? (
                <>
                  Next Question
                  <ChevronRight className="w-5 h-5 ml-2" />
                </>
              ) : (
                "See Results"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

