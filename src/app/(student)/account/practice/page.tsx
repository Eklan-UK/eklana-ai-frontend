"use client";

import { useState } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { ChevronRight, Sparkles, X, MessageSquare, Play } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useLearnerDrills } from "@/hooks/useDrills";
import { useRouter } from "next/navigation";

// Drill type display helpers
const DRILL_TYPE_ICONS: Record<string, string> = {
  roleplay: "🎭",
  vocabulary: "📚",
  grammar: "📝",
  matching: "🔗",
  definition: "📖",
  sentence_writing: "✍️",
  fill_blank: "📋",
  summary: "📰",
  listening: "🎧",
  sentence: "💬",
};

const DRILL_PRACTICE_SUBTITLES: Record<string, string> = {
  roleplay: "Practice roleplay conversations",
  vocabulary: "Chat using your target words",
  grammar: "Practice grammar patterns naturally",
  matching: "Reinforce word connections",
  definition: "Discuss word meanings",
  sentence_writing: "Build sentences in context",
  fill_blank: "Complete sentences in conversation",
  summary: "Discuss the reading topic",
  listening: "Talk about what you heard",
  sentence: "Practice sentence patterns",
};

function PracticeCard({
  href,
  iconBg,
  iconSrc,
  title,
  subtitle,
  meta,
  onClick,
}: {
  href?: string;
  iconBg: string;
  iconSrc: string;
  title: string;
  subtitle: string;
  meta: string[];
  onClick?: () => void;
}) {
  const content = (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-3 flex items-center gap-4 hover:shadow-md transition-shadow active:scale-[0.98] transition-transform cursor-pointer">
      {/* Icon */}
      <div
        className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}
      >
        <Image src={iconSrc} alt={title} width={24} height={24} className="brightness-0 invert" />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold font-nunito text-gray-900 mb-0.5">{title}</p>
        <p className="text-sm font-satoshi text-gray-500 mb-1 leading-snug">{subtitle}</p>
        <div className="flex items-center gap-3">
          {meta.map((m, i) => (
            <span key={i} className="text-xs font-satoshi text-gray-400">
              {m}
            </span>
          ))}
        </div>
      </div>

      {/* Chevron */}
      <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
    </div>
  );

  if (onClick) {
    return <div onClick={onClick}>{content}</div>;
  }
  return <Link href={href || "#"}>{content}</Link>;
}

export default function PracticePage() {
  const [showFreeTalkSheet, setShowFreeTalkSheet] = useState(false);
  const { data: drillsData } = useLearnerDrills();

  // Find the best drill to continue/start
  const activeDrills = (drillsData ?? []).filter(
    (a: any) => a.status === "pending" || a.status === "in_progress"
  );
  const inProgressDrill = activeDrills.find((a: any) => a.status === "in_progress");
  const newestDrill = activeDrills[0]; // First = most recently assigned
  const continueDrill = inProgressDrill || newestDrill;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <div className="h-6" />
      <Header title="Practice" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        {/* ── Continue / Start Practice Card ── */}
        {continueDrill && (
          <ContinuePracticeCard
            drill={continueDrill}
            isResume={!!inProgressDrill}
          />
        )}

        {/* ── Practice Freely Section ── */}
        <div className="mb-8">
          <h2 className="text-xl font-bold font-nunito text-gray-900 mb-4">Practice freely</h2>

          {/* Eklan Free Talk — opens bottom sheet */}
          <PracticeCard
            iconBg="bg-[#3B883E]"
            iconSrc="/icons/logo-yellow.svg"
            title="Eklan Free Talk"
            subtitle="Speak about anything"
            meta={["5–10 mins", "No pressure"]}
            onClick={() => setShowFreeTalkSheet(true)}
          />

          {/* Pronunciation */}
          <PracticeCard
            href="/account/practice/pronunciation"
            iconBg="bg-[#3B883E]"
            iconSrc="/icons/headphone.svg"
            title="Pronunciation"
            subtitle="Practice sounds and words at your own pace."
            meta={["3–5 mins"]}
          />

          {/* Listening */}
          <PracticeCard
            href="/account/practice/listening"
            iconBg="bg-blue-500"
            iconSrc="/icons/mic-outline.svg"
            title="Listening"
            subtitle="Listen, repeat, and improve natural rhythm."
            meta={["5–10 mins", "No pressure"]}
          />
        </div>

        {/* ── Your Guided Drills Section ── */}
        <GuidedDrillsSection />
      </div>

      <BottomNav />

      {/* ── Free Talk Bottom Sheet ── */}
      {showFreeTalkSheet && (
        <FreeTalkBottomSheet onClose={() => setShowFreeTalkSheet(false)} />
      )}
    </div>
  );
}

/* ─── Continue Practice Card ──────────────────────────────────────────────── */

function ContinuePracticeCard({ drill, isResume }: { drill: any; isResume: boolean }) {
  const router = useRouter();
  const drillData = drill.drill;
  if (!drillData) return null;

  const drillId = drillData._id || drill.drillId;
  const drillType = drillData.type || "practice";

  const DRILL_TYPE_LABELS: Record<string, string> = {
    roleplay: "Roleplay",
    vocabulary: "Vocabulary",
    grammar: "Grammar",
    matching: "Matching",
    definition: "Definition",
    sentence_writing: "Sentence Building",
    fill_blank: "Fill-in-the-Blank",
    summary: "Reading",
    listening: "Listening",
    sentence: "Sentence",
  };

  return (
    <div className="mb-6">
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-3xl p-5 shadow-lg">
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 bg-emerald-800/50 rounded-full px-3 py-1 mb-3">
          <Play className="w-3 h-3 text-emerald-200 fill-emerald-200" />
          <span className="text-emerald-200 text-xs font-semibold uppercase tracking-wide">
            {isResume ? "Continue Practice" : "Start Practice"}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-white text-xl font-bold font-nunito mb-2">
          {drillData.title}
        </h3>

        {/* Info */}
        <div className="flex items-center gap-4 mb-4">
          <span className="text-white/80 text-sm capitalize">
            {DRILL_TYPE_LABELS[drillType] || drillType}
          </span>
          <span className="text-white/80 text-sm">5–10 mins</span>
        </div>

        {/* Button */}
        <button
          onClick={() => router.push(`/account/drills/${drillId}`)}
          className="w-full bg-yellow-400 hover:bg-yellow-300 text-emerald-900 font-semibold text-base py-3.5 rounded-2xl transition-colors"
        >
          {isResume ? "Resume" : "Start"}
        </button>
      </div>
    </div>
  );
}

/* ─── Bottom Sheet ────────────────────────────────────────────────────────── */

function FreeTalkBottomSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { data: drillsData, isLoading } = useLearnerDrills();

  const activeDrills = (drillsData ?? []).filter(
    (a: any) => a.status === "pending" || a.status === "in_progress"
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom duration-300">
        <div className="bg-white rounded-t-3xl max-h-[80vh] overflow-hidden">
          {/* Handle + Header */}
          <div className="sticky top-0 bg-white pt-3 pb-2 px-5 border-b border-gray-100">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold font-nunito text-gray-900">
                Start a conversation
              </h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto px-5 py-4 max-h-[65vh]">
            {/* Free Talk Option */}
            <button
              onClick={() => {
                onClose();
                router.push("/account/practice/ai");
              }}
              className="w-full bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4 flex items-center gap-4 hover:bg-emerald-100 transition-colors text-left"
            >
              <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold font-nunito text-gray-900 mb-0.5">
                  Free Talk
                </p>
                <p className="text-sm font-satoshi text-gray-500 leading-snug">
                  Chat about anything — no drill, just conversation practice
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            </button>

            {/* Drill Practice Options */}
            {activeDrills.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  <p className="text-sm font-bold font-nunito text-gray-700">
                    Or practice a drill with AI
                  </p>
                </div>

                {activeDrills.slice(0, 5).map((assignment: any) => {
                  const drill = assignment.drill;
                  if (!drill) return null;

                  const drillId = drill._id || assignment.drillId;
                  const drillType = drill.type || "unknown";
                  const icon = DRILL_TYPE_ICONS[drillType] || "📚";
                  const subtitle = DRILL_PRACTICE_SUBTITLES[drillType] || "Practice with AI";

                  return (
                    <button
                      key={assignment.assignmentId || drillId}
                      onClick={() => {
                        onClose();
                        router.push(`/account/practice/ai?drillId=${drillId}`);
                      }}
                      className="w-full bg-white border border-gray-200 rounded-2xl p-4 mb-3 flex items-center gap-4 hover:border-green-300 hover:shadow-sm transition-all text-left"
                    >
                      {/* Icon */}
                      <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
                        {icon}
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold font-nunito text-gray-900 mb-0.5 truncate">
                          {drill.title}
                        </p>
                        <p className="text-xs font-satoshi text-gray-500 leading-snug">
                          {subtitle}
                        </p>
                      </div>

                      {/* Badge + Chevron */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="inline-flex items-center gap-1 text-[10px] font-satoshi text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          <Sparkles className="w-2.5 h-2.5" />
                          AI
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </div>
                    </button>
                  );
                })}
              </>
            )}

            {isLoading && (
              <div className="space-y-3">
                <div className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
                <div className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
              </div>
            )}

            {!isLoading && activeDrills.length === 0 && (
              <div className="bg-gray-50 rounded-2xl p-4 text-center">
                <p className="text-sm font-satoshi text-gray-500">
                  No active drills. Start a free talk above!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Guided Drills Section ───────────────────────────────────────────────── */

function GuidedDrillsSection() {
  const { data: drillsData, isLoading, isError } = useLearnerDrills();

  const assignedDrills = (drillsData ?? []).filter(
    (a: any) => a.status === "pending" || a.status === "in_progress"
  );

  return (
    <div className="pb-4">
      <h2 className="text-xl font-bold font-nunito text-gray-900 mb-1">
        Your guided drills
      </h2>
      <p className="text-sm font-satoshi text-gray-500 mb-4">
        Designed for you, based on your goals and coach insights.
      </p>

      {isLoading ? (
        <>
          <div className="bg-gray-100 rounded-2xl p-4 mb-3 h-28 animate-pulse" />
          <div className="bg-gray-100 rounded-2xl p-4 mb-3 h-28 animate-pulse" />
        </>
      ) : isError ? (
        <div className="bg-red-50 rounded-2xl p-4 mb-3 text-center">
          <p className="text-red-600 text-sm font-satoshi">Failed to load drills</p>
        </div>
      ) : assignedDrills.length === 0 ? (
        <div className="bg-gray-50 rounded-2xl p-6 flex flex-col items-center">
          <span className="text-4xl mb-2">📚</span>
          <p className="text-gray-700 font-bold font-nunito mb-1">No drills assigned yet</p>
          <p className="text-gray-500 text-sm font-satoshi text-center">
            Your coach will assign drills based on your goals
          </p>
        </div>
      ) : (
        assignedDrills.slice(0, 3).map((assignment: any) => {
          const drill = assignment.drill;
          const isCompleted = assignment.status === "completed";

          return (
            <Link
              key={assignment.assignmentId}
              href={`/account/drills/${drill?._id || assignment.drillId}`}
              className="block"
            >
              <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-base font-bold font-nunito text-gray-900 mb-0.5">
                      {drill?.title}
                    </p>
                    <p className="text-sm font-satoshi text-gray-500">
                      {drill?.type}
                    </p>
                    {assignment.assignedBy && (
                      <p className="text-xs font-satoshi text-gray-400 mt-1">
                        👤 Assigned by a coach
                      </p>
                    )}
                  </div>
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    {isCompleted ? (
                      <span className="text-green-500 text-sm">✓</span>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {assignment.status === "in_progress" && (
                  <span className="inline-block bg-blue-50 text-blue-700 text-xs font-satoshi px-3 py-1 rounded-lg">
                    In Progress
                  </span>
                )}
                {assignment.status === "completed" && (
                  <span className="inline-block bg-green-50 text-green-700 text-xs font-satoshi px-3 py-1 rounded-lg">
                    ✓ Completed
                  </span>
                )}
              </div>
            </Link>
          );
        })
      )}
    </div>
  );
}
