"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Clock } from "lucide-react";
import Image from "next/image";
import { useLearnerDrills } from "@/hooks/useDrills";
import { Header } from "@/components/layout/Header";

/* ─── Free Topic definitions ──────────────────────────────────────────────── */

const FREE_TOPICS = [
  {
    id: "daily-life",
    title: "Daily Life",
    subtitle: "Everyday conversations",
    emoji: "☕",
    bg: "bg-purple-500",
  },
  {
    id: "work-school",
    title: "Work / school",
    subtitle: "Meetings & presentations",
    emoji: "💼",
    bg: "bg-amber-700",
  },
  {
    id: "something-on-your-mind",
    title: "Something on your mind",
    subtitle: null,
    emoji: "🤔",
    bg: "bg-yellow-500",
  },
  {
    id: "surprise-me",
    title: "Surprise me",
    subtitle: null,
    emoji: "✨",
    bg: "bg-emerald-600",
  },
];

/* ─── Selection Page ──────────────────────────────────────────────────────── */

export default function FreeTalkSelectionPage() {
  const router = useRouter();
  const { data: drillsData, isLoading } = useLearnerDrills({ status: "completed" });

  // Filter to only completed scenario (roleplay) drills
  const completedScenarioDrills = (drillsData ?? []).filter((a: any) => {
    const drill = a.drill;
    return drill && (drill.type === "roleplay" || drill.type === "scenario");
  });

  const hasCompletedDrills = completedScenarioDrills.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6" />
      <Header title="" showBack />

      <div className="max-w-md mx-auto px-5 pb-12 md:max-w-2xl md:px-8">
        {/* Title */}
        <h1 className="text-2xl font-bold font-nunito text-gray-900 mb-1">
          Start a Free Talk
        </h1>
        <p className="text-base font-satoshi text-gray-500 mb-4">
          Choose how you'd like to practice today.
        </p>

        <Link
          href="/account/practice/ai/summaries"
          className="inline-flex items-center gap-2 mb-6 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          View past session summaries
          <ChevronRight className="w-4 h-4" />
        </Link>

        {/* ── Based on Your Drills ── */}
        {isLoading ? (
          <div className="mb-8">
            <h2 className="text-sm font-bold font-nunito text-gray-700 mb-3">
              Based on Your Drills
            </h2>
            <div className="space-y-3">
              <div className="bg-white border border-gray-200 rounded-2xl p-4 h-20 animate-pulse" />
              <div className="bg-white border border-gray-200 rounded-2xl p-4 h-20 animate-pulse" />
            </div>
          </div>
        ) : hasCompletedDrills ? (
          <div className="mb-8">
            <h2 className="text-sm font-bold font-nunito text-gray-700 mb-3">
              Based on Your Drills
            </h2>
            <div className="space-y-3">
              {completedScenarioDrills.map((assignment: any) => {
                const drill = assignment.drill;
                const drillId = drill._id || assignment.drillId;

                return (
                  <button
                    key={assignment.assignmentId || drillId}
                    onClick={() =>
                      router.push(`/account/practice/ai/session?drillId=${drillId}`)
                    }
                    className="w-full bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4 hover:shadow-md hover:border-emerald-200 transition-all text-left"
                  >
                    {/* Drill thumbnail */}
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <Image
                        src="/images/thumbnail.png"
                        alt="Eklan"
                        width={50}
                        height={50}
                      />
                    </div>

                    {/* Title + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-base font-bold font-nunito text-gray-900 truncate">
                          {drill.title}
                        </p>
                        <span className="text-xs font-satoshi text-blue-500 flex-shrink-0">
                          • Scenario
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs font-satoshi">5-7 minutes</span>
                      </div>
                    </div>

                    {/* Chevron */}
                    <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* ── Free Topics ── */}
        <div>
          <h2 className="text-sm font-bold font-nunito text-gray-700 mb-3">
            Free Topics
          </h2>
          <div className="space-y-3">
            {FREE_TOPICS.map((topicItem, idx) => (
              <button
                key={topicItem.id}
                onClick={() =>
                  router.push(`/account/practice/ai/session?topic=${topicItem.id}`)
                }
                className={`w-full bg-white border rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-all text-left ${
                  idx === 0
                    ? "border-emerald-300 shadow-sm"
                    : "border-gray-200"
                }`}
              >
                {/* Emoji avatar */}
                <div
                  className={`w-12 h-12 ${topicItem.bg} rounded-xl flex items-center justify-center flex-shrink-0`}
                >
                  <span className="text-xl">{topicItem.emoji}</span>
                </div>

                {/* Title + subtitle */}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold font-nunito text-gray-900">
                    {topicItem.title}
                  </p>
                  {topicItem.subtitle && (
                    <p className="text-sm font-satoshi text-gray-500">
                      {topicItem.subtitle}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
