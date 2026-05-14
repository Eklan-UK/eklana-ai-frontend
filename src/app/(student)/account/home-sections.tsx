import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getUserFirstName } from "@/utils/user";
import { getCurrentUser } from "./get-user";
import { getAssignedDrills } from "./get-drills";
import { getDrillStatus } from "@/utils/drill";
import { isUserSubscribed } from "@/lib/api/user-subscription";
import { DrillCard } from "@/components/drills/DrillCard";
import { HomeGreetingClient } from "./home-greeting-client";
import {
  AssignedDrillsTitleRow,
  AssignedDrillsEmptyMessage,
} from "./assigned-drills-chrome";

export async function HomeGreetingHeader() {
  const userData = await getCurrentUser();
  const firstName = getUserFirstName(userData?.user);

  return <HomeGreetingClient firstName={firstName} />;
}

export async function AssignedDrillsSection() {
  const [{ drills }, userData] = await Promise.all([
    getAssignedDrills(),
    getCurrentUser(),
  ]);

  const subscribed = isUserSubscribed(userData?.user);

  return (
    <div className="mb-6 md:mb-8">
      <AssignedDrillsTitleRow isSubscribed={subscribed} />

      {drills.length === 0 ? (
        <Card className="text-center py-8">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <AssignedDrillsEmptyMessage />
        </Card>
      ) : (
        <div className="space-y-3 mb-4">
          {(() => {
            const sortedDrills = [...drills].sort((a: any, b: any) => {
              const dateA = new Date(
                a.assignedAt || a.createdAt || a.date,
              ).getTime();
              const dateB = new Date(
                b.assignedAt || b.createdAt || b.date,
              ).getTime();
              return dateB - dateA;
            });

            return sortedDrills.slice(0, 4);
          })().map((drill: any) => {
            const dueDate = drill.dueDate
              ? new Date(drill.dueDate)
              : new Date(drill.date || drill.drill?.date);

            return (
              <DrillCard
                key={drill._id || drill.drill?._id}
                drill={drill.drill || drill}
                assignmentId={drill.assignmentId}
                assignedBy={drill.assignedBy}
                dueDate={dueDate.toISOString()}
                completedAt={drill.completedAt}
                status={getDrillStatus(drill)}
                variant="detailed"
                showStartButton={true}
                locked={!subscribed}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
