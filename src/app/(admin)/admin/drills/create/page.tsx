"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { DrillCreatePageContent } from "@/components/drills/DrillCreatePageContent";

function AdminDrillCreatePageContent() {
  return <DrillCreatePageContent variant="admin" />;
}

export default function AdminDrillCreatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#418b43]" />
        </div>
      }
    >
      <AdminDrillCreatePageContent />
    </Suspense>
  );
}
