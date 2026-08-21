"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ProfileMenuRow } from "@/components/account/ProfileMenuRow";
import { ProfileMenuSection } from "@/components/account/ProfileMenuSection";
import { ThemeSettingSheet } from "@/components/account/ThemeSettingSheet";
import { FeedbackSheet } from "@/components/account/FeedbackSheet";
import { CloseAccountDialog } from "@/components/account/CloseAccountDialog";
import { useAuthStore } from "@/store/auth-store";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { APP_VERSION } from "@/lib/app-version";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const { logout, isLoading } = useAuthStore();
  const { data: me, isLoading: meLoading } = useUserCurrent();
  const router = useRouter();
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const profile = me?.profile;
  const languageLabel =
    meLoading && !me
      ? tCommon("loadingEllipsis")
      : profile?.language?.trim() || t("appLanguageSubtitle");
  const nationalityLabel =
    meLoading && !me
      ? tCommon("loadingEllipsis")
      : profile?.nationality?.trim() || t("nationalitySubtitle");

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
    <div className="min-h-screen bg-background pb-10">
      <div className="h-6" />

      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3 md:max-w-2xl md:px-8">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card shadow-[0px_1px_2px_rgba(0,0,0,0.09)] dark:border dark:border-border"
          >
            <span className="relative block size-[18px] overflow-hidden">
              <Image
                src="/icons/profile/back.svg"
                alt=""
                width={18}
                height={18}
                className="size-full"
                unoptimized
              />
            </span>
          </button>
          <h1 className="font-nunito text-xl font-extrabold leading-[30px] tracking-[-0.3px] text-[#101828] dark:text-foreground">
            {t("pageTitle")}
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-md space-y-4 px-4 py-2 md:max-w-2xl md:px-8">
        <ProfileMenuSection card title={t("accountSection")}>
          <ProfileMenuRow
            iconSrc="/icons/profile/my-profile.svg"
            title={t("myProfile")}
            subtitle={t("myProfileSubtitle")}
            href="/account/profile/edit"
            iconTone="primary"
          />
          <ProfileMenuRow
            iconSrc="/icons/profile/nationality.svg"
            title={t("nationality")}
            subtitle={nationalityLabel}
            href="/account/settings/nationality"
            iconTone="primary"
          />
          <ProfileMenuRow
            iconSrc="/icons/profile/subscriptions.svg"
            title={t("subscriptions")}
            subtitle={t("subscriptionsSubtitle")}
            href="/account/settings/subscriptions"
            iconTone="primary"
            last
          />
        </ProfileMenuSection>

        <ProfileMenuSection card title={t("preferences")}>
          <ProfileMenuRow
            iconSrc="/icons/profile/language.svg"
            title={t("appLanguage")}
            subtitle={languageLabel}
            href="/account/settings/language"
            iconTone="primary"
          />
          <ProfileMenuRow
            iconSrc="/icons/profile/goal.svg"
            title={t("learningGoals")}
            subtitle={t("learningGoalsSubtitle")}
            href="/account/settings/goals"
            iconTone="primary"
          />
          <ProfileMenuRow
            iconSrc="/icons/profile/notifications.svg"
            title={t("notifications")}
            subtitle={t("notificationsSubtitle")}
            href="/account/settings/notifications"
            iconTone="primary"
          />
          <ProfileMenuRow
            iconSrc="/icons/profile/appearance.svg"
            title={t("appearance")}
            subtitle={t("appearanceSubtitle")}
            onClick={() => setThemeSheetOpen(true)}
            iconTone="primary"
            last
          />
        </ProfileMenuSection>

        <ProfileMenuSection card title={t("securityPrivacy")}>
          <ProfileMenuRow
            iconSrc="/icons/profile/lock.svg"
            title={t("changePassword")}
            subtitle={t("passwordSubtitle")}
            href="/account/settings/password"
            iconTone="blue"
          />
          <ProfileMenuRow
            iconSrc="/icons/profile/shield.svg"
            title={t("privacy")}
            subtitle={t("privacySubtitle")}
            href="/account/settings/privacy"
            iconTone="blue"
            last
          />
        </ProfileMenuSection>

        <ProfileMenuSection card title={t("supportFeedback")}>
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

        <ProfileMenuSection card title={t("other")}>
          <ProfileMenuRow
            iconSrc="/icons/profile/about.svg"
            title={t("about")}
            subtitle={t("version", { version: APP_VERSION })}
            iconTone="slate"
          />
          <ProfileMenuRow
            iconSrc="/icons/profile/terms.svg"
            title={t("termsOfUse")}
            subtitle={t("termsSubtitle")}
            href="/account/settings/terms"
            iconTone="slate"
          />
          <ProfileMenuRow
            iconSrc="/icons/profile/close-account.svg"
            title={t("closeAccount")}
            subtitle={t("closeAccountSubtitle")}
            onClick={() => setCloseOpen(true)}
            danger
          />
          <ProfileMenuRow
            iconSrc="/icons/profile/sign-out.svg"
            title={isLoading ? t("loggingOutEllipsis") : t("logout")}
            subtitle={t("signOutSubtitle")}
            onClick={handleLogout}
            danger
            last
          />
        </ProfileMenuSection>
      </div>

      <ThemeSettingSheet
        isOpen={themeSheetOpen}
        onClose={() => setThemeSheetOpen(false)}
      />
      <FeedbackSheet
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
      <CloseAccountDialog
        isOpen={closeOpen}
        onClose={() => setCloseOpen(false)}
      />
    </div>
  );
}
