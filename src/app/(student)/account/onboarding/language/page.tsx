"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Check, Languages } from "lucide-react";
import { useRouter } from "next/navigation";

export default function OnboardingLanguagePage() {
  const router = useRouter();
  const [selected, setSelected] = useState("English");

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
        <div className="w-8 h-2 bg-green-600 rounded-full"></div>
        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
      </div>

      <div className="max-w-md mx-auto px-4 py-8 md:max-w-lg md:px-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            What language should the app use?
          </h1>
          <p className="text-base text-gray-600">
            Choose your preferred language for the app interface
          </p>
        </div>

        <div className="space-y-2 mb-8 max-h-96 overflow-y-auto">
          {languages.map((language) => (
            <button
              key={language.id}
              onClick={() => setSelected(language.label)}
              className="w-full text-left"
            >
              <Card
                className={`transition-all ${
                  selected === language.label
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
                        {language.label}
                      </p>
                      {language.native && (
                        <p className="text-sm text-gray-500">
                          {language.native}
                        </p>
                      )}
                    </div>
                  </div>
                  {selected === language.label && (
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
          onClick={() => router.push("/account/welcome")}
        >
          Done
        </Button>
      </div>
    </div>
  );
}

