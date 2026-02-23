"use client";

import { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";

interface DrillLayoutProps {
  title: string;
  children: ReactNode;
  className?: string;
  backgroundGradient?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
  /** Hide the bottom navigation bar during active practice */
  hideNavigation?: boolean;
  /** Show a minimal header without back button */
  minimalHeader?: boolean;
  /** Show back button in header */
  showBack?: boolean;
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
};

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
  backgroundGradient = "bg-white",
  maxWidth = "md",
  hideNavigation = true, // Default to hiding nav during drills
  minimalHeader = false,
  showBack = true, // Default to showing back button
}: DrillLayoutProps) {
  return (
    <div className={`min-h-screen ${backgroundGradient} ${hideNavigation ? 'pb-6' : 'pb-20 md:pb-0'}`}>
      <div className="h-6"></div>
      <Header title={title} showBack={showBack} />
      <div className={`max-w-md md:max-w-2xl mx-auto px-4 md:px-8 py-6 ${className}`}>
        {children}
      </div>
      {!hideNavigation && <BottomNav />}
    </div>
  );
}

