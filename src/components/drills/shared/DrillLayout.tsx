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
 * Provides consistent structure with Header, content area, and BottomNav
 */
export function DrillLayout({
  title,
  children,
  className = "",
  backgroundGradient = "bg-white",
  maxWidth = "md",
}: DrillLayoutProps) {
  return (
    <div className={`min-h-screen ${backgroundGradient} pb-20 md:pb-0`}>
      <div className="h-6"></div>
      <Header title={title} />
      <div className={`${maxWidthClasses[maxWidth]} mx-auto px-4 py-6 ${className}`}>
        {children}
      </div>
      <BottomNav />
    </div>
  );
}

