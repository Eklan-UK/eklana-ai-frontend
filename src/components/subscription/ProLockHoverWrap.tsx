"use client";

import type { ReactNode } from "react";
import { PRO_FEATURE_LOCK_HOVER_MESSAGE } from "@/lib/learner-learning-goals";

type Placement = "top" | "bottom";

const placementClass: Record<Placement, string> = {
  top: "bottom-full left-1/2 mb-1.5 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-1.5 -translate-x-1/2",
};

/**
 * Wraps Pro-locked UI: native title + visible tooltip on hover / focus-within.
 */
export function ProLockHoverWrap({
  children,
  className = "",
  placement = "top",
}: {
  children: ReactNode;
  className?: string;
  placement?: Placement;
}) {
  return (
    <div
      className={`group relative ${className}`}
      title={PRO_FEATURE_LOCK_HOVER_MESSAGE}
      aria-label={PRO_FEATURE_LOCK_HOVER_MESSAGE}
      tabIndex={0}
    >
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute ${placementClass[placement]} z-[60] w-max max-w-[min(260px,calc(100vw-1.5rem))] rounded-lg border border-border bg-card px-2.5 py-2 text-center text-xs font-medium leading-snug text-foreground shadow-lg opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 sm:px-3`}
      >
        {PRO_FEATURE_LOCK_HOVER_MESSAGE}
      </span>
    </div>
  );
}
