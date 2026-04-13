// Server Component - Home Page with ISR + streaming Suspense
import { Suspense } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/Button";
import { ChevronRight, CalendarDays } from "lucide-react";
import Link from "next/link";
import { generateMetadata } from "@/utils/seo";
import { TodaysFocusCard } from "@/components/daily-focus/TodaysFocusCard";
import { RecentActivities } from "@/components/activity/RecentActivities";
import { PushNotificationPrompt } from "@/components/notifications/PushNotificationPrompt";
import { HomeConfidenceCard } from "@/components/confidence/HomeConfidenceCard";
import { HomePronunciationCard } from "@/components/pronunciation/HomePronunciationCard";
import { HomeAccurateSentenceCard } from "@/components/progress/HomeAccurateSentenceCard";
import { HomeResponseSpeedCard } from "@/components/progress/HomeResponseSpeedCard";
import {
  HomeHeaderSkeleton,
  AssignedDrillsSkeleton,
} from "@/components/ui/HomeSkeleton";
import {
  HomeGreetingHeader,
  AssignedDrillsSection,
} from "./home-sections";

// Revalidate every 30 seconds (ISR)
export const revalidate = 30;

// SEO Metadata
export const metadata = generateMetadata({
  title: "Dashboard",
  description: "View your assigned drills, progress, and learning activities",
  path: "/account",
});

export default async function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <div className="h-6"></div>

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        <Suspense fallback={<HomeHeaderSkeleton />}>
          <HomeGreetingHeader />
        </Suspense>

        <PushNotificationPrompt />

        <TodaysFocusCard />

        <div className="mb-4 md:mb-6">
          <Link href="/account/classes">
            <Button
              variant="outline"
              size="lg"
              fullWidth
              className="border-green-200 text-green-800 hover:bg-green-50"
            >
              <CalendarDays className="mr-2 h-5 w-5 shrink-0" />
              View your classes
            </Button>
          </Link>
        </div>

        <div className="mb-4 md:mb-6">
          <h3 className="text-lg md:text-xl font-bold font-nunito text-gray-900 mb-4">
            Your Progress
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HomeConfidenceCard />
            <HomePronunciationCard />
            <HomeAccurateSentenceCard />
            <HomeResponseSpeedCard />
          </div>

          <Link
            href="/account/bookmarks"
            className="mt-3 flex items-center justify-between w-full border border-gray-200 rounded-full px-4 py-3 hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
                <span className="text-base">📘</span>
              </div>
              <span className="text-sm font-semibold font-satoshi text-gray-900">
                Saved Drills
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </Link>
        </div>

        <Suspense fallback={<AssignedDrillsSkeleton />}>
          <AssignedDrillsSection />
        </Suspense>

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

      <BottomNav />
    </div>
  );
}
