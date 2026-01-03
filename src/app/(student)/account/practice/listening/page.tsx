"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TTSButton } from "@/components/ui/TTSButton";
import { Headphones, Play, Pause, CheckCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ListeningPracticePage() {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const router = useRouter();

  const questions = [
    {
      audio: "conversation-1",
      conversationText: "Hi, I'd like to book a vacation to Hawaii. Do you have any packages available for next month?",
      question: "What is the main topic of the conversation?",
      options: [
        "Planning a vacation",
        "Discussing work projects",
        "Ordering food at a restaurant",
        "Shopping for clothes",
      ],
      correct: 0,
    },
    {
      audio: "conversation-2",
      conversationText: "I'll have a cappuccino and a croissant, please. Can we sit by the window?",
      question: "Where does the conversation take place?",
      options: ["At home", "In an office", "At a cafe", "In a park"],
      correct: 2,
    },
  ];

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const current = questions[currentQuestion];

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Listening Practice" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {questions.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all ${
                index <= currentQuestion
                  ? "bg-green-600 w-8"
                  : "bg-gray-300 w-2"
              }`}
            />
          ))}
        </div>

        {/* Audio Player */}
        <Card className="mb-6 bg-gradient-to-br from-purple-50 to-blue-50">
          <div className="text-center py-8">
            <div className="w-24 h-24 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-6">
              <Headphones className="w-12 h-12 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Listen to the conversation
            </h3>
            <div className="flex items-center justify-center gap-4 mb-4">
              <TTSButton
                text={current.conversationText}
                size="lg"
                variant="button"
                autoPlay={true}
              />
            </div>
            {current.conversationText && (
              <p className="text-sm text-gray-600 italic max-w-md mx-auto px-4">
                &quot;{current.conversationText}&quot;
              </p>
            )}
          </div>
        </Card>

        {/* Question */}
        <Card className="mb-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex-1">
              {current.question}
            </h3>
            <TTSButton variant="button" text={current.question} size="sm"  autoPlay={true}/>
          </div>
          <div className="space-y-3">
            {current.options.map((option, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelectedAnswer(index);
                  setShowResult(true);
                }}
                disabled={showResult}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  showResult
                    ? index === current.correct
                      ? "border-green-600 bg-green-50"
                      : selectedAnswer === index
                      ? "border-red-600 bg-red-50"
                      : "border-gray-200"
                    : selectedAnswer === index
                    ? "border-green-600 bg-green-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base text-gray-900 flex-1">{option}</span>
                  <div className="flex items-center gap-2">
                    <TTSButton text={option} size="sm" autoPlay={true} />
                    {showResult && index === current.correct && (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                    {showResult &&
                      selectedAnswer === index &&
                      index !== current.correct && (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Feedback */}
        {showResult && (
          <Card
            className={`mb-6 ${
              selectedAnswer === current.correct
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-start gap-3">
              {selectedAnswer === current.correct ? (
                <CheckCircle className="w-6 h-6 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600 mt-0.5" />
              )}
              <div>
                <p
                  className={`text-sm font-semibold mb-1 ${
                    selectedAnswer === current.correct
                      ? "text-green-900"
                      : "text-red-900"
                  }`}
                >
                  {selectedAnswer === current.correct
                    ? "Correct! Well done!"
                    : "Incorrect. Try again!"}
                </p>
                {selectedAnswer !== current.correct && (
                  <p className="text-xs text-gray-600">
                    The correct answer is: {current.options[current.correct]}
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {showResult ? (
            currentQuestion < questions.length - 1 ? (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => {
                  setCurrentQuestion(currentQuestion + 1);
                  setSelectedAnswer(null);
                  setShowResult(false);
                  // setIsPlaying(false);
                }}
              >
                Next Question
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => router.push("/practice/listening/completed")}
              >
                Complete Practice
              </Button>
            )
          ) : (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={selectedAnswer === null}
              onClick={() => setShowResult(true)}
            >
              Check Answer
            </Button>
          )}
          <Button
            variant="outline"
            size="lg"
            fullWidth
            onClick={() => router.back()}
          >
            Back to Practice
          </Button>
        </div>
      </div>
    </div>
  );
}
