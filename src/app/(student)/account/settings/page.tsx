"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  UserRound,
  Globe2,
  CreditCard,
  Languages,
  Target,
  Bell,
  BookOpen,
  Palette,
  Lock,
  Shield,
  HelpCircle,
  Mail,
  MessageSquare,
  Info,
  FileText,
  Trash2,
  LogOut,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { ProfileMenuRow } from "@/components/account/ProfileMenuRow";
import { ProfileMenuSection } from "@/components/account/ProfileMenuSection";
import { ThemeSettingSheet } from "@/components/account/ThemeSettingSheet";
import { FeedbackSheet } from "@/components/account/FeedbackSheet";
import { CloseAccountDialog } from "@/components/account/CloseAccountDialog";
import { useAuthStore } from "@/store/auth-store";
import { getUserInitials, getUserDisplayName } from "@/utils/user";
import { authService } from "@/services/auth.service";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { formatProfileLearningGoalsShort } from "@/lib/learner-learning-goals";
import { APP_VERSION } from "@/lib/app-version";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function EmailVerificationRow() {
  const t = useTranslations("settings");
  const { user } = useAuthStore();
  const [isSending, setIsSending] = useState(false);
  const isEmailVerified = user?.isEmailVerified || user?.emailVerified;

  const handleSendVerification = async () => {
    setIsSending(true);
    try {
      await authService.sendVerificationEmail();
      toast.success(t("verificationEmailSent"));
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("verificationEmailFailed")));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-border">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-muted text-muted-foreground">
        <Mail className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-foreground">
          {t("emailVerification")}
        </p>
        <p
          className={`text-sm ${
            isEmailVerified ? "text-primary" : "text-accent-red"
          }`}
        >
          {isEmailVerified ? t("verified") : t("notVerified")}
        </p>
        {!isEmailVerified ? (
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("verifyEmailHint")}
          </p>
        ) : null}
      </div>
      {!isEmailVerified ? (
        <button
          type="button"
          onClick={handleSendVerification}
          disabled={isSending}
          className="text-sm text-primary font-medium shrink-0 disabled:opacity-50"
        >
          {isSending ? t("sendingEllipsis") : t("verify")}
        </button>
      ) : null}
    </div>
  );
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tTheme = useTranslations("settingsTheme");
  const tCommon = useTranslations("common");
  const { user, logout, isLoading } = useAuthStore();
  const { data: me, isLoading: meLoading } = useUserCurrent();
  const { theme } = useTheme();
  const router = useRouter();
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const initials = getUserInitials(user);
  const displayName = getUserDisplayName(user);
  const profile = me?.profile;
  const valueSuffix =
    meLoading && !me ? tCommon("loadingEllipsis") : undefined;

  const themeLabel = useMemo(() => {
    if (theme === "dark") return tTheme("dark");
    if (theme === "system") return tTheme("system");
    return tTheme("light");
  }, [theme, tTheme]);

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
      <Header showBack title={t("pageTitle")} />

      <div className="max-w-md mx-auto px-4 md:max-w-2xl md:px-8 space-y-4 pt-2">
        <div className="flex items-center gap-4 py-4">
          {user?.avatar ? (
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-primary">
              <Image
                src={user.avatar}
                alt={displayName}
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-pink-400 via-primary-400 to-blue-400 flex items-center justify-center text-2xl md:text-3xl font-bold text-white">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-lg md:text-xl font-bold text-foreground truncate">
              {displayName}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {user?.email || ""}
            </p>
          </div>
        </div>

        <Card>
          <ProfileMenuSection title={t("accountSection")}>
            <ProfileMenuRow
              icon={UserRound}
              title={t("myProfile")}
              href="/account/profile/edit"
              iconTone="primary"
            />
            <ProfileMenuRow
              icon={Globe2}
              title={t("nationality")}
              subtitle={
                valueSuffix ??
                (profile?.nationality?.trim() || tCommon("notSet"))
              }
              href="/account/settings/nationality"
              iconTone="blue"
            />
            <ProfileMenuRow
              icon={CreditCard}
              title={t("subscriptions")}
              href="/account/settings/subscriptions"
              iconTone="yellow"
              last
            />
          </ProfileMenuSection>
        </Card>

        <Card>
          <ProfileMenuSection title={t("preferences")}>
            <ProfileMenuRow
              icon={Languages}
              title={t("appLanguage")}
              subtitle={
                valueSuffix ?? (profile?.language?.trim() || tCommon("notSet"))
              }
              href="/account/settings/language"
              iconTone="primary"
            />
            <ProfileMenuRow
              icon={Target}
              title={t("learningGoals")}
              subtitle={
                valueSuffix ?? formatProfileLearningGoalsShort(profile || {})
              }
              href="/account/settings/goals"
              iconTone="blue"
            />
            <ProfileMenuRow
              icon={Bell}
              title={t("notifications")}
              href="/account/settings/notifications"
              iconTone="yellow"
            />
            <ProfileMenuRow
              icon={BookOpen}
              title={t("lesson")}
              href="/account/settings/lesson"
              iconTone="muted"
            />
            <ProfileMenuRow
              icon={Palette}
              title={t("appearance")}
              subtitle={themeLabel}
              onClick={() => setThemeSheetOpen(true)}
              iconTone="primary"
              last
            />
          </ProfileMenuSection>
        </Card>

        <Card>
          <ProfileMenuSection title={t("securityPrivacy")}>
            <EmailVerificationRow />
            <ProfileMenuRow
              icon={Lock}
              title={t("changePassword")}
              href="/account/settings/password"
              iconTone="muted"
            />
            <ProfileMenuRow
              icon={Shield}
              title={t("privacyPolicy")}
              href="/account/settings/privacy"
              iconTone="blue"
              last
            />
          </ProfileMenuSection>
        </Card>

        <Card>
          <ProfileMenuSection title={t("supportFeedback")}>
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

        <Card>
          <ProfileMenuSection title={t("other")}>
            <ProfileMenuRow
              icon={Info}
              title={t("about")}
              subtitle={t("version", { version: APP_VERSION })}
              iconTone="muted"
            />
            <ProfileMenuRow
              icon={FileText}
              title={t("termsOfUse")}
              href="/account/settings/terms"
              iconTone="muted"
            />
            <ProfileMenuRow
              icon={Trash2}
              title={t("closeAccount")}
              onClick={() => setCloseOpen(true)}
              danger
            />
            <ProfileMenuRow
              icon={LogOut}
              title={isLoading ? t("loggingOutEllipsis") : t("logout")}
              onClick={handleLogout}
              danger
              last
            />
          </ProfileMenuSection>
        </Card>
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
