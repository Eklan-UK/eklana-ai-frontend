"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { appendReturnTo } from "@/lib/drill-list-filters";

function EditDrillPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const drillId = params.id as string;
  const returnToParam = searchParams.get("returnTo");

  useEffect(() => {
    const createUrl = returnToParam
      ? appendReturnTo(`/tutor/drills/create?drillId=${drillId}`, returnToParam)
      : `/tutor/drills/create?drillId=${drillId}`;
    router.push(createUrl);
  }, [drillId, returnToParam, router]);

  return null;
}

export default function EditDrillPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <EditDrillPageContent />
    </Suspense>
  );
}
