"use client";

import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useLearnerDrills } from "@/hooks/useDrills";

function PracticeCard({
  href,
  iconBg,
  iconSrc,
  title,
  subtitle,
  meta,
}: {
  href: string;
  iconBg: string;
  iconSrc: string;
  title: string;
  subtitle: string;
  meta: string[];
}) {
  return (
    <Link href={href}>
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-3 flex items-center gap-4 hover:shadow-md transition-shadow active:scale-[0.98] transition-transform">
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
    </Link>
  );
}

export default function PracticePage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <div className="h-6" />
      <Header title="Practice" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        {/* ── Practice Freely Section ── */}
        <div className="mb-8">
          <h2 className="text-xl font-bold font-nunito text-gray-900 mb-4">Practice freely</h2>

          {/* Eklan Free Talk */}
          <PracticeCard
            href="/account/practice/ai"
            iconBg="bg-[#3B883E]"
            iconSrc="/icons/logo-yellow.svg"
            title="Eklan Free Talk"
            subtitle="Speak about anything"
            meta={["5–10 mins", "No pressure"]}
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
    </div>
  );
}

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
