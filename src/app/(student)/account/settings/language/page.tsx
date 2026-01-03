"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function LanguagePage() {
  const [selected, setSelected] = useState("English");

  const languages = [
    { code: "en", name: "English" },
    { code: "ko", name: "Korean" },
    { code: "zh", name: "Chinese" },
    { code: "ja", name: "Japanese" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="App Language" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        <p className="text-base text-gray-600 mb-6">
          Choose your preferred language for the app interface.
        </p>

        <div className="space-y-2 mb-6">
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => setSelected(language.name)}
              className="w-full text-left"
            >
              <Card
                className={`transition-all ${
                  selected === language.name
                    ? "bg-green-50 ring-2 ring-green-600"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-medium text-gray-900">
                    {language.name}
                  </span>
                  {selected === language.name && (
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

