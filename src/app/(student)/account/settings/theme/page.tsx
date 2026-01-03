"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function ThemePage() {
  const [selected, setSelected] = useState("Light");

  const themes = [
    { name: "Light", icon: "☀️", description: "Default light theme" },
    { name: "Dark", icon: "🌙", description: "Dark mode for night use" },
    { name: "Auto", icon: "🔄", description: "Follow system settings" },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Theme" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        <p className="text-base text-gray-600 mb-6">
          Choose your preferred theme.
        </p>

        <div className="space-y-3 mb-6">
          {themes.map((theme) => (
            <button
              key={theme.name}
              onClick={() => setSelected(theme.name)}
              className="w-full text-left"
            >
              <Card
                className={`transition-all ${
                  selected === theme.name
                    ? "bg-green-50 ring-2 ring-green-600"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{theme.icon}</span>
                    <div>
                      <p className="text-base font-semibold text-gray-900">
                        {theme.name}
                      </p>
                      <p className="text-sm text-gray-500">{theme.description}</p>
                    </div>
                  </div>
                  {selected === theme.name && (
                    <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M13 4L6 11L3 8"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </Card>
            </button>
          ))}
        </div>

        <Button variant="primary" size="lg" fullWidth>
          Save
        </Button>
      </div>
    </div>
  );
}

