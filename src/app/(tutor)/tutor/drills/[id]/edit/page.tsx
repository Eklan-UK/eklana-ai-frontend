"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function EditDrillPage() {
  const params = useParams();
  const router = useRouter();
  const drillId = params.id as string;

  useEffect(() => {
    // Redirect to create page with drillId query param
    router.push(`/tutor/drills/create?drillId=${drillId}`);
  }, [drillId, router]);

  return null;
}


