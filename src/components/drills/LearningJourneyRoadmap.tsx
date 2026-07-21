"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CircleCheck,
  ClipboardList,
  Lock,
  MessageCircle,
  Star,
  Stethoscope,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { LearningJourneyPartCard } from "@/components/drills/LearningJourneyPartCard";
import {
  getViewDetailsPart,
  MISSION_COMPLETED_ACCENT,
  type DerivedMissionState,
  type LearningJourneyPartId,
  type MissionThemeIconKey,
} from "@/domain/learning-journey/learning-journey.catalog";

const MISSION_ICONS: Record<MissionThemeIconKey, LucideIcon> = {
  stethoscope: Stethoscope,
  users: Users,
  message: MessageCircle,
  clipboard: ClipboardList,
  star: Star,
};

const NODE_SIZE = 52;
/** Rail is 4px; center aligns with node center at NODE_SIZE/2 */
const RAIL_LEFT = NODE_SIZE / 2 - 2;

export interface LearningJourneyRoadmapProps {
  states: DerivedMissionState[];
  /** When true, skip unlock animations (e.g. initial enrollments load) */
  isLoading?: boolean;
}

function TimelineNode({
  state,
  unlocking,
}: {
  state: DerivedMissionState;
  unlocking: boolean;
}) {
  const { status, accent, icon, isCurrent } = state;
  const locked = status === "locked";
  const completedLike =
    status === "completed" || status === "journeyComplete";
  const MissionIcon = MISSION_ICONS[icon];

  let NodeIcon: LucideIcon = Lock;
  if (status === "journeyComplete") {
    NodeIcon = Trophy;
  } else if (completedLike) {
    NodeIcon = CircleCheck;
  } else if (!locked) {
    NodeIcon = MissionIcon;
  }

  const bg = locked
    ? "#e5e7eb"
    : completedLike
      ? MISSION_COMPLETED_ACCENT
      : accent;

  const ringShadow = locked
    ? "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)"
    : isCurrent
      ? `0px 0px 0px 2px ${accent}33, 0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)`
      : completedLike
        ? `0px 0px 0px 2px ${MISSION_COMPLETED_ACCENT}33, 0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)`
        : "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)";

  return (
    <div
      className={`relative z-10 flex shrink-0 items-center justify-center rounded-full border-4 border-white dark:border-background ${
        unlocking ? "journey-node-unlock" : ""
      }`}
      style={{
        width: NODE_SIZE,
        height: NODE_SIZE,
        backgroundColor: bg,
        boxShadow: ringShadow,
      }}
      aria-hidden
    >
      <NodeIcon
        className={`size-5 ${
          locked
            ? "text-muted-foreground"
            : status === "journeyComplete"
              ? "text-amber-300"
              : "text-white"
        }`}
        strokeWidth={locked ? 2 : 2.25}
      />
    </div>
  );
}

function railFillPercent(states: DerivedMissionState[]): {
  percent: number;
  color: string;
} {
  if (states.length === 0) return { percent: 0, color: "#e0e0e0" };

  const lastReachedIndex = (() => {
    let idx = -1;
    for (let i = 0; i < states.length; i++) {
      const s = states[i];
      if (
        s.status === "completed" ||
        s.status === "journeyComplete" ||
        s.status === "active"
      ) {
        idx = i;
      }
    }
    return idx;
  })();

  if (lastReachedIndex < 0) return { percent: 0, color: "#e0e0e0" };

  // Fill through the center of the furthest reached node
  const percent =
    states.length === 1
      ? 100
      : (lastReachedIndex / (states.length - 1)) * 100;

  const anyCompleted = states.some(
    (s) => s.status === "completed" || s.status === "journeyComplete",
  );
  const current = states.find((s) => s.isCurrent);
  const color = anyCompleted
    ? MISSION_COMPLETED_ACCENT
    : (current?.accent ?? states[lastReachedIndex]?.accent ?? "#e0e0e0");

  return { percent: Math.max(8, percent), color };
}

export function LearningJourneyRoadmap({
  states,
  isLoading = false,
}: LearningJourneyRoadmapProps) {
  const viewDetailsPart = getViewDetailsPart(states);
  const prevEnrolledRef = useRef<Set<LearningJourneyPartId> | null>(null);
  const [unlockingParts, setUnlockingParts] = useState<
    Set<LearningJourneyPartId>
  >(new Set());

  useEffect(() => {
    if (isLoading) return;

    const enrolled = new Set(
      states
        .filter((s) => s.status !== "locked")
        .map((s) => s.part),
    );

    const prev = prevEnrolledRef.current;
    if (prev === null) {
      prevEnrolledRef.current = enrolled;
      return;
    }

    const newlyUnlocked = new Set<LearningJourneyPartId>();
    for (const part of enrolled) {
      if (!prev.has(part)) newlyUnlocked.add(part);
    }
    prevEnrolledRef.current = enrolled;

    if (newlyUnlocked.size === 0) return;

    setUnlockingParts(newlyUnlocked);
    const timer = window.setTimeout(() => {
      setUnlockingParts(new Set());
    }, 700);
    return () => window.clearTimeout(timer);
  }, [states, isLoading]);

  const { percent: fillPercent, color: fillColor } = useMemo(
    () => railFillPercent(states),
    [states],
  );

  return (
    <section aria-labelledby="learning-journey-heading">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2
          id="learning-journey-heading"
          className="text-lg font-bold font-nunito text-foreground"
        >
          My Learning Journey
        </h2>
        {viewDetailsPart != null ? (
          <Link
            href={`/account/drills/journey/${viewDetailsPart}`}
            className="text-sm font-semibold font-nunito text-[#2a602c] dark:text-emerald-400 hover:underline shrink-0"
          >
            View Details
          </Link>
        ) : (
          <span
            className="text-sm font-semibold font-nunito text-muted-foreground/50 shrink-0 cursor-not-allowed"
            aria-disabled
          >
            View Details
          </span>
        )}
      </div>

      <ol className="relative flex flex-col gap-5">
        {/* Gray track */}
        <div
          className="pointer-events-none absolute top-[26px] bottom-[26px] w-1 rounded-sm bg-[#e0e0e0] dark:bg-border"
          style={{ left: RAIL_LEFT }}
          aria-hidden
        />
        {/* Colored fill */}
        <div
          className="journey-rail-fill pointer-events-none absolute top-[26px] w-1 rounded-sm origin-top"
          style={{
            left: RAIL_LEFT,
            height: `calc((100% - 52px) * ${fillPercent / 100})`,
            backgroundColor: fillColor,
            maxHeight: "calc(100% - 52px)",
          }}
          aria-hidden
        />

        {states.map((state) => {
          const unlocking = unlockingParts.has(state.part);
          return (
            <li
              key={state.part}
              className="relative flex items-start gap-6"
            >
              <TimelineNode state={state} unlocking={unlocking} />
              <div className="min-w-0 flex-1 pt-1">
                <LearningJourneyPartCard
                  state={state}
                  unlocking={unlocking}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
