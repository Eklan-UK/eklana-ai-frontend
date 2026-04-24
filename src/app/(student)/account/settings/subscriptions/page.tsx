"use client";

import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Check, Crown, Zap, Star, Calendar } from "lucide-react";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import {
  CURRENT_PLAN_CARD_MESSAGE,
  planTitleFromUser,
} from "@/lib/learner-learning-goals";

const PLANS: Array<{
  id: string;
  name: string;
  features: string[];
  icon: typeof Zap;
  color: "gray" | "green" | "yellow";
  popular?: boolean;
}> = [
  {
    id: "freemium",
    name: "Free",
    features: [
      "Basic pronunciation practice",
      "Limited AI conversations (5/day)",
      "Basic progress tracking",
    ],
    icon: Zap,
    color: "gray",
  },
  {
    id: "premium",
    name: "Premium",
    features: [
      "Unlimited pronunciation practice",
      "Unlimited AI conversations",
      "Advanced progress analytics",
      "Personalized learning paths",
      "Priority customer support",
    ],
    icon: Star,
    color: "green",
    popular: true,
  },
  {
    id: "pro",
    name: "Pro",
    features: [
      "Everything in Premium",
      "1-on-1 live tutoring sessions",
      "Custom learning curriculum",
      "Advanced speech analysis",
    ],
    icon: Crown,
    color: "yellow",
  },
];

const CURRENT_PLAN_ID: "pro" = "pro";

export default function SubscriptionsPage() {
  const { data: me } = useUserCurrent();
  const user = me?.user;
  const currentPlanId = CURRENT_PLAN_ID;
  const plans = PLANS;
  const planTitle = planTitleFromUser(user);

  return (
    <div className="min-h-screen bg-white">
      <div className="h-6" />

      <Header showBack title="Subscriptions" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-3xl md:px-8">
        <Card className="mb-6 bg-green-50 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Current plan
              </p>
              <p className="text-2xl font-bold text-green-600">{planTitle}</p>
              <p className="text-sm text-gray-600 mt-2 max-w-sm">
                {CURRENT_PLAN_CARD_MESSAGE}
              </p>
            </div>
            <Calendar className="w-5 h-5 text-green-600" />
          </div>
        </Card>

        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Plan overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const Icon = plan.icon;
              const isCurrent = plan.id === currentPlanId;
              return (
                <Card
                  key={plan.id}
                  className={`relative ${
                    isCurrent ? "ring-2 ring-green-600 bg-green-50" : ""
                  } ${plan.popular ? "border-2 border-yellow-400" : ""}`}
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
                      <h3 className="text-lg font-bold text-gray-900">
                        {plan.name}
                      </h3>
                    </div>
                    <ul className="space-y-2">
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
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

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
