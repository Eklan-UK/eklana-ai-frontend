"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Clock, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
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

  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [roleOptions, setRoleOptions] = useState<{ student: string; ai: string } | null>(null);

  function openRoleModal(url: string, characters?: { student?: string; ai?: string }) {
    setPendingUrl(url);
    setRoleOptions({
      student: characters?.student?.trim() || "Learner",
      ai: characters?.ai?.trim() || "English Coach",
    });
  }

  function handleSelectRole(reversed: boolean) {
    if (!pendingUrl) return;
    const url = reversed ? `${pendingUrl}&reversed=1` : pendingUrl;
    setPendingUrl(null);
    setRoleOptions(null);
    router.push(url);
  }

  function dismissModal() {
    setPendingUrl(null);
    setRoleOptions(null);
  }

  // Filter to only completed scenario (roleplay) drills
  const completedScenarioDrills = (drillsData ?? []).filter((a: any) => {
    const drill = a.drill;
    return drill && (drill.type === "roleplay" || drill.type === "scenario");
  });

  const hasCompletedDrills = completedScenarioDrills.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="h-6" />
      <Header title="" showBack />

      <div className="max-w-md mx-auto px-5 pb-12 md:max-w-2xl md:px-8">
        {/* Title */}
        <h1 className="text-2xl font-bold font-nunito text-foreground mb-1">
          Start a Free Talk
        </h1>
        <p className="text-base font-satoshi text-muted-foreground mb-4">
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
            <h2 className="text-sm font-bold font-nunito text-foreground mb-3">
              Based on Your Drills
            </h2>
            <div className="space-y-3">
              <div className="bg-card border border-border rounded-2xl p-4 h-20 animate-pulse" />
              <div className="bg-card border border-border rounded-2xl p-4 h-20 animate-pulse" />
            </div>
          </div>
        ) : hasCompletedDrills ? (
          <div className="mb-8">
            <h2 className="text-sm font-bold font-nunito text-foreground mb-3">
              Based on Your Drills
            </h2>
            <div className="space-y-3">
              {completedScenarioDrills.map((assignment: any) => {
                const drill = assignment.drill;
                const drillId = drill._id || assignment.drillId;
                const targetWords = (Array.isArray(drill.target_sentences) ? drill.target_sentences : [])
                  .map((s: { word?: string }) => (s?.word ? String(s.word).trim() : ""))
                  .filter(Boolean);
                const roleplayScenes = Array.isArray(drill.roleplay_scenes) ? drill.roleplay_scenes : [];
                const buildSessionUrl = (scenarioIndex: number) => {
                  const q = new URLSearchParams();
                  q.set("drillId", String(drillId));
                  q.set("scenarioId", String(scenarioIndex));
                  if (targetWords.length) {
                    q.set("vocab", JSON.stringify(targetWords));
                  }
                  return `/account/practice/ai/session?${q.toString()}`;
                };
                const defaultUrl = buildSessionUrl(0);
                const drillCharacters = {
                  student: drill.student_character_name,
                  ai: Array.isArray(drill.ai_character_names) && drill.ai_character_names[0]
                    ? drill.ai_character_names[0]
                    : drill.ai_character_name,
                };

                return (
                  <div
                    key={assignment.assignmentId || drillId}
                    className="w-full bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md hover:border-emerald-500/40 transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => openRoleModal(defaultUrl, drillCharacters)}
                      className="w-full p-4 flex items-center gap-4 text-left"
                    >
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <Image
                          src="/images/thumbnail.png"
                          alt="Eklan"
                          width={50}
                          height={50}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-base font-bold font-nunito text-foreground truncate">
                            {drill.title}
                          </p>
                          <span className="text-xs font-satoshi text-blue-500 flex-shrink-0">
                            • Scenario
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-xs font-satoshi">5-7 minutes</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    </button>
                    {roleplayScenes.length > 1 && (
                      <div className="px-4 pb-3 pt-0 border-t border-border flex flex-wrap items-center gap-2">
                        <span className="text-xs font-satoshi text-muted-foreground w-full sm:w-auto">Scene:</span>
                        {roleplayScenes.map((s: { scene_name?: string; title?: string; name?: string }, i: number) => {
                          const label =
                            (s.scene_name || s.title || s.name || `Part ${i + 1}`).trim() || `Scene ${i + 1}`;
                          return (
                            <button
                              key={`${drillId}-scene-${i}`}
                              type="button"
                              onClick={() => openRoleModal(buildSessionUrl(i), drillCharacters)}
                              className="text-xs font-semibold font-satoshi px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/25 border border-emerald-500/30"
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* ── Free Topics ── */}
        <div>
          <h2 className="text-sm font-bold font-nunito text-foreground mb-3">
            Free Topics
          </h2>
          <div className="space-y-3">
            {FREE_TOPICS.map((topicItem, idx) => (
              <button
                key={topicItem.id}
                onClick={() =>
                  openRoleModal(`/account/practice/ai/session?topic=${topicItem.id}`)
                }
                className={`w-full bg-card border rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-all text-left ${
                  idx === 0
                    ? "border-emerald-500/50 shadow-sm"
                    : "border-border"
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
                  <p className="text-base font-bold font-nunito text-foreground">
                    {topicItem.title}
                  </p>
                  {topicItem.subtitle && (
                    <p className="text-sm font-satoshi text-muted-foreground">
                      {topicItem.subtitle}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Role Selection Modal ── */}
      {pendingUrl && roleOptions && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-6 sm:pb-0"
          onClick={dismissModal}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#131614] rounded-3xl shadow-2xl p-6 animate-in fade-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold font-nunito text-foreground">
                Choose your role
              </h2>
              <button
                type="button"
                onClick={dismissModal}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#1a1d1c] transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm font-satoshi text-muted-foreground mb-5">
              Pick the role you want to practice in this session.
            </p>

            {/* Role cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Card 1 – student role */}
              <button
                type="button"
                onClick={() => handleSelectRole(false)}
                className="flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors text-center"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-2xl">
                  🧑‍🎓
                </div>
                <div>
                  <p className="text-[10px] font-satoshi uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mb-0.5">
                    Play as
                  </p>
                  <p className="text-sm font-bold font-nunito text-foreground leading-tight">
                    {roleOptions.student}
                  </p>
                </div>
              </button>

              {/* Card 2 – AI role */}
              <button
                type="button"
                onClick={() => handleSelectRole(true)}
                className="flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-border hover:border-amber-400 bg-card hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors text-center"
              >
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-2xl">
                  🎓
                </div>
                <div>
                  <p className="text-[10px] font-satoshi uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-0.5">
                    Play as
                  </p>
                  <p className="text-sm font-bold font-nunito text-foreground leading-tight">
                    {roleOptions.ai}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
