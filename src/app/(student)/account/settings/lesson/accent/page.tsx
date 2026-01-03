"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Check, Globe } from "lucide-react";

export default function AccentPage() {
  const [selected, setSelected] = useState("British");

  const accents = [
    { id: "british", label: "British English", flag: "🇬🇧" },
    { id: "american", label: "American English", flag: "🇺🇸" },
    { id: "australian", label: "Australian English", flag: "🇦🇺" },
    { id: "canadian", label: "Canadian English", flag: "🇨🇦" },
    { id: "irish", label: "Irish English", flag: "🇮🇪" },
    { id: "neutral", label: "Neutral/International", flag: "🌍" },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="English Type / Accent" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        <div className="mb-6">
          <p className="text-base text-gray-600">
            Choose your preferred English accent or dialect for lessons and
            practice.
          </p>
        </div>

        <div className="space-y-2 mb-6">
          {accents.map((accent) => (
            <button
              key={accent.id}
              onClick={() => setSelected(accent.label)}
              className="w-full text-left"
            >
              <Card
                className={`transition-all ${
                  selected === accent.label
                    ? "bg-green-50 ring-2 ring-green-600"
                    : "hover:shadow-md"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl">{accent.flag}</div>
                    <div>
                      <p className="text-base font-semibold text-gray-900">
                        {accent.label}
                      </p>
                    </div>
                  </div>
                  {selected === accent.label && (
                    <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              </Card>
            </button>
          ))}
        </div>

        <Button variant="primary" size="lg" fullWidth>
          Save Preference
        </Button>

        {/* Info */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                About Accents
              </p>
              <p className="text-xs text-gray-600">
                Your selected accent will be used in AI conversations and
                pronunciation examples. You can change this anytime.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

