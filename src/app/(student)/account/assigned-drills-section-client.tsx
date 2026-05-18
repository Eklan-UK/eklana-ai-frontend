"use client";

import { BookOpen } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useLearnerDrills } from "@/hooks/useDrills";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { getDrillStatus } from "@/utils/drill";
import { DrillCard } from "@/components/drills/DrillCard";
import {
  AssignedDrillsTitleRow,
  AssignedDrillsEmptyMessage,
} from "./assigned-drills-chrome";
import { AssignedDrillsSkeleton } from "@/components/ui/HomeSkeleton";
import { isUserSubscribed } from "@/lib/api/user-subscription";

function safeDueIso(item: {
  dueDate?: string | Date | null;
  drill?: { date?: string | Date | null };
  assignedAt?: string | Date | null;
}): string {
  const raw = item.dueDate ?? item.drill?.date ?? item.assignedAt ?? null;
  if (raw != null) {
    const d = new Date(raw as string | Date);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

/**
 * Home assigned drills — uses the same React Query + `/my-drills` path as
 * `/account/drills` so the list cannot diverge from server-only RSC fetch.
 */
export function AssignedDrillsSectionClient() {
  const { data: drills = [], isLoading, isError } = useLearnerDrills({
    limit: 4,
  });
  const { data: me, isLoading: meLoading } = useUserCurrent();
  const subscribed = isUserSubscribed(me?.user);

  if (isLoading || meLoading) {
    return <AssignedDrillsSkeleton />;
  }

  const sorted = [...drills].sort((a: any, b: any) => {
    const dateA = new Date(a.assignedAt || a.drill?.date || 0).getTime();
    const dateB = new Date(b.assignedAt || b.drill?.date || 0).getTime();
    return dateB - dateA;
  });
  const top = sorted.slice(0, 4);

  return (
    <div className="mb-6 md:mb-8">
      <AssignedDrillsTitleRow isSubscribed={subscribed} />

      {isError ? (
        <Card className="text-center py-8 px-4">
          <p className="text-sm text-muted-foreground">
            Could not load assigned drills. Please refresh the page.
          </p>
        </Card>
      ) : top.length === 0 ? (
        <Card className="text-center py-8">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <AssignedDrillsEmptyMessage />
        </Card>
      ) : (
        <div className="space-y-3 mb-4">
          {top.map((item: any) => {
            const drillDoc = item.drill ?? item;
            const assignmentId =
              item.assignmentId != null ? String(item.assignmentId) : undefined;
            return (
              <DrillCard
                key={assignmentId || String(drillDoc?._id ?? "")}
                drill={drillDoc}
                assignmentId={assignmentId}
                assignedBy={item.assignedBy}
                dueDate={safeDueIso(item)}
                completedAt={item.completedAt}
                latestAttempt={item.latestAttempt}
                status={getDrillStatus(item)}
                variant="detailed"
                showStartButton
                locked={!subscribed}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
