"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Check, Volume2 } from "lucide-react";

export default function VoicePage() {
  const [selected, setSelected] = useState("Warm");

  const voices = [
    { id: "warm", label: "Warm", description: "Friendly and approachable" },
    { id: "professional", label: "Professional", description: "Clear and confident" },
    { id: "energetic", label: "Energetic", description: "Enthusiastic and lively" },
    { id: "calm", label: "Calm", description: "Relaxed and soothing" },
    { id: "neutral", label: "Neutral", description: "Balanced and clear" },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="eklan's Voice" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        <div className="mb-6">
          <p className="text-base text-gray-600">
            Choose the voice tone for eklan AI in your conversations and
            lessons.
          </p>
        </div>

        <div className="space-y-2 mb-6">
          {voices.map((voice) => (
            <button
              key={voice.id}
              onClick={() => setSelected(voice.label)}
              className="w-full text-left"
            >
              <Card
                className={`transition-all ${
                  selected === voice.label
                    ? "bg-green-50 ring-2 ring-green-600"
                    : "hover:shadow-md"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <Volume2 className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-gray-900">
                        {voice.label}
                      </p>
                      <p className="text-sm text-gray-500">
                        {voice.description}
                      </p>
                    </div>
                  </div>
                  {selected === voice.label && (
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
          Save Voice Preference
        </Button>

        {/* Preview */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Volume2 className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Preview Voice
              </p>
              <p className="text-xs text-gray-600 mb-2">
                Listen to how the selected voice sounds.
              </p>
              <button className="text-sm text-green-600 font-medium">
                Play Preview
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

