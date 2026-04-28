"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PressureTestDrill } from "@/components/ai/PressureTestDrill";

function PressureTestChatPageInner() {
  const searchParams = useSearchParams();
  const drillId = searchParams.get("drillId");
  /** New id on each navigation from the list (`run`); fallback for bookmarks or links without it. */
  const run = searchParams.get("run");
  const [sessionFallback] = useState(() => crypto.randomUUID());
  /** When the page is restored from the browser back-forward cache, remount the drill with a fresh run. */
  const [bfcacheBust, setBfcacheBust] = useState(0);

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setBfcacheBust((n) => n + 1);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  if (!drillId) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4">
        <p className="text-gray-600 text-center">A drill is required to start the pressure test.</p>
      </div>
    );
  }

  const sessionKey = run ?? sessionFallback;

  const mountKey = `${sessionKey}-${bfcacheBust}`;

  return (
    <PressureTestDrill
      key={`${drillId}-${mountKey}`}
      drillId={drillId}
      sessionRunId={mountKey}
    />
  );
}

export default function PressureTestChatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 animate-pulse" />
        </div>
      }
    >
      <PressureTestChatPageInner />
    </Suspense>
  );
}
