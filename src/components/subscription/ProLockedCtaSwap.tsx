"use client";

import Link from "next/link";

const DEFAULT_HREF = "/account/settings/subscriptions";

/**
 * Resting disabled control morphs to a same-footprint "Click me" link on hover / focus-within.
 * Overlay uses `inset-0` so it always matches the resting slot; typography scales by `density`.
 */
export function ProLockedCtaSwap({
  children,
  href = DEFAULT_HREF,
  density = "default",
  className = "",
}: {
  children: React.ReactNode;
  href?: string;
  /** `default` drill buttons; `chip` text chip (e.g. See all); `full` wide outline buttons; `compact` small square. */
  density?: "default" | "chip" | "full" | "compact";
  className?: string;
}) {
  const overlayTypography =
    density === "full"
      ? "rounded-xl text-sm sm:text-base md:text-lg font-semibold tracking-tight"
      : density === "compact"
        ? "rounded-xl text-[8px] sm:text-[9px] font-bold leading-[1.05] tracking-tight px-0.5 flex-col gap-0"
        : density === "chip"
          ? "rounded-lg text-xs font-semibold leading-tight tracking-tight px-1.5"
          : "rounded-xl text-[10px] sm:text-xs font-semibold leading-tight tracking-tight px-1 sm:px-1.5";

  const label =
    density === "compact" ? (
      <>
        <span className="leading-none">Click</span>
        <span className="leading-none">me</span>
      </>
    ) : (
      "Click me"
    );

  return (
    <span
      className={`group relative inline-flex items-stretch justify-center ${
        density === "full" ? "w-full" : ""
      } ${className}`}
    >
      <span className="transition-opacity duration-150 group-hover:opacity-0 group-focus-within:opacity-0 group-hover:pointer-events-none group-focus-within:pointer-events-none">
        {children}
      </span>
      <Link
        href={href}
        aria-label="Upgrade to Pro — open subscriptions"
        onClick={(e) => e.stopPropagation()}
        className={`
          absolute inset-0 z-[1] flex items-center justify-center overflow-hidden text-center
          bg-[#22c55e] hover:bg-[#16a34a] text-white font-nunito
          opacity-0 pointer-events-none transition-opacity duration-150
          group-hover:opacity-100 group-hover:pointer-events-auto
          group-focus-within:opacity-100 group-focus-within:pointer-events-auto
          ${overlayTypography}
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] focus-visible:ring-offset-2
        `}
      >
        {label}
      </Link>
    </span>
  );
}
