// Server Component - Drill Detail Page
import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { getDrillById } from "./get-drill";
import { DrillDetailClient } from "./drill-detail-client";

// Uses cookies() via getDrillById — must be dynamic
export const dynamic = "force-dynamic";

export default async function DrillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const drill = await getDrillById(id);

  if (!drill) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Drill not found</h2>
          <Link href="/tutor/drills/all">
            <Button variant="primary">Back to Drills</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <DrillDetailClient drill={drill} drillId={id} />
    </Suspense>
  );
}
