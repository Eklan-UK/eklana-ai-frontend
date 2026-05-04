"use client";

import { useEffect, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/store/onboarding-store";
import { LearningGoalCards } from "@/components/onboarding/LearningGoalCards";

export default function OnboardingLearningGoalsPage() {
  const router = useRouter();
  const learningGoals = useOnboardingStore((s) => s.learningGoals);
  const setLearningGoals = useOnboardingStore((s) => s.setLearningGoals);

  const migrateOnceRef = useRef(false);
  useEffect(() => {
    if (migrateOnceRef.current) return;
    migrateOnceRef.current = true;
    const g = useOnboardingStore.getState().learningGoals;
    if (g.length > 1) setLearningGoals([g[0]]);
  }, [setLearningGoals]);

  const selectedId = learningGoals[0] ?? null;

  const handleDone = () => {
    if (!learningGoals[0]) return;
    router.push("/account/onboarding/nationality");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="h-6 shrink-0" />

      <Header showBack />

      <div className="flex-1 max-w-md mx-auto px-4 py-6 md:max-w-lg md:px-8 w-full pb-28">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
          Why are you learning English?
        </h1>

        <LearningGoalCards
          selectedId={selectedId}
          onSelect={(id) => setLearningGoals([id])}
        />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto md:max-w-lg">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!learningGoals[0]}
            onClick={handleDone}
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
