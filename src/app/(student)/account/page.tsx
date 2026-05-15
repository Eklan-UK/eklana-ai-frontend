// Server Component - Home Page with ISR + streaming Suspense
import { Suspense } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { generateMetadata } from "@/utils/seo";
import { TodaysFocusCard } from "@/components/daily-focus/TodaysFocusCard";
import { PushNotificationPrompt } from "@/components/notifications/PushNotificationPrompt";
import { HomeConfidenceCard } from "@/components/confidence/HomeConfidenceCard";
import { HomePronunciationCard } from "@/components/pronunciation/HomePronunciationCard";
import { HomeAccurateSentenceCard } from "@/components/progress/HomeAccurateSentenceCard";
import { HomeResponseSpeedCard } from "@/components/progress/HomeResponseSpeedCard";
import { HomeHeaderSkeleton } from "@/components/ui/HomeSkeleton";
import { HomeGreetingHeader } from "./home-sections";
import { AssignedDrillsSectionClient } from "./assigned-drills-section-client";
import { AccountHomeContentClient } from "./account-home-content-client";

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
    <div className="min-h-screen bg-background pb-[max(5.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="h-6"></div>

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        <Suspense fallback={<HomeHeaderSkeleton />}>
          <HomeGreetingHeader />
        </Suspense>

        <PushNotificationPrompt />

        <TodaysFocusCard />

        <AccountHomeContentClient>
          <HomeConfidenceCard />
          <HomePronunciationCard />
          <HomeAccurateSentenceCard />
          <HomeResponseSpeedCard />
        </AccountHomeContentClient>

        <AssignedDrillsSectionClient />
      </div>

      <BottomNav />
    </div>
  );
}
