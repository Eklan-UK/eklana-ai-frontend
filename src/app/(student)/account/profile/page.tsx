"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Settings,
  Camera,
  Bookmark,
  Flame,
  Clock,
  TrendingUp,
  CalendarDays,
  UserRound,
  CreditCard,
  HelpCircle,
  Mail,
  MessageSquare,
  LogOut,
} from "lucide-react";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { ProfileMenuRow } from "@/components/account/ProfileMenuRow";
import { ProfileMenuSection } from "@/components/account/ProfileMenuSection";
import { ProfileStatTriple } from "@/components/account/ProfileStatTriple";
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

  const savedCount = bookmarksLoading
    ? "…"
    : String(bookmarks?.length ?? 0);
  const streakValue = streakLoading
    ? "…"
    : String(streak?.currentStreak ?? 0);
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

      <div className="bg-gradient-to-br from-green-600 to-green-700 text-white pt-4 pb-10 md:pt-8 md:pb-14">
        <div className="max-w-md mx-auto px-4 md:max-w-2xl md:px-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl md:text-2xl font-bold">{t("pageTitle")}</h1>
            <Link
              href="/account/settings"
              aria-label={t("settingsAria")}
              className="rounded-lg p-1 hover:bg-white/10"
            >
              <Settings className="w-6 h-6 text-white" />
            </Link>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="relative shrink-0">
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
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-pink-400 via-primary-400 to-blue-400 flex items-center justify-center text-3xl md:text-4xl font-bold text-white border-4 border-white">
                  {initials}
                </div>
              )}
              <Link
                href="/account/profile/photo"
                aria-label={t("changePhotoAria")}
                className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full bg-white text-green-700 shadow-md"
              >
                <Camera className="size-4" />
              </Link>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl md:text-2xl font-bold mb-1 truncate">
                {displayName}
              </h2>
              <p className="text-green-100 text-sm md:text-base mb-2 truncate">
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

          <Card className="bg-white/15 border-white/20 backdrop-blur-sm mb-0 py-3">
            <ProfileStatTriple
              variant="onDark"
              items={[
                {
                  icon: Bookmark,
                  value: savedCount,
                  label: t("saved"),
                  href: "/account/bookmarks",
                },
                {
                  icon: Flame,
                  value: streakValue,
                  label: t("dayStreak"),
                  href: "/account/streak",
                },
                {
                  icon: Clock,
                  value: timeValue,
                  label: t("timePracticed"),
                },
              ]}
            />
          </Card>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8 -mt-4">
        <Card className="mb-4">
          <ProfileMenuSection>
            <ProfileMenuRow
              icon={TrendingUp}
              title={t("myProgress")}
              subtitle={t("myProgressSubtitle")}
              href="/account/progress"
              iconTone="primary"
            />
            <ProfileMenuRow
              icon={CalendarDays}
              title={t("myPlan")}
              subtitle={t("myPlanSubtitle")}
              href="/account"
              iconTone="blue"
              last
            />
          </ProfileMenuSection>
        </Card>

        <Card className="mb-4">
          <ProfileMenuSection title={t("account")}>
            <ProfileMenuRow
              icon={UserRound}
              title={t("accountInfo")}
              subtitle={t("accountInfoSubtitle")}
              href="/account/profile/edit"
              iconTone="muted"
            />
            <ProfileMenuRow
              icon={CreditCard}
              title={t("subscriptions")}
              subtitle={t("subscriptionsSubtitle")}
              href="/account/settings/subscriptions"
              iconTone="yellow"
              last
            />
          </ProfileMenuSection>
        </Card>

        <Card className="mb-4">
          <ProfileMenuSection title={t("support")}>
            <ProfileMenuRow
              icon={HelpCircle}
              title={t("faq")}
              href="/account/settings/faq"
              iconTone="blue"
            />
            <ProfileMenuRow
              icon={Mail}
              title={t("contact")}
              href="/account/settings/contact"
              iconTone="muted"
            />
            <ProfileMenuRow
              icon={MessageSquare}
              title={t("feedback")}
              onClick={() => setFeedbackOpen(true)}
              iconTone="primary"
              last
            />
          </ProfileMenuSection>
        </Card>

        <Card className="mb-4">
          <ProfileMenuSection>
            <ProfileMenuRow
              icon={LogOut}
              title={logoutLoading ? t("loggingOut") : t("logOut")}
              onClick={handleLogout}
              danger
              last
            />
          </ProfileMenuSection>
        </Card>
      </div>

      <FeedbackSheet
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
      <BottomNav />
    </div>
  );
}
