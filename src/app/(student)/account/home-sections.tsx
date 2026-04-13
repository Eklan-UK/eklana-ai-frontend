import Link from "next/link";
import { ChevronRight, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getUserFirstName } from "@/utils/user";
import { getCurrentUser } from "./get-user";
import { getAssignedDrills } from "./get-drills";
import { getDrillStatus } from "@/utils/drill";
import { DrillCard } from "@/components/drills/DrillCard";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { StreakBadge } from "@/components/streak/StreakBadge";

export async function HomeGreetingHeader() {
  const userData = await getCurrentUser();
  const firstName = getUserFirstName(userData?.user);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Hello, {firstName || "User"}! 👋
          </h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">
          Good to see you again
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 2L12.09 7.26L18 8.27L14 12.14L14.91 18.02L10 15.77L5.09 18.02L6 12.14L2 8.27L7.91 7.26L10 2Z"
                fill="white"
              />
            </svg>
          </div>
          <StreakBadge />
          <NotificationBell />
        </div>
      </div>
    </>
  );
}

export async function AssignedDrillsSection() {
  const { drills } = await getAssignedDrills();

  return (
    <div className="mb-6 md:mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg md:text-xl font-bold text-gray-900">
          Assigned Drills
        </h3>
        <Link
          href="/account/drills"
          className="text-sm text-green-600 flex items-center gap-1"
        >
          See All
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {drills.length === 0 ? (
        <Card className="text-center py-8">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No drills assigned yet</p>
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
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
