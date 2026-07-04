"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { DrillCreatePageContent } from "@/components/drills/DrillCreatePageContent";

function CreateDrillPageContent() {
  return <DrillCreatePageContent variant="tutor" />;
}

export default function CreateDrillPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#418b43]" />
        </div>
      }
    >
      <CreateDrillPageContent />
    </Suspense>
  );
}
