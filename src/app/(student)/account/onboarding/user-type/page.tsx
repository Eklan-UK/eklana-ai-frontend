"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Briefcase, GraduationCap, Compass, Users, Check } from "lucide-react";
import { useRouter } from "next/navigation";

export default function OnboardingUserTypePage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const userTypes = [
    {
      id: "professional",
      label: "Professional",
      Icon: Briefcase,
      description: "For work and career",
    },
    {
      id: "student",
      label: "Student",
      Icon: GraduationCap,
      description: "For academic purposes",
    },
    {
      id: "browsing",
      label: "Just browsing",
      Icon: Compass,
      description: "Exploring and learning",
    },
    {
      id: "ancestor",
      label: "Ancestor",
      Icon: Users,
      description: "For family and heritage",
      disabled: false,
    },
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
        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
      </div>

      <div className="max-w-md mx-auto px-4 py-8 md:max-w-lg md:px-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Who will use Eklan today?
          </h1>
          <p className="text-base text-gray-600">
            Help us personalize your experience
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {userTypes.map((type) => {
            const Icon = type.Icon;
            const isSelected = selectedType === type.id;

            return (
              <button
                key={type.id}
                onClick={() => !type.disabled && setSelectedType(type.id)}
                disabled={type.disabled}
                className="w-full text-left"
              >
                <Card
                  className={`transition-all ${
                    isSelected
                      ? "bg-green-50 ring-2 ring-green-600"
                      : type.disabled
                      ? "opacity-50"
                      : "hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        isSelected
                          ? "bg-green-100"
                          : type.id === "ancestor"
                          ? "bg-yellow-100"
                          : "bg-gray-100"
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${
                          isSelected
                            ? "text-green-600"
                            : type.id === "ancestor"
                            ? "text-yellow-600"
                            : "text-gray-600"
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900 mb-1">
                        {type.label}
                      </h3>
                      <p className="text-xs text-gray-500">{type.description}</p>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </Card>
              </button>
            );
          })}
        </div>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!selectedType}
          onClick={() => router.push("/account/onboarding/learning-goals")}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

