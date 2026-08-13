"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BottomNav } from "@/components/layout/BottomNav";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { SavedDrillsSection } from "@/components/drills/SavedDrillsSection";
import { PracticeStreakHero } from "@/components/practice/PracticeStreakHero";
import { PracticeModesList } from "@/components/practice/PracticeModesList";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { useUserStreak } from "@/hooks/useUserStreak";
import { learnerHasProAccess } from "@/utils/learner-subscription";
import { getUserFirstName, getUserInitials } from "@/utils/user";

export default function PracticePage() {
  const t = useTranslations("account.practiceHub");
  const tAccount = useTranslations("account");
  const { data: me, isLoading: meLoading } = useUserCurrent();
  const { data: streak, isLoading: streakLoading } = useUserStreak();
  // Default locked while loading to prevent flash of unlocked state.
  const isSubscribed = !meLoading && learnerHasProAccess(me?.user);
  const firstName = getUserFirstName(me?.user ?? null);
  const initial = getUserInitials(me?.user ?? null).charAt(0) || "U";

  return (
    <div className="min-h-screen bg-background pb-[max(5.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="h-6" />

      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-md mx-auto px-4 pt-4 pb-3 md:max-w-2xl md:px-8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold font-nunito text-foreground">
                {t("title")}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5 font-nunito">
                {t("subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/account/profile"
                className="flex size-7 items-center justify-center rounded-full bg-[#fbd100] text-[13px] font-extrabold font-nunito text-[#101828] hover:opacity-90 transition-opacity"
                aria-label={t("profileAria")}
              >
                {initial}
              </Link>
              <NotificationBell />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8 space-y-6">
        <PracticeStreakHero
          firstName={firstName === "there" ? null : firstName}
          currentStreak={streak?.currentStreak}
          todayCompleted={streak?.todayCompleted}
          weeklyActivity={streak?.weeklyActivity}
          isLoading={streakLoading}
        />

        <SavedDrillsSection sectionHeading={tAccount("yourProgress")} />

        <PracticeModesList locked={!isSubscribed} />

        {!isSubscribed && !meLoading && (
          <p className="text-sm text-muted-foreground text-center -mt-2">
            <Link
              href="/account/settings/subscriptions"
              className="text-green-600 font-semibold hover:underline"
            >
              {t("upgradeCta")}
            </Link>{" "}
            {t("upgradeHint")}
          </p>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
