"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  Briefcase,
  MessageCircle,
  Plane,
  FileText,
  Check,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useAuthStore } from "@/store/auth-store";
import { userAPI } from "@/lib/api";
import { markProfileComplete } from "@/utils/auth-flow";
import { toast } from "sonner";

const TOTAL_STEPS = 3;

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuthStore();

  const {
    name,
    learningGoals,
    nationality,
    setName,
    setUserType,
    setLearningGoals,
    setNationality,
    getFormattedData,
    reset,
  } = useOnboardingStore();

  // Initialize name from user if available and set userType to student
  useEffect(() => {
    // Always set userType to student
    setUserType("student");

    if (user && !name) {
      const userName =
        user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim();
      if (userName) {
        setName(userName);
      }
    }
  }, [user, name, setName, setUserType]);

  const goals = [
    {
      id: "conversations",
      label: "Speak naturally in conversations",
      Icon: MessageCircle,
      description: "Improve your everyday speaking skills",
    },
    {
      id: "professional",
      label: "Sound professional at work",
      Icon: Briefcase,
      description: "Enhance your workplace communication",
    },
    {
      id: "travel",
      label: "Travel confidently",
      Icon: Plane,
      description: "Master travel-related conversations",
    },
    {
      id: "interviews",
      label: "Prepare for Interviews",
      Icon: FileText,
      description: "Ace your job interviews",
    },
  ];

  const nationalities = [
    { id: "korean", label: "Korean", native: "한국인", flag: "🇰🇷" },
    { id: "spanish", label: "Spanish", native: "Español", flag: "🇪🇸" },
    { id: "chinese", label: "Chinese", native: "中国人", flag: "🇨🇳" },
    { id: "german", label: "German", native: "Deutsch", flag: "🇩🇪" },
    { id: "russian", label: "Russian", native: "Русский", flag: "🇷🇺" },
    { id: "french", label: "French", native: "Français", flag: "🇫🇷" },
    { id: "english", label: "English", native: "English", flag: "🇺🇸" },
    { id: "japanese", label: "Japanese", native: "日本語", flag: "🇯🇵" },
  ];

  const toggleGoal = (goalId: string) => {
    const newGoals = learningGoals.includes(goalId)
      ? learningGoals.filter((id) => id !== goalId)
      : [...learningGoals, goalId];
    setLearningGoals(newGoals);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!name.trim();
      case 2:
        return learningGoals.length > 0;
      case 3:
        return !!nationality;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed() && currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!canProceed()) {
      toast.error("Please complete all fields");
      return;
    }

    if (!user) {
      toast.error("Please log in to complete onboarding");
      router.push("/auth/login");
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedData = getFormattedData();

      await userAPI.onboard("user", formattedData);

      toast.success("Onboarding completed successfully!");

      // Clear onboarding data
      reset();

      // Mark profile as complete in auth store (cached locally)
      markProfileComplete();

      // Small delay to show success message
      setTimeout(() => {
        // Redirect to home
        router.push("/account");
      }, 1000);
    } catch (error: any) {
      toast.error(
        error?.message || "Failed to complete onboarding. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Confirm your name
            </h1>
            <p className="text-base text-gray-600 mb-8">
              What should we call you?
            </p>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full"
            />
          </div>
        );

      case 2:
        return (
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Why are you learning English?
            </h1>
            <p className="text-base text-gray-600 mb-8">
              Select all that apply to personalize your learning experience
            </p>
            <div className="space-y-3">
              {goals.map((goal) => {
                const Icon = goal.Icon;
                const isSelected = learningGoals.includes(goal.id);

                return (
                  <button
                    key={goal.id}
                    onClick={() => toggleGoal(goal.id)}
                    className="w-full text-left"
                  >
                    <Card
                      className={`transition-all ${
                        isSelected
                          ? "bg-green-50 ring-2 ring-green-600"
                          : "hover:shadow-md"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            isSelected ? "bg-green-100" : "bg-blue-100"
                          }`}
                        >
                          <Icon
                            className={`w-6 h-6 ${
                              isSelected ? "text-green-600" : "text-blue-600"
                            }`}
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-gray-900 mb-1">
                            {goal.label}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {goal.description}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                    </Card>
                  </button>
                );
              })}
            </div>
            {/* Selected count indicator */}
            {learningGoals.length > 0 && (
              <p className="text-sm text-gray-500 text-center mt-4">
                {learningGoals.length} goal{learningGoals.length > 1 ? "s" : ""} selected
              </p>
            )}
          </div>
        );

      case 3:
        return (
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              What&apos;s your nationality?
            </h1>
            <p className="text-base text-gray-600 mb-8">
              This helps us personalize your learning experience
            </p>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {nationalities.map((nat) => (
                <button
                  key={nat.id}
                  onClick={() => setNationality(nat.label)}
                  className="w-full text-left"
                >
                  <Card
                    className={`transition-all ${
                      nationality === nat.label
                        ? "bg-green-50 ring-2 ring-green-600"
                        : "hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">{nat.flag}</span>
                        <div>
                          <p className="text-base font-semibold text-gray-900">
                            {nat.label}
                          </p>
                          <p className="text-sm text-gray-500">{nat.native}</p>
                        </div>
                      </div>
                      {nationality === nat.label && (
                        <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack={currentStep === 1} title="Setup Your Profile" />

      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-2 py-4 px-4">
        {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
          <div
            key={index}
            className={`h-2 rounded-full transition-all ${
              index + 1 <= currentStep ? "bg-green-600 w-8" : "bg-gray-300 w-2"
            }`}
          />
        ))}
      </div>

      <div className="max-w-md mx-auto px-4 py-8 md:max-w-lg md:px-8">
        <div className="mb-8">
          <p className="text-sm text-gray-500 mb-4">
            Step {currentStep} of {TOTAL_STEPS}
          </p>
          <div className="transition-all duration-300 ease-in-out">
            {renderStepContent()}
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-4">
          {currentStep > 1 && (
            <Button
              variant="outline"
              size="lg"
              onClick={handleBack}
              disabled={isSubmitting}
              className="flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          {currentStep < TOTAL_STEPS ? (
            <Button
              variant="primary"
              size="lg"
              onClick={handleNext}
              disabled={!canProceed() || isSubmitting}
              className="flex-1"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              onClick={handleSubmit}
              disabled={!canProceed() || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                "Complete Setup"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
