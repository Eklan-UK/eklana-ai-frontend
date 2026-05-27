"use client";

import { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import {
  drillContentWidthClasses,
  type DrillContentWidth,
} from "@/components/drills/shared/drill-content-width";

export type { DrillContentWidth } from "@/components/drills/shared/drill-content-width";
export { drillContentWidthClasses } from "@/components/drills/shared/drill-content-width";

interface DrillLayoutProps {
  title: string;
  children: ReactNode;
  className?: string;
  backgroundGradient?: string;
  maxWidth?: DrillContentWidth;
  /** Hide the bottom navigation bar during active practice */
  hideNavigation?: boolean;
  /** Show a minimal header without back button */
  minimalHeader?: boolean;
  /** Show back button in header */
  showBack?: boolean;
  /** Header progress: “current of total” + thin bar (e.g. matching pairs locked). */
  progress?: { current: number; total: number };
  /** Optional control on the right side of the header (e.g. bookmark). */
  headerRight?: ReactNode;
}

/**
 * Shared layout wrapper for all drill components
 * Provides consistent structure with Header, content area, and optionally BottomNav
 * 
 * @param hideNavigation - Set to true during active practice to hide the bottom nav
 */
export function DrillLayout({
  title,
  children,
  className = "",
  backgroundGradient = "bg-background",
  maxWidth = "md",
  hideNavigation = true, // Default to hiding nav during drills
  minimalHeader = false,
  showBack = true, // Default to showing back button
  progress,
  headerRight,
}: DrillLayoutProps) {
  return (
    <div
      className={`flex min-h-screen flex-col ${backgroundGradient} ${
        hideNavigation ? 'pb-6' : 'pb-[max(5.5rem,env(safe-area-inset-bottom,0px))]'
      }`}
    >
      <div className="h-6"></div>
      <Header
        title={title}
        showBack={showBack}
        progress={progress}
        rightAction={headerRight}
        contentWidth={maxWidth}
      />
      <div
        className={`${drillContentWidthClasses[maxWidth]} flex flex-1 flex-col px-4 md:px-8 py-6 ${className}`}
      >
        {children}
      </div>
      {!hideNavigation && <BottomNav />}
    </div>
  );
}

