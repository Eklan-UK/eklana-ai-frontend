"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BottomNav } from "@/components/layout/BottomNav";
import { ProfileIdentityCard } from "@/components/account/ProfileIdentityCard";
import { ProfileMenuRow } from "@/components/account/ProfileMenuRow";
import { ProfileMenuSection } from "@/components/account/ProfileMenuSection";
import { FeedbackSheet } from "@/components/account/FeedbackSheet";
import { useAuthStore } from "@/store/auth-store";
import { getUserInitials, getUserDisplayName } from "@/utils/user";
import { useLearnerTimeStudied } from "@/hooks/useLearnerTimeStudied";
import { useUserStreak } from "@/hooks/useUserStreak";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { useBookmarks } from "@/hooks/useBookmarks";
import { planTitleFromUser } from "@/lib/learner-learning-goals";
import { formatTimePracticed } from "@/domain/progress/skill-bands";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function ProfilePage() {
  const t = useTranslations("profile");
  const { user: authUser, logout, isLoading: logoutLoading } = useAuthStore();
  const { data: me } = useUserCurrent();
  const { data: timeSeconds, isLoading: timeLoading } = useLearnerTimeStudied();
  const { data: streak, isLoading: streakLoading } = useUserStreak();
  const { data: bookmarks, isLoading: bookmarksLoading } = useBookmarks();
  const router = useRouter();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const user = me?.user ?? authUser;
  const subscriptionUser = me?.user ?? null;
  const isSubscribed = subscriptionUser?.isSubscribed === true;
  const initials = getUserInitials(user);
  const displayName = getUserDisplayName(user);
  const userEmail = user?.email || "";
  const planTitle = planTitleFromUser(subscriptionUser);

  const savedCount = bookmarksLoading ? "…" : String(bookmarks?.length ?? 0);
  const streakValue = streakLoading ? "…" : String(streak?.currentStreak ?? 0);
  const timeValue = timeLoading
    ? "…"
    : formatTimePracticed(timeSeconds ?? 0);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success(t("loggedOutSuccess"));
      router.push("/auth/login");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("logoutFailed")));
    }
  };

  return (
    <div className="min-h-screen bg-background pb-[max(5.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="h-6" />

      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3 md:max-w-2xl md:px-8">
          <h1 className="font-nunito text-[26px] font-extrabold leading-[39px] tracking-[-0.5px] text-[#101828] dark:text-foreground">
            {t("pageTitle")}
          </h1>
          <Link
            href="/account/settings"
            aria-label={t("settingsAria")}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card shadow-[0px_1px_2px_rgba(0,0,0,0.09)] dark:border dark:border-border"
          >
            <span className="relative block size-[18px] overflow-hidden">
              <Image
                src="/icons/profile/settings-gear.svg"
                alt=""
                width={18}
                height={18}
                className="size-full"
                unoptimized
              />
            </span>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-md space-y-4 px-4 py-2 md:max-w-2xl md:px-8">
        <ProfileIdentityCard
          name={displayName}
          email={userEmail}
          planLabel={planTitle}
          avatarUri={user?.avatar}
          initial={initials.charAt(0) || "U"}
          photoHref="/account/profile/photo"
          changePhotoAria={t("changePhotoAria")}
          stats={[
            {
              iconSrc: "/icons/profile/stat-saved.svg",
              value: savedCount,
              label: t("saved"),
              href: "/account/bookmarks",
            },
            {
              iconSrc: "/icons/profile/stat-streak.svg",
              value: streakValue,
              label: t("dayStreak"),
              href: "/account/streak",
            },
            {
              iconSrc: "/icons/profile/stat-clock.svg",
              value: timeValue,
              label: t("timePracticed"),
            },
          ]}
        />

        <ProfileMenuSection card>
          <ProfileMenuRow
            iconSrc="/icons/profile/my-progress.svg"
            title={t("myProgress")}
            subtitle={t("myProgressSubtitle")}
            href="/account/progress"
            iconTone="primary"
          />
          <ProfileMenuRow
            iconSrc="/icons/profile/my-plan.svg"
            title={t("myPlan")}
            subtitle={t("myPlanSubtitle")}
            href="/account/drills"
            iconTone="primary"
            last
          />
        </ProfileMenuSection>

        <ProfileMenuSection card title={t("account")}>
          <ProfileMenuRow
            iconSrc="/icons/profile/my-profile.svg"
            title={t("accountInfo")}
            subtitle={t("accountInfoSubtitle")}
            href="/account/profile/edit"
            iconTone="primary"
          />
          <ProfileMenuRow
            iconSrc="/icons/profile/crown.svg"
            title={t("subscriptions")}
            subtitle={t("subscriptionsSubtitle")}
            href="/account/settings/subscriptions"
            iconTone="primary"
            trailing={
              isSubscribed ? (
                <span className="inline-flex items-center justify-center rounded-full border border-[rgba(20,108,91,0.7)] px-3 py-0.5">
                  <span className="font-nunito text-[11.5px] font-extrabold leading-[17.25px] text-[#146c5b]">
                    Pro
                  </span>
                </span>
              ) : null
            }
            last
          />
        </ProfileMenuSection>

        <ProfileMenuSection card title={t("support")}>
          <ProfileMenuRow
            iconSrc="/icons/profile/faq.svg"
            title={t("faq")}
            subtitle={t("faqSubtitle")}
            href="/account/settings/faq"
            iconTone="teal"
          />
          <ProfileMenuRow
            iconSrc="/icons/profile/contact.svg"
            title={t("contact")}
            subtitle={t("contactSubtitle")}
            href="/account/settings/contact"
            iconTone="blue"
          />
          <ProfileMenuRow
            iconSrc="/icons/profile/feedback.svg"
            title={t("feedback")}
            subtitle={t("feedbackSubtitle")}
            onClick={() => setFeedbackOpen(true)}
            iconTone="yellow"
            last
          />
        </ProfileMenuSection>

        <ProfileMenuSection card>
          <ProfileMenuRow
            iconSrc="/icons/profile/logout.svg"
            title={logoutLoading ? t("loggingOut") : t("logOut")}
            subtitle={t("logOutSubtitle")}
            onClick={handleLogout}
            danger
            last
          />
        </ProfileMenuSection>
      </div>

      <FeedbackSheet
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
      <BottomNav />
    </div>
  );
}
