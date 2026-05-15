"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { PRO_FEATURE_LOCK_HOVER_MESSAGE } from "@/lib/learner-learning-goals";
import { useFollowCursorUpgradeTip } from "@/hooks/useFollowCursorUpgradeTip";

type Placement = "top" | "bottom";

const DEFAULT_SUBSCRIPTION_HREF = "/account/settings/subscriptions";

/**
 * Wraps Pro-locked UI: upgrade copy follows the pointer (fixed portal).
 * Use {@link ProLockedCtaSwap} on the real control for the "Click me" CTA —
 * this wrapper no longer renders an inner link in the tooltip.
 */
export function ProLockHoverWrap({
  children,
  className = "",
  placement: _placement = "top",
  subscriptionHref: _subscriptionHref = DEFAULT_SUBSCRIPTION_HREF,
}: {
  children: ReactNode;
  className?: string;
  /** @deprecated Kept for API compatibility; cursor tip is not placement-anchored. */
  placement?: Placement;
  /** @deprecated Kept for API compatibility; CTA lives on ProLockedCtaSwap. */
  subscriptionHref?: string;
}) {
  const { ref, tip } = useFollowCursorUpgradeTip();

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      title={PRO_FEATURE_LOCK_HOVER_MESSAGE}
      aria-label={PRO_FEATURE_LOCK_HOVER_MESSAGE}
      tabIndex={-1}
    >
      {children}

      {tip.visible &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            aria-live="polite"
            style={{
              position: "fixed",
              left: tip.x,
              top: tip.y,
              zIndex: 9999,
              pointerEvents: "none",
            }}
            className="max-w-[min(260px,calc(100vw-1.5rem))] rounded-lg border border-border bg-card px-3 py-1.5 shadow-lg text-xs font-medium font-satoshi leading-snug text-foreground"
          >
            {PRO_FEATURE_LOCK_HOVER_MESSAGE}
          </div>,
          document.body
        )}
    </div>
  );
}
