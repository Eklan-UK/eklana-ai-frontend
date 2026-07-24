"use client";

import { useEffect, useRef, useState } from "react";
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
  getPartById,
  getViewDetailsPart,
  MISSION_COMPLETED_ACCENT,
  MISSION_LOCKED_RAIL,
  railSegmentColor,
  railSegmentFillRatio,
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

/** ms between each mission reveal during the mount load animation */
const LOAD_STEP_MS = 420;

export interface LearningJourneyRoadmapProps {
  states: DerivedMissionState[];
  /** When true, skip unlock animations (e.g. initial enrollments load) */
  isLoading?: boolean;
}

function isCompletedLike(status: DerivedMissionState["status"]): boolean {
  return status === "completed" || status === "journeyComplete";
}

function TimelineNode({
  state,
  unlocking,
  checkingIn,
}: {
  state: DerivedMissionState;
  unlocking: boolean;
  checkingIn?: boolean;
}) {
  const { status, accent, icon, isCurrent } = state;
  const locked = status === "locked";
  const completedLike = isCompletedLike(status);
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

  const animClass = unlocking
    ? "journey-node-unlock"
    : checkingIn
      ? "journey-node-check-in"
      : "";

  return (
    <div
      className={`relative z-10 flex shrink-0 items-center justify-center rounded-full border-4 border-white dark:border-background ${animClass}`}
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

/**
 * Pre-complete look for a completed node that has not yet been revealed
 * in the load animation (mission accent + theme icon).
 */
function asPreComplete(state: DerivedMissionState): DerivedMissionState {
  const partDef = getPartById(state.part);
  return {
    ...state,
    status: "active",
    isCurrent: false,
    ctaLabel: null,
    accent: partDef?.accent ?? state.accent,
  };
}

export function LearningJourneyRoadmap({
  states,
  isLoading = false,
}: LearningJourneyRoadmapProps) {
  const viewDetailsPart = getViewDetailsPart(states);
  const prevEnrolledRef = useRef<Set<LearningJourneyPartId> | null>(null);
  const loadAnimStartedRef = useRef(false);
  const [unlockingParts, setUnlockingParts] = useState<
    Set<LearningJourneyPartId>
  >(new Set());

  /**
   * Highest mission index revealed in the top→down load sequence (−1 = none).
   * Revealing index i shows node i, grows its progress bar, and fills segment i→i+1.
   */
  const [revealedThrough, setRevealedThrough] = useState(-1);
  /** Part that just flipped to check/trophy (for check-in animation). */
  const [checkingInPart, setCheckingInPart] = useState<LearningJourneyPartId | null>(
    null,
  );
  const [loadAnimReady, setLoadAnimReady] = useState(false);

  // Progression load animation: top → bottom on each mount / My Plan revisit.
  useEffect(() => {
    if (isLoading || loadAnimStartedRef.current) return;
    loadAnimStartedRef.current = true;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const n = states.length;

    if (reduceMotion || n === 0) {
      setRevealedThrough(n - 1);
      setLoadAnimReady(true);
      return;
    }

    setRevealedThrough(-1);
    setLoadAnimReady(true);

    let step = 0;
    const timer = window.setInterval(() => {
      const part = states[step]?.part;
      const status = states[step]?.status;
      setRevealedThrough(step);
      if (part != null && status != null && isCompletedLike(status)) {
        setCheckingInPart(part);
        window.setTimeout(() => setCheckingInPart(null), 550);
      }
      step += 1;
      if (step >= n) {
        window.clearInterval(timer);
      }
    }, LOAD_STEP_MS);

    return () => window.clearInterval(timer);
    // Intentionally once per mount after loading settles (states snapshot at start).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount replays; mid-scroll state churn must not restart
  }, [isLoading]);

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

      <ol className="relative flex flex-col">
        {states.map((state, index) => {
          const isDoneLike = isCompletedLike(state.status);
          const revealed = loadAnimReady && revealedThrough >= index;
          const displayState =
            isDoneLike && !revealed ? asPreComplete(state) : state;
          const unlocking = unlockingParts.has(state.part);
          const checkingIn = checkingInPart === state.part;
          const hasNext = index < states.length - 1;
          const segmentColor = railSegmentColor(state.status, state.accent);
          const segmentFillPct = revealed
            ? railSegmentFillRatio(state.status, state.percent) * 100
            : 0;
          // Card bar tracks real progress — never force a full bar for incomplete.
          const barPercent =
            state.status === "locked" || !revealed
              ? 0
              : isDoneLike
                ? 100
                : state.percent;

          return (
            <li key={state.part} className="relative flex items-stretch gap-6">
              <div
                className="relative z-10 flex shrink-0 flex-col items-center"
                style={{ width: NODE_SIZE }}
              >
                <TimelineNode
                  state={displayState}
                  unlocking={unlocking}
                  checkingIn={checkingIn}
                />
                {hasNext ? (
                  <div className="relative w-1 min-h-5 flex-1" aria-hidden>
                    <div
                      className="absolute inset-0 rounded-sm"
                      style={{ backgroundColor: MISSION_LOCKED_RAIL }}
                    />
                    <div
                      className="journey-rail-fill absolute top-0 left-0 right-0 rounded-sm origin-top"
                      style={{
                        height: `${segmentFillPct}%`,
                        backgroundColor: segmentColor,
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <div
                className={`min-w-0 flex-1 pt-1 ${hasNext ? "pb-5" : ""}`}
              >
                <LearningJourneyPartCard
                  state={state}
                  unlocking={unlocking}
                  barPercent={barPercent}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
