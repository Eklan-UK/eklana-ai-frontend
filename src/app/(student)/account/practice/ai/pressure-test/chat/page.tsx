"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PressureTestDrill } from "@/components/ai/PressureTestDrill";

function PressureTestChatPageInner() {
  const searchParams = useSearchParams();
  const drillId = searchParams.get("drillId");

  if (!drillId) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4">
        <p className="text-gray-600 text-center">A drill is required to start the pressure test.</p>
      </div>
    );
  }

  return <PressureTestDrill drillId={drillId} />;
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
