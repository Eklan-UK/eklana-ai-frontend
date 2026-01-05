// Server Component - Home Page with ISR
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Flame,
  Clock,
  Target,
  TrendingUp,
  Phone,
  ChevronRight,
  BookOpen,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { getUserFirstName } from "@/utils/user";
import { getCurrentUser } from "./get-user";
import { getAssignedDrills } from "./get-drills";
import { getDrillTypeInfo, formatDate, getDrillStatus } from "@/utils/drill";
import { generateMetadata } from "@/utils/seo";
import { DrillCard } from "@/components/drills/DrillCard";

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

  // Filter drills by status
  const activeDrills = drills.filter(isDrillActive);
  const upcomingDrills = drills.filter(isDrillUpcoming);
  const missedDrills = drills.filter(
    (drill: any) => getDrillStatus(drill) === "missed"
  );

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 py-6 md:max-w-4xl md:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Hello, {firstName || "User"}! 👋
            </h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">
              Ready to build today&apos;s confidence?
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
            <div className="bg-yellow-100 px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-semibold text-gray-900">22</span>
            </div>
            <button className="p-2">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Today's Focus Card */}
        <Card className="bg-gradient-to-br from-green-600 to-green-700 text-white mb-6 md:mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-green-500 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
              <Flame className="w-3 h-3" /> TODAY&apos;S FOCUS
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-2">Really</h2>
          <p className="text-green-100 mb-4">/&apos;ri:.əl.i/</p>
          <div className="flex items-center gap-4 text-sm text-green-100 mb-6">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>5-7 minutes</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Target className="w-4 h-4" />
              <span>Beginner-Intermediate</span>
            </div>
          </div>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 mb-4"
          >
            Start Today&apos;s Practice
          </Button>
          <p className="text-xs text-green-100 text-center">
            Top 3% of Korean learners struggle with this R-L sound. Let&apos;s
            fix it today.
          </p>
        </Card>

        {/* Your Progress Section */}
        <div className="mb-6 md:mb-8">
          <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4">
            Your Progress
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Confidence
                    </p>
                    <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                      <span>↗</span> +5% this week
                    </p>
                  </div>
                </div>
                <div className="relative w-16 h-16">
                  <svg
                    className="transform -rotate-90"
                    width="64"
                    height="64"
                    viewBox="0 0 64 64"
                  >
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="#e5e7eb"
                      strokeWidth="4"
                      fill="none"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="#3b82f6"
                      strokeWidth="4"
                      fill="none"
                      strokeDasharray={`${74 * 0.74} ${74 * 0.26}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-blue-600">74%</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Phone className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Pronunciation
                    </p>
                    <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                      <span>↗</span> +3% this week
                    </p>
                  </div>
                </div>
                <div className="relative w-16 h-16">
                  <svg
                    className="transform -rotate-90"
                    width="64"
                    height="64"
                    viewBox="0 0 64 64"
                  >
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="#e5e7eb"
                      strokeWidth="4"
                      fill="none"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="#22c55e"
                      strokeWidth="4"
                      fill="none"
                      strokeDasharray={`${74 * 0.78} ${74 * 0.22}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-green-600">
                      78%
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
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
              {/* Show active drills first, then other non-completed drills */}
              {(() => {
                // Prioritize active drills, then show other non-completed drills
                const nonCompletedDrills = drills.filter((d: any) => {
                  const status = getDrillStatus(d);
                  return status !== "completed";
                });

                // Sort: active first, then by date
                const sortedDrills = nonCompletedDrills.sort(
                  (a: any, b: any) => {
                    const aStatus = getDrillStatus(a);
                    const bStatus = getDrillStatus(b);
                    if (aStatus === "active" && bStatus !== "active") return -1;
                    if (bStatus === "active" && aStatus !== "active") return 1;
                    return (
                      new Date(a.date).getTime() - new Date(b.date).getTime()
                    );
                  }
                );

                return sortedDrills.slice(0, 3);
              })().map((drill: any) => {
                const dueDate = drill.dueDate
                  ? new Date(drill.dueDate)
                  : (() => {
                      const endDate = new Date(drill.date);
                      endDate.setDate(
                        endDate.getDate() + (drill.duration_days || 1) - 1
                      );
                      return endDate;
                    })();

                return (
                  <DrillCard
                    key={drill._id}
                    drill={drill}
                    assignmentId={drill.assignmentId}
                    dueDate={dueDate.toISOString()}
                    completedAt={drill.completedAt}
                    status={getDrillStatus(drill)}
                    variant="default"
                    showStartButton={true}
                  />
                );
              })}
            </div>
          )}

          {upcomingDrills.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Upcoming
              </h4>
              <div className="space-y-2">
                {upcomingDrills.slice(0, 2).map((drill: any) => {
                  const typeInfo = getDrillTypeInfo(drill.type);
                  const drillUrl = drill.assignmentId
                    ? `/account/drills/${drill._id}?assignmentId=${drill.assignmentId}`
                    : `/account/drills/${drill._id}`;
                  return (
                    <Link key={drill._id} href={drillUrl}>
                      <Card
                        className={`${typeInfo.borderColor} opacity-75 hover:opacity-100 transition-opacity cursor-pointer`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span>{typeInfo.icon}</span>
                            <span className="font-medium text-gray-900">
                              {drill.title}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            Starts {formatDate(drill.date)}
                          </span>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {missedDrills.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-red-700 mb-2">
                Missed
              </h4>
              <div className="space-y-2">
                {missedDrills.slice(0, 2).map((drill: any) => {
                  const dueDate = drill.dueDate
                    ? new Date(drill.dueDate)
                    : (() => {
                        const endDate = new Date(drill.date);
                        endDate.setDate(
                          endDate.getDate() + (drill.duration_days || 1) - 1
                        );
                        return endDate;
                      })();

                  return (
                    <DrillCard
                      key={drill._id}
                      drill={drill}
                      assignmentId={drill.assignmentId}
                      dueDate={dueDate.toISOString()}
                      status="missed"
                      variant="compact"
                      showStartButton={false}
                      className="border-red-200 bg-red-50"
                    />
                  );
                })}
              </div>
            </div>
          )}
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
          <div className="space-y-3">
            <Card>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M22 16.92V19.92C22.0011 20.1985 21.9441 20.4742 21.8325 20.7292C21.7209 20.9841 21.5573 21.2126 21.3528 21.3992C21.1482 21.5857 20.9074 21.7262 20.6446 21.8117C20.3818 21.8972 20.1028 21.9258 19.828 21.8957C19.5532 21.8655 19.2882 21.7772 19.05 21.636L16.5 20.136L14.05 21.636C13.8118 21.7772 13.5468 21.8655 13.272 21.8957C12.9972 21.9258 12.7182 21.8972 12.4554 21.8117C12.1926 21.7262 11.9518 21.5857 11.7472 21.3992C11.5427 21.2126 11.3791 20.9841 11.2675 20.7292C11.1559 20.4742 11.0989 20.1985 11.1 19.92V16.92"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M16.5 11.2C16.8978 11.2 17.2794 11.358 17.5607 11.6393C17.842 11.9206 18 12.3022 18 12.7C18 13.0978 17.842 13.4794 17.5607 13.7607C17.2794 14.042 16.8978 14.2 16.5 14.2L7.5 14.2C7.10218 14.2 6.72064 14.042 6.43934 13.7607C6.15804 13.4794 6 13.0978 6 12.7C6 12.3022 6.15804 11.9206 6.43934 11.6393C6.72064 11.358 7.10218 11.2 7.5 11.2L16.5 11.2Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Client Call Practice
                    </p>
                    <p className="text-xs text-gray-500">85% • 2 hours ago</p>
                  </div>
                </div>
                <button className="text-blue-600 flex items-center gap-1 text-sm font-medium">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8 2V14M2 8H14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  Redo
                </button>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M3 18V12C3 9.61305 3.94821 7.32387 5.63604 5.63604C7.32387 3.94821 9.61305 3 12 3C14.3869 3 16.6761 3.94821 18.364 5.63604C20.0518 7.32387 21 9.61305 21 12V18"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M21 18C21 18.5304 20.7893 19.0391 20.4142 19.4142C20.0391 19.7893 19.5304 20 19 20H17L15 22H9L7 20H5C4.46957 20 3.96086 19.7893 3.58579 19.4142C3.21071 19.0391 3 18.5304 3 18V16"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Listening Exercise
                    </p>
                    <p className="text-xs text-gray-500">92% • Yesterday</p>
                  </div>
                </div>
                <button className="text-blue-600 flex items-center gap-1 text-sm font-medium">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8 2V14M2 8H14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  Redo
                </button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
