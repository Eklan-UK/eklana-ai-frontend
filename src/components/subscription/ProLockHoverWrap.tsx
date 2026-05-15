"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { PRO_FEATURE_LOCK_HOVER_MESSAGE } from "@/lib/learner-learning-goals";

type Placement = "top" | "bottom";

/** Outer anchor: positions the hover bridge + panel without a gap that drops hover. */
const placementClass: Record<Placement, string> = {
  top: "bottom-full left-1/2 flex flex-col items-center pb-1.5 -translate-x-1/2",
  bottom: "top-full left-1/2 flex flex-col items-center pt-1.5 -translate-x-1/2",
};

const DEFAULT_SUBSCRIPTION_HREF = "/account/settings/subscriptions";

/**
 * Wraps Pro-locked UI: native title + visible tooltip on hover / focus-within,
 * with a CTA link to the subscription page.
 */
export function ProLockHoverWrap({
  children,
  className = "",
  placement = "top",
  subscriptionHref = DEFAULT_SUBSCRIPTION_HREF,
}: {
  children: ReactNode;
  className?: string;
  placement?: Placement;
  /** Where the upgrade CTA navigates (default: student subscriptions settings). */
  subscriptionHref?: string;
}) {
  return (
    <div
      className={`group relative ${className}`}
      title={PRO_FEATURE_LOCK_HOVER_MESSAGE}
      aria-label={PRO_FEATURE_LOCK_HOVER_MESSAGE}
      tabIndex={0}
    >
      {children}
      <div
        className={`pointer-events-none absolute ${placementClass[placement]} z-[60] opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100`}
      >
        <div
          role="tooltip"
          className="w-max max-w-[min(260px,calc(100vw-1.5rem))] rounded-lg border border-border bg-card px-2.5 py-2 text-center shadow-lg sm:px-3"
        >
          <p className="text-xs font-medium font-satoshi leading-snug text-foreground">
            {PRO_FEATURE_LOCK_HOVER_MESSAGE}
          </p>
          <Link
            href={subscriptionHref}
            aria-label="Open subscription and upgrade to Pro"
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold font-nunito text-white shadow-sm transition-colors hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={(e) => e.stopPropagation()}
          >
            click me
          </Link>
        </div>
      </div>
    </div>
  );
}
