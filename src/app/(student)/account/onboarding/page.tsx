"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  Briefcase,
  GraduationCap,
  Compass,
  Users,
  MessageCircle,
  Plane,
  FileText,
  Languages,
  Check,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useAuthStore } from "@/store/auth-store";
import { userAPI } from "@/lib/api";
import { toast } from "sonner";

const { useAuthStore: useAuthStoreDirect } = require("@/store/auth-store");

const TOTAL_STEPS = 5;

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, checkSession } = useAuthStore();

  const {
    name,
    userType,
    learningGoal,
    nationality,
    language,
    setName,
    setUserType,
    setLearningGoal,
    setNationality,
    setLanguage,
    getFormattedData,
    reset,
  } = useOnboardingStore();

  // Initialize name from user if available
  useEffect(() => {
    if (user && !name) {
      const userName =
        user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim();
      if (userName) {
        setName(userName);
      }
    }
  }, [user, name, setName]);

  const userTypes = [
    {
      id: "professional",
      label: "Professional",
      Icon: Briefcase,
      description: "For work and career",
    },
    {
      id: "student",
      label: "Student",
      Icon: GraduationCap,
      description: "For academic purposes",
    },
    {
      id: "browsing",
      label: "Just browsing",
      Icon: Compass,
      description: "Exploring and learning",
    },
    {
      id: "ancestor",
      label: "Ancestor",
      Icon: Users,
      description: "For family and heritage",
    },
  ];

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

  const languages = [
    { id: "korean", label: "Korean", native: "한국인" },
    { id: "spanish", label: "Spanish", native: "Español" },
    { id: "chinese", label: "Chinese (Simplified)", native: "中国人" },
    { id: "portuguese", label: "Portuguese", native: "Alemão" },
    { id: "arabic", label: "Arabic", native: "عربي" },
    { id: "french", label: "French", native: "Français" },
    { id: "english", label: "English", native: "" },
    { id: "japanese", label: "Japanese", native: "日本語" },
    { id: "polish", label: "Polish", native: "Polski" },
  ];

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!name.trim();
      case 2:
        return !!userType;
      case 3:
        return !!learningGoal;
      case 4:
        return !!nationality;
      case 5:
        return !!language;
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

      // Refresh user data to get updated hasProfile status
      await checkSession(true); // Force refresh to get updated hasProfile

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
              Who will use Eklan today?
            </h1>
            <p className="text-base text-gray-600 mb-8">
              Help us personalize your experience
            </p>
            <div className="space-y-3">
              {userTypes.map((type) => {
                const Icon = type.Icon;
                const isSelected = userType === type.id;

                return (
                  <button
                    key={type.id}
                    onClick={() => setUserType(type.id)}
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
                            isSelected
                              ? "bg-green-100"
                              : type.id === "ancestor"
                              ? "bg-yellow-100"
                              : "bg-gray-100"
                          }`}
                        >
                          <Icon
                            className={`w-6 h-6 ${
                              isSelected
                                ? "text-green-600"
                                : type.id === "ancestor"
                                ? "text-yellow-600"
                                : "text-gray-600"
                            }`}
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-gray-900 mb-1">
                            {type.label}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {type.description}
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
          </div>
        );

      case 3:
        return (
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Why are you learning English?
            </h1>
            <p className="text-base text-gray-600 mb-8">
              Select the main reason to personalize your learning experience
            </p>
            <div className="space-y-3">
              {goals.map((goal) => {
                const Icon = goal.Icon;
                const isSelected = learningGoal === goal.id;

                return (
                  <button
                    key={goal.id}
                    onClick={() => setLearningGoal(goal.id)}
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
          </div>
        );

      case 4:
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

      case 5:
        return (
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              What language should the app use?
            </h1>
            <p className="text-base text-gray-600 mb-8">
              Choose your preferred language for the app interface
            </p>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {languages.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setLanguage(lang.label)}
                  className="w-full text-left"
                >
                  <Card
                    className={`transition-all ${
                      language === lang.label
                        ? "bg-green-50 ring-2 ring-green-600"
                        : "hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                          <Languages className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <p className="text-base font-semibold text-gray-900">
                            {lang.label}
                          </p>
                          {lang.native && (
                            <p className="text-sm text-gray-500">
                              {lang.native}
                            </p>
                          )}
                        </div>
                      </div>
                      {language === lang.label && (
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
              className="flex-1 items-center flex justify-center"
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
              className="flex-1 flex items-center justify-center"
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
            className="flex-1 items-center justify-center flex"
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
