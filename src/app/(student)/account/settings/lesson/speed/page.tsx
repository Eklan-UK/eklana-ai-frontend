"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Check, Gauge } from "lucide-react";

export default function SpeedPage() {
  const [selected, setSelected] = useState("Normal");

  const speeds = [
    { id: "slow", label: "Slow", description: "Easier to follow" },
    { id: "normal", label: "Normal", description: "Natural pace" },
    { id: "fast", label: "Fast", description: "Challenging" },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Speaking Speed" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        <div className="mb-6">
          <p className="text-base text-gray-600">
            Adjust the speaking speed for AI conversations and audio lessons.
          </p>
        </div>

        <div className="space-y-2 mb-6">
          {speeds.map((speed) => (
            <button
              key={speed.id}
              onClick={() => setSelected(speed.label)}
              className="w-full text-left"
            >
              <Card
                className={`transition-all ${
                  selected === speed.label
                    ? "bg-green-50 ring-2 ring-green-600"
                    : "hover:shadow-md"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <Gauge className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-gray-900">
                        {speed.label}
                      </p>
                      <p className="text-sm text-gray-500">
                        {speed.description}
                      </p>
                    </div>
                  </div>
                  {selected === speed.label && (
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
          Save Speed Preference
        </Button>

        {/* Info */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Gauge className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                About Speaking Speed
              </p>
              <p className="text-xs text-gray-600">
                This setting affects how fast the AI speaks during conversations.
                Start with Normal and adjust based on your comfort level.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

