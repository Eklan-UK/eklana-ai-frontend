"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BottomNav } from "@/components/layout/BottomNav";

export default function CommentScreenPage() {
  return (
    <div className="min-h-screen bg-background pb-[max(5.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="h-6" />
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3 md:max-w-2xl md:px-8">
          <Link
            href="/account/practice"
            className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Back to Practice"
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <h1 className="text-lg font-bold font-nunito text-foreground">Comment Screen</h1>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-16 text-center md:max-w-2xl md:px-8">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Eklan Pressure Test
        </p>
        <p className="text-2xl font-bold font-nunito text-foreground mb-3">Coming soon</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          This experience is not available yet. Check back later.
        </p>
        <Link
          href="/account/practice"
          className="inline-block mt-8 text-sm font-semibold text-green-600 hover:underline"
        >
          Back to Practice
        </Link>
      </div>
      <BottomNav />
    </div>
  );
}
