"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Check, Crown, Zap, Star, CreditCard, Calendar } from "lucide-react";

export default function SubscriptionsPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>("freemium");

  const plans = [
    {
      id: "freemium",
      name: "Freemium",
      price: "Free",
      period: "",
      features: [
        "Basic pronunciation practice",
        "Limited AI conversations (5/day)",
        "Basic progress tracking",
        "Access to community forums",
      ],
      current: true,
      icon: Zap,
      color: "gray",
    },
    {
      id: "premium",
      name: "Premium",
      price: "$9.99",
      period: "/month",
      features: [
        "Unlimited pronunciation practice",
        "Unlimited AI conversations",
        "Advanced progress analytics",
        "Personalized learning paths",
        "Priority customer support",
        "Ad-free experience",
      ],
      current: false,
      icon: Star,
      color: "green",
      popular: true,
    },
    {
      id: "pro",
      name: "Pro",
      price: "$19.99",
      period: "/month",
      features: [
        "Everything in Premium",
        "1-on-1 live tutoring sessions",
        "Custom learning curriculum",
        "Advanced speech analysis",
        "Certificate of completion",
        "Dedicated account manager",
      ],
      current: false,
      icon: Crown,
      color: "yellow",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Subscriptions" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-3xl md:px-8">
        {/* Current Plan Info */}
        <Card className="mb-6 bg-green-50 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Current Plan
              </p>
              <p className="text-2xl font-bold text-green-600">Freemium</p>
              <p className="text-xs text-gray-600 mt-1">
                Expires on <span className="font-semibold">03 Dec 2025</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </Card>

        {/* Plans */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const Icon = plan.icon;
              const isSelected = selectedPlan === plan.id;
              const isCurrent = plan.current;

              return (
                <Card
                  key={plan.id}
                  className={`relative transition-all cursor-pointer ${
                    isSelected
                      ? "ring-2 ring-green-600 bg-green-50"
                      : "hover:shadow-md"
                  } ${plan.popular ? "border-2 border-yellow-400" : ""}`}
                  onClick={() => !isCurrent && setSelectedPlan(plan.id)}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-gray-900 px-3 py-1 rounded-full text-xs font-semibold">
                      Most Popular
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-3 right-3 bg-green-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                      Current
                    </div>
                  )}

                  <div className="pt-6 pb-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          plan.color === "green"
                            ? "bg-green-100"
                            : plan.color === "yellow"
                            ? "bg-yellow-100"
                            : "bg-gray-100"
                        }`}
                      >
                        <Icon
                          className={`w-6 h-6 ${
                            plan.color === "green"
                              ? "text-green-600"
                              : plan.color === "yellow"
                              ? "text-yellow-600"
                              : "text-gray-600"
                          }`}
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {plan.name}
                        </h3>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-gray-900">
                          {plan.price}
                        </span>
                        {plan.period && (
                          <span className="text-sm text-gray-500">
                            {plan.period}
                          </span>
                        )}
                      </div>
                    </div>

                    <ul className="space-y-2 mb-4">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Check
                            className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                              plan.color === "green"
                                ? "text-green-600"
                                : plan.color === "yellow"
                                ? "text-yellow-600"
                                : "text-gray-600"
                            }`}
                          />
                          <span className="text-sm text-gray-600">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {isCurrent ? (
                      <Button
                        variant="outline"
                        size="lg"
                        fullWidth
                        disabled
                        className="cursor-not-allowed"
                      >
                        Current Plan
                      </Button>
                    ) : (
                      <Button
                        variant={isSelected ? "primary" : "outline"}
                        size="lg"
                        fullWidth
                      >
                        {isSelected ? "Selected" : "Select Plan"}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Payment Info */}
        {selectedPlan && selectedPlan !== "freemium" && (
          <Card className="mb-6 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <CreditCard className="w-6 h-6 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  Payment Information
                </p>
                <p className="text-xs text-gray-600 mb-3">
                  Your subscription will be charged to your account. You can
                  cancel anytime from your settings.
                </p>
                <Button variant="primary" size="sm">
                  Continue to Payment
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Info */}
        <Card className="bg-gray-50 border-gray-200">
          <div className="text-center py-4">
            <p className="text-sm font-semibold text-gray-900 mb-2">
              Questions about subscriptions?
            </p>
            <a
              href="/contact"
              className="text-sm text-green-600 font-medium underline"
            >
              Contact our support team
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}

