"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function VoiceCalibrationPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [step, setStep] = useState(1);

  const steps = [
    {
      title: "Let's calibrate your voice",
      description: "We'll record a few sentences to understand your pronunciation",
      instruction: "Read the sentence below clearly:",
      sentence: "The quick brown fox jumps over the lazy dog.",
    },
    {
      title: "Great! Let's continue",
      description: "Read this sentence:",
      instruction: "Speak naturally and clearly:",
      sentence: "She sells seashells by the seashore.",
    },
    {
      title: "Almost done!",
      description: "One more sentence:",
      instruction: "Take your time:",
      sentence: "How much wood would a woodchuck chuck?",
    },
  ];

  const currentStep = steps[step - 1] || steps[0];

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Voice Calibration" />

      <div className="max-w-md mx-auto px-4 py-8 md:max-w-2xl md:px-8">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s <= step
                  ? "bg-green-600 w-8"
                  : "bg-gray-300 w-2"
              }`}
            />
          ))}
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            {currentStep.title}
          </h1>
          <p className="text-base text-gray-600">{currentStep.description}</p>
        </div>

        <Card className="mb-6">
          <div className="text-center py-8">
            {isRecording ? (
              <div className="space-y-4">
                <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center animate-pulse">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 40 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M20 8C18.3431 8 17 9.34315 17 11V19C17 20.6569 18.3431 22 20 22C21.6569 22 23 20.6569 23 19V11C23 9.34315 21.6569 8 20 8Z"
                      fill="#ef4444"
                    />
                    <path
                      d="M13 19C13 22.866 16.134 26 20 26C23.866 26 27 22.866 27 19"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M20 26V30M20 30C18.3431 30 17 31.3431 17 33H23C23 31.3431 21.6569 30 20 30Z"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  Recording...
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 40 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M20 8C18.3431 8 17 9.34315 17 11V19C17 20.6569 18.3431 22 20 22C21.6569 22 23 20.6569 23 19V11C23 9.34315 21.6569 8 20 8Z"
                      fill="#6b7280"
                    />
                    <path
                      d="M13 19C13 22.866 16.134 26 20 26C23.866 26 27 22.866 27 19"
                      stroke="#6b7280"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M20 26V30M20 30C18.3431 30 17 31.3431 17 33H23C23 31.3431 21.6569 30 20 30Z"
                      stroke="#6b7280"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  {currentStep.instruction}
                </p>
                <p className="text-xl md:text-2xl font-semibold text-gray-900">
                  {currentStep.sentence}
                </p>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          {!isRecording ? (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => setIsRecording(true)}
            >
              Start Recording
            </Button>
          ) : (
            <>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => {
                  setIsRecording(false);
                  if (step < 3) {
                    setStep(step + 1);
                  } else {
                    // Complete calibration
                  }
                }}
              >
                Stop Recording
              </Button>
              <Button
                variant="outline"
                size="lg"
                fullWidth
                onClick={() => setIsRecording(false)}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

