"use client";

import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Check, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useAuthStore } from "@/store/auth-store";
import { userAPI } from "@/lib/api";
import { markProfileComplete } from "@/utils/auth-flow";
import { toast } from "sonner";
import { NATIONALITY_OPTIONS } from "@/lib/nationalities";
import {
  nationalityLabelToAppLanguage,
  shouldOfferLanguageSwitchForNationality,
} from "@/lib/nationality-language";
import { NationalityOptionRow } from "@/components/account/NationalityOptionRow";
import { NationalityLanguageConfirmSheet } from "@/components/account/NationalityLanguageConfirmSheet";
import { useTranslations } from "next-intl";
import { getUserDisplayName } from "@/utils/user";
import { LearningGoalCards } from "@/components/onboarding/LearningGoalCards";

const TOTAL_STEPS = 3;

export default function OnboardingPage() {
  const router = useRouter();
  const tAccount = useTranslations("account");
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nationalityModalOpen, setNationalityModalOpen] = useState(false);
  const nationalityRevertRef = useRef<string | null>(null);
  const { user } = useAuthStore();

  const {
    name,
    learningGoals,
    nationality,
    language,
    setName,
    setUserType,
    setLearningGoals,
    setNationality,
    setLanguage,
    getFormattedData,
    reset,
  } = useOnboardingStore();

  const displayName =
    name?.trim() || getUserDisplayName(user)?.trim() || tAccount("guestName");

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

  /** Migrate persisted multi-select to single-select for learning goals. */
  useEffect(() => {
    const goals = useOnboardingStore.getState().learningGoals;
    if (goals.length > 1) {
      setLearningGoals([goals[0]]);
    }
  }, [setLearningGoals]);

  const handlePickNationality = (label: string) => {
    const previous = nationality;
    setNationality(label);
    if (shouldOfferLanguageSwitchForNationality(label, language)) {
      nationalityRevertRef.current = previous;
      setNationalityModalOpen(true);
    }
  };

  const dismissNationalityModal = () => {
    setNationalityModalOpen(false);
    setNationality(nationalityRevertRef.current);
    nationalityRevertRef.current = null;
  };

  const confirmNationalityLanguageSwitch = () => {
    if (nationality) {
      setLanguage(nationalityLabelToAppLanguage(nationality));
    }
    setNationalityModalOpen(false);
    nationalityRevertRef.current = null;
  };

  const keepNationalityLanguage = () => {
    setNationalityModalOpen(false);
    nationalityRevertRef.current = null;
  };

  const selectLearningGoal = (goalId: string) => {
    setLearningGoals([goalId]);
  };

  const selectedGoalId = learningGoals[0] ?? null;

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

      // Refresh session from the server so Better Auth user.hasProfile matches the DB
      await useAuthStore.getState().checkSession(true);

      // Small delay to show success message
      setTimeout(() => {
        // Redirect to home
        router.push("/account");
      }, 1000);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to complete onboarding. Please try again."
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
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
              Why are you learning English?
            </h1>
            <LearningGoalCards
              selectedId={selectedGoalId}
              onSelect={selectLearningGoal}
            />
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
              {NATIONALITY_OPTIONS.map((nat) => (
                <button
                  key={nat.id}
                  type="button"
                  onClick={() => handlePickNationality(nat.label)}
                  className="w-full text-left"
                >
                  <Card
                    className={`transition-all ${
                      nationality === nat.label
                        ? "bg-green-50 ring-2 ring-green-600"
                        : "hover:shadow-md"
                    }`}
                  >
                    <NationalityOptionRow
                      option={nat}
                      trailing={
                        nationality === nat.label ? (
                          <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        ) : undefined
                      }
                    />
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

      <NationalityLanguageConfirmSheet
        open={nationalityModalOpen}
        displayName={displayName}
        nationalityLabel={nationality ?? ""}
        suggestedLanguage={nationalityLabelToAppLanguage(nationality ?? "")}
        currentLanguage={language}
        onSwitch={confirmNationalityLanguageSwitch}
        onKeep={keepNationalityLanguage}
        onDismiss={dismissNationalityModal}
      />
    </div>
  );
}
