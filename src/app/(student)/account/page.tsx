// Server Component - Home Page with ISR
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Flame,
  Clock,
  Target,
  Phone,
  ChevronRight,
  BookOpen,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { getUserFirstName } from "@/utils/user";
import { getCurrentUser } from "./get-user";
import { getAssignedDrills } from "./get-drills";
import { getUserProgress } from "./get-progress";
import { getDrillTypeInfo, formatDate, getDrillStatus } from "@/utils/drill";
import { generateMetadata } from "@/utils/seo";
import { DrillCard } from "@/components/drills/DrillCard";
import { TodaysFocusCard } from "@/components/daily-focus/TodaysFocusCard";
import { RecentActivities } from "@/components/activity/RecentActivities";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { PushNotificationPrompt } from "@/components/notifications/PushNotificationPrompt";
import { StreakBadge } from "@/components/streak/StreakBadge";
import { HomeConfidenceCard } from "@/components/confidence/HomeConfidenceCard";
import { HomePronunciationCard } from "@/components/pronunciation/HomePronunciationCard";

// Revalidate every 30 seconds (ISR)
export const revalidate = 30;

// SEO Metadata
export const metadata = generateMetadata({
  title: "Dashboard",
  description: "View your assigned drills, progress, and learning activities",
  path: "/account",
});

// Helper function to check if drill is active
function isDrillActive(drill: any) {
  return getDrillStatus(drill) === "active";
}

// Helper function to check if drill is upcoming
function isDrillUpcoming(drill: any) {
  return getDrillStatus(drill) === "upcoming";
}

export default async function HomePage() {
  const userData = await getCurrentUser();
  const firstName = getUserFirstName(userData?.user);
  const { drills } = await getAssignedDrills();
  const progress = await getUserProgress();

  // Show all drills regardless of status - no filtering
  const activeDrills = drills; // Show all drills as active
  const upcomingDrills: any[] = []; // No separate upcoming section
  const missedDrills: any[] = []; // No separate missed section

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Hello, {firstName || "User"}! 👋
            </h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">
              Ready to improve your pronunciation and confidence today?
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

        {/* Push Notification Prompt */}
        <PushNotificationPrompt />

        {/* Today's Focus Card */}
        <TodaysFocusCard />

        {/* Your Progress Section */}
        <div className="mb-4 md:mb-6">
          <h3 className="text-lg md:text-xl font-bold font-nunito text-gray-900 mb-4">
            Your Progress
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <HomeConfidenceCard />

            <HomePronunciationCard />
          </div>

          {/* Saved Drills Pill Button */}
          <Link
            href="/account/bookmarks"
            className="mt-3 flex items-center justify-between w-full border border-gray-200 rounded-full px-4 py-3 hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
                <span className="text-base">📘</span>
              </div>
              <span className="text-sm font-semibold font-satoshi text-gray-900">Saved Drills</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </Link>
        </div>

        {/* Assigned Drills Section */}
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
              {/* Show drills sorted by newest assigned first */}
              {(() => {
                // Sort by assignedAt descending (newest first)
                const sortedDrills = [...drills].sort(
                  (a: any, b: any) => {
                    const dateA = new Date(a.assignedAt || a.createdAt || a.date).getTime();
                    const dateB = new Date(b.assignedAt || b.createdAt || b.date).getTime();
                    return dateB - dateA; // Descending - newest first
                  }
                );

                return sortedDrills.slice(0, 4); // Show only 4 drills
              })().map((drill: any) => {
                // drill.date is now the completion/due date
                const dueDate = drill.dueDate
                  ? new Date(drill.dueDate)
                  : new Date(drill.date || drill.drill?.date);

                // DrillCard will handle navigation via Link component
                // The start button will navigate to the drill page
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

          {/* Removed separate upcoming and missed sections - all drills shown above */}
        </div>

        {/* Recent Activity Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg md:text-xl font-bold text-gray-900">
              Recent Activity
            </h3>
            <Link
              href="/activity"
              className="text-sm text-green-600 flex items-center gap-1"
            >
              See All
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <RecentActivities limit={4} />
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  
  );
}
