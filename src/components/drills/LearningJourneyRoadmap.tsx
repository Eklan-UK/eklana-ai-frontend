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
  getPartById,
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

/** ms between each completed-node reveal during the mount load animation */
const LOAD_STEP_MS = 420;

export interface LearningJourneyRoadmapProps {
  states: DerivedMissionState[];
  /** When true, skip unlock animations (e.g. initial enrollments load) */
  isLoading?: boolean;
}

function isCompletedLike(status: DerivedMissionState["status"]): boolean {
  return status === "completed" || status === "journeyComplete";
}

function indexToRailPercent(index: number, length: number): number {
  if (length <= 0 || index < 0) return 0;
  if (length === 1) return 100;
  const raw = (index / (length - 1)) * 100;
  // First-node endpoint is 0% of the track; keep a small stub so color is visible.
  return index === 0 ? Math.max(8, raw) : raw;
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

/** Dual-layer rail: green through last completed; accent through current. */
function railFillGeometry(states: DerivedMissionState[]): {
  greenPercent: number;
  accentPercent: number;
  accentColor: string;
} {
  if (states.length === 0) {
    return { greenPercent: 0, accentPercent: 0, accentColor: "#e0e0e0" };
  }

  let lastCompletedIndex = -1;
  for (let i = 0; i < states.length; i++) {
    if (isCompletedLike(states[i].status)) lastCompletedIndex = i;
  }

  const currentIndex = states.findIndex((s) => s.isCurrent);
  const current = currentIndex >= 0 ? states[currentIndex] : undefined;

  const greenPercent =
    lastCompletedIndex >= 0
      ? indexToRailPercent(lastCompletedIndex, states.length)
      : 0;

  const accentPercent =
    currentIndex >= 0
      ? indexToRailPercent(currentIndex, states.length)
      : 0;

  return {
    greenPercent,
    accentPercent,
    accentColor: current?.accent ?? "#e0e0e0",
  };
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

  /** How many completed nodes have been revealed (0 = none yet). */
  const [revealedCompletedCount, setRevealedCompletedCount] = useState(0);
  /** Whether the accent stub to current has been shown. */
  const [accentRevealed, setAccentRevealed] = useState(false);
  /** Part that just flipped to check/trophy (for check-in animation). */
  const [checkingInPart, setCheckingInPart] = useState<LearningJourneyPartId | null>(
    null,
  );
  const [loadAnimReady, setLoadAnimReady] = useState(false);

  const completedIndices = useMemo(
    () =>
      states
        .map((s, i) => (isCompletedLike(s.status) ? i : -1))
        .filter((i) => i >= 0),
    [states],
  );
  const currentIndex = useMemo(
    () => states.findIndex((s) => s.isCurrent),
    [states],
  );

  const finalGeometry = useMemo(() => railFillGeometry(states), [states]);

  // Progression load animation: top → bottom on each mount / My Plan revisit.
  useEffect(() => {
    if (isLoading || loadAnimStartedRef.current) return;
    loadAnimStartedRef.current = true;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const completedCount = completedIndices.length;
    const hasAccent = currentIndex >= 0;

    if (reduceMotion) {
      setRevealedCompletedCount(completedCount);
      setAccentRevealed(hasAccent);
      setLoadAnimReady(true);
      return;
    }

    // Start from empty rail; nodes stay pre-complete until their step.
    setRevealedCompletedCount(0);
    setAccentRevealed(false);
    setLoadAnimReady(true);

    if (completedCount === 0 && !hasAccent) return;

    let step = 0;
    const totalSteps = completedCount + (hasAccent ? 1 : 0);

    const timer = window.setInterval(() => {
      step += 1;
      if (step <= completedCount) {
        const idx = completedIndices[step - 1];
        const part = states[idx]?.part;
        setRevealedCompletedCount(step);
        if (part != null) {
          setCheckingInPart(part);
          window.setTimeout(() => setCheckingInPart(null), 550);
        }
      } else {
        setAccentRevealed(true);
      }
      if (step >= totalSteps) {
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

  // Animated rail heights derived from reveal progress.
  const { greenPercent, accentPercent, accentColor } = useMemo(() => {
    if (!loadAnimReady) {
      return { greenPercent: 0, accentPercent: 0, accentColor: finalGeometry.accentColor };
    }

    const greenIdx =
      revealedCompletedCount > 0
        ? completedIndices[revealedCompletedCount - 1]
        : -1;
    const green =
      greenIdx >= 0
        ? indexToRailPercent(greenIdx, states.length)
        : 0;

    const accent =
      accentRevealed && currentIndex >= 0
        ? indexToRailPercent(currentIndex, states.length)
        : 0;

    return {
      greenPercent: green,
      accentPercent: accent,
      accentColor: finalGeometry.accentColor,
    };
  }, [
    loadAnimReady,
    revealedCompletedCount,
    accentRevealed,
    completedIndices,
    currentIndex,
    states.length,
    finalGeometry.accentColor,
  ]);

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
        {/* Accent stub: through current mission (under green where they overlap) */}
        <div
          className="journey-rail-fill pointer-events-none absolute top-[26px] w-1 rounded-sm origin-top"
          style={{
            left: RAIL_LEFT,
            height: `calc((100% - 52px) * ${accentPercent / 100})`,
            backgroundColor: accentColor,
            maxHeight: "calc(100% - 52px)",
          }}
          aria-hidden
        />
        {/* Green fill: only through last completed / journeyComplete */}
        <div
          className="journey-rail-fill pointer-events-none absolute top-[26px] w-1 rounded-sm origin-top"
          style={{
            left: RAIL_LEFT,
            height: `calc((100% - 52px) * ${greenPercent / 100})`,
            backgroundColor: MISSION_COMPLETED_ACCENT,
            maxHeight: "calc(100% - 52px)",
          }}
          aria-hidden
        />

        {states.map((state, index) => {
          const completedOrder = completedIndices.indexOf(index);
          const isDoneLike = isCompletedLike(state.status);
          const revealed =
            !isDoneLike ||
            (completedOrder >= 0 && completedOrder < revealedCompletedCount);
          const displayState =
            isDoneLike && !revealed ? asPreComplete(state) : state;
          const unlocking = unlockingParts.has(state.part);
          const checkingIn = checkingInPart === state.part;

          return (
            <li
              key={state.part}
              className="relative flex items-start gap-6"
            >
              <TimelineNode
                state={displayState}
                unlocking={unlocking}
                checkingIn={checkingIn}
              />
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
