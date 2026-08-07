"use client";

import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import {
  Settings,
  Mic,
  Clock,
  Calendar,
  Flame,
  ChevronRight,
  Bookmark,
} from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth-store";
import { getUserInitials, getUserDisplayName } from "@/utils/user";
import Image from "next/image";
import { ConfidenceCard } from "@/components/confidence/ConfidenceCard";
import { PronunciationCard } from "@/components/pronunciation/PronunciationCard";
import { usePronunciation } from "@/hooks/usePronunciation";
import { useLearnerTimeStudied } from "@/hooks/useLearnerTimeStudied";
import { useUserStreak } from "@/hooks/useUserStreak";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import {
  getPlanCardMessage,
  planTitleFromUser,
} from "@/lib/learner-learning-goals";

function formatMinutesFromSeconds(totalSeconds: number) {
  if (totalSeconds <= 0) return "0m";
  const m = Math.round(totalSeconds / 60);
  if (m < 1) return "<1m";
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r > 0 ? `${h}h ${r}m` : `${h}h`;
  }
  return `${m}m`;
}

function weekdayLetter(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00.000Z");
  if (Number.isNaN(d.getTime())) return "";
  return ["S", "M", "T", "W", "T", "F", "S"][d.getUTCDay()] ?? "";
}

export default function ProfilePage() {
  const { user: authUser } = useAuthStore();
  const { data: me } = useUserCurrent();
  const { data: pronunciation, isLoading: pronLoading } = usePronunciation();
  const { data: timeSeconds, isLoading: timeLoading } = useLearnerTimeStudied();
  const { data: streak, isLoading: streakLoading } = useUserStreak();

  // Use me?.user (from /api/v1/users/current) for subscription state — it includes
  // isSubscribed and subscriptionPlan. Fall back to authUser only for display fields.
  const user = me?.user ?? authUser;
  const subscriptionUser = me?.user ?? null;
  const isSubscribed = subscriptionUser?.isSubscribed === true;
  const initials = getUserInitials(user);
  const displayName = getUserDisplayName(user);
  const userEmail = user?.email || "";
  const learnerId = user?._id ? String(user._id) : "";
  const planTitle = planTitleFromUser(subscriptionUser);
  const planMessage = getPlanCardMessage(isSubscribed);

  const overall =
    typeof pronunciation?.overallScore === "number" &&
    !Number.isNaN(pronunciation.overallScore)
      ? Math.round(pronunciation.overallScore)
      : null;

  return (
    <div className="min-h-screen bg-background pb-[max(5.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="h-6"></div>

      <div className="bg-gradient-to-br from-green-600 to-green-700 text-white pt-4 pb-8 md:pt-8 md:pb-12">
        <div className="max-w-md mx-auto px-4 md:max-w-2xl md:px-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl md:text-2xl font-bold">Profile</h1>
            <Link href="/account/settings">
              <Settings className="w-6 h-6 text-white" />
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {user?.avatar ? (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-4 border-white">
                <Image
                  src={user.avatar}
                  alt={displayName}
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-pink-400 via-primary-400 to-blue-400 flex items-center justify-center text-3xl md:text-4xl font-bold text-white">
                {initials}
              </div>
            )}
            <div>
              <h2 className="text-xl md:text-2xl font-bold mb-1">
                {displayName}
              </h2>
              <p className="text-green-100 text-sm md:text-base mb-2">
                {userEmail}
              </p>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                  isSubscribed
                    ? "bg-green-100 text-green-900"
                    : "bg-orange-100 text-orange-950"
                }`}
              >
                {planTitle}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8 -mt-6 md:-mt-8">
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
          <Link href="/account/bookmarks">
            <Card className="text-center h-full hover:bg-muted transition-colors cursor-pointer">
              <div className="flex justify-center mb-2">
                <Bookmark className="w-8 h-8 text-indigo-600" />
              </div>
              <p className="text-sm md:text-base font-bold text-foreground mt-1">
                Bookmarks
              </p>
              <p className="text-xs text-muted-foreground">View saved</p>
            </Card>
          </Link>
          <Card className="text-center">
            <div className="flex justify-center mb-2">
              <Mic className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-foreground">
              {pronLoading ? "—" : overall !== null ? overall : "—"}
            </p>
            <p className="text-xs md:text-sm text-muted-foreground">Clarity</p>
          </Card>
          <Card className="text-center">
            <div className="flex justify-center mb-2">
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-foreground">
              {timeLoading ? "—" : formatMinutesFromSeconds(timeSeconds ?? 0)}
            </p>
            <p className="text-xs md:text-sm text-muted-foreground">Time studied</p>
          </Card>
        </div>

        <ConfidenceCard />
        <PronunciationCard learnerId={learnerId} />

        <Link href="/account/settings/subscriptions" className="block mb-6">
          <Card className="mb-0 hover:bg-muted transition-colors">
            <div className="flex items-center justify-between mb-4">
              <span className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                Current plan
              </span>
              <ChevronRight className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2">
              {planTitle}
            </h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              {planMessage}
            </p>
          </Card>
        </Link>

        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg md:text-xl font-bold text-foreground">Streak</h3>
            <Link
              href="/account/streak"
              className="text-green-600 flex items-center gap-1 text-sm"
            >
              <Calendar className="w-4 h-4" />
              <span>View streak</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-semibold text-foreground">
                {streakLoading
                  ? "…"
                  : streak && streak.currentStreak > 0
                    ? `${streak.currentStreak}-day streak`
                    : "Build your streak"}
              </h4>
              {streak && !streakLoading && streak.currentStreak > 0 && (
                <span className="text-sm text-muted-foreground">
                  Best: {streak.longestStreak} days
                </span>
              )}
            </div>

            {streak && streak.weeklyActivity.length > 0 && (
              <div className="flex items-center justify-center gap-1 sm:gap-2 mb-4">
                {streak.weeklyActivity.map((day) => (
                  <div
                    key={day.date}
                    className={`flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full font-black text-[10px] sm:text-xs ${
                      day.completed
                        ? "bg-green-600 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                    title={day.date}
                  >
                    {weekdayLetter(day.date)}
                  </div>
                ))}
              </div>
            )}

            <div className="bg-yellow-500/10 border border-border rounded-lg p-4 mb-4">
              <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Flame className="w-4 h-4 text-yellow-600" />
                {streak && streak.currentStreak > 0
                  ? "Keep it going"
                  : "Start a streak"}
              </p>
              <p className="text-xs md:text-sm text-muted-foreground">
                Complete daily focus and lessons on consecutive days to grow your
                streak. Open the streak page for a full view.
              </p>
            </div>

            <Link
              href="/account/practice"
              className="inline-flex w-full items-center justify-center rounded-xl font-semibold transition-all duration-200 active:scale-95 bg-[#22c55e] text-white hover:bg-[#16a34a] px-8 py-4 text-lg"
            >
              Continue practice
            </Link>
          </div>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}
