"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { NATIONALITY_OPTIONS } from "@/lib/nationalities";
import {
  nationalityLabelToAppLanguage,
  shouldOfferLanguageSwitchForNationality,
} from "@/lib/nationality-language";
import { NationalityOptionRow } from "@/components/account/NationalityOptionRow";
import { NationalityLanguageConfirmSheet } from "@/components/account/NationalityLanguageConfirmSheet";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useAuthStore } from "@/store/auth-store";
import { getUserDisplayName } from "@/utils/user";
import { useTranslations } from "next-intl";

export default function OnboardingNationalityPage() {
  const router = useRouter();
  const tAccount = useTranslations("account");
  const { user } = useAuthStore();
  const [modalOpen, setModalOpen] = useState(false);
  const revertRef = useRef<string | null>(null);

  const {
    nationality,
    language,
    name,
    setNationality,
    setLanguage,
  } = useOnboardingStore();

  const displayName =
    name?.trim() || getUserDisplayName(user)?.trim() || tAccount("guestName");

  const handlePick = (label: string) => {
    const previous = nationality;
    setNationality(label);
    if (shouldOfferLanguageSwitchForNationality(label, language)) {
      revertRef.current = previous;
      setModalOpen(true);
    }
  };

  const onDismiss = () => {
    setModalOpen(false);
    setNationality(revertRef.current);
    revertRef.current = null;
  };

  const onSwitch = () => {
    if (nationality) {
      setLanguage(nationalityLabelToAppLanguage(nationality));
    }
    setModalOpen(false);
    revertRef.current = null;
  };

  const onKeep = () => {
    setModalOpen(false);
    revertRef.current = null;
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="h-6"></div>

      <div className="flex items-center justify-center gap-2 py-4">
        <div className="w-8 h-2 bg-green-600 rounded-full"></div>
        <div className="w-8 h-2 bg-green-600 rounded-full"></div>
        <div className="w-8 h-2 bg-green-600 rounded-full"></div>
        <div className="w-8 h-2 bg-green-600 rounded-full"></div>
        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
        <div className="w-2 bg-gray-300 rounded-full"></div>
      </div>

      <div className="max-w-md mx-auto px-4 py-8 md:max-w-lg md:px-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            What&apos;s your nationality?
          </h1>
          <p className="text-base text-gray-600">
            This helps us personalize your learning experience
          </p>
        </div>

        <div className="space-y-2 mb-8 max-h-96 overflow-y-auto">
          {NATIONALITY_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handlePick(option.label)}
              className="w-full text-left"
            >
              <Card
                className={`transition-all ${
                  nationality === option.label
                    ? "bg-green-50 ring-2 ring-green-600"
                    : "hover:shadow-md"
                }`}
              >
                <NationalityOptionRow
                  option={option}
                  trailing={
                    nationality === option.label ? (
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

        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!nationality}
          onClick={() => router.push("/account/onboarding/language")}
        >
          Done
        </Button>
      </div>

      <NationalityLanguageConfirmSheet
        open={modalOpen}
        displayName={displayName}
        nationalityLabel={nationality ?? ""}
        suggestedLanguage={nationalityLabelToAppLanguage(nationality ?? "")}
        currentLanguage={language}
        onSwitch={onSwitch}
        onKeep={onKeep}
        onDismiss={onDismiss}
      />
    </div>
  );
}
