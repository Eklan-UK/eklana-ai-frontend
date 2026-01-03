"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Check, Globe } from "lucide-react";
import { useRouter } from "next/navigation";

export default function OnboardingNationalityPage() {
  const router = useRouter();
  const [selected, setSelected] = useState("Korean");

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

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      {/* Progress Indicator */}
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
          {nationalities.map((nationality) => (
            <button
              key={nationality.id}
              onClick={() => setSelected(nationality.label)}
              className="w-full text-left"
            >
              <Card
                className={`transition-all ${
                  selected === nationality.label
                    ? "bg-green-50 ring-2 ring-green-600"
                    : "hover:shadow-md"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{nationality.flag}</span>
                    <div>
                      <p className="text-base font-semibold text-gray-900">
                        {nationality.label}
                      </p>
                      <p className="text-sm text-gray-500">
                        {nationality.native}
                      </p>
                    </div>
                  </div>
                  {selected === nationality.label && (
                    <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              </Card>
            </button>
          ))}
        </div>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => router.push("/account/onboarding/language")}
        >
          Done
        </Button>
      </div>
    </div>
  );
}

