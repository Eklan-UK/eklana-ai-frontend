"use client";

import { Header } from "@/components/layout/Header";
import Link from "next/link";
import { useAuthStore } from "@/store/auth-store";
import { getUserInitials, getUserDisplayName } from "@/utils/user";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { authService } from "@/services/auth.service";
import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { formatProfileLearningGoalsShort } from "@/lib/learner-learning-goals";

interface SettingItemProps {
  label: string;
  value?: string;
  href?: string;
  onClick?: () => void;
  isDanger?: boolean;
}

interface SettingSection {
  title: string;
  items: SettingItemProps[];
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function useSecuritySettings(): SettingItemProps[] {
  const t = useTranslations("settings");
  return useMemo(
    (): SettingItemProps[] => [
      {
        label: t("changePassword"),
        href: "/account/settings/password",
      },
    ],
    [t]
  );
}

function usePreferenceSettings(): SettingItemProps[] {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const { data: me, isLoading } = useUserCurrent();
  const profile = me?.profile;

  return useMemo((): SettingItemProps[] => {
    const valueSuffix = isLoading && !me ? tCommon("loadingEllipsis") : undefined;
    return [
      {
        label: t("nationality"),
        value:
          valueSuffix ??
          (profile?.nationality?.trim() || tCommon("notSet")),
        href: "/account/settings/nationality",
      },
      {
        label: t("appLanguage"),
        value:
          valueSuffix ?? (profile?.language?.trim() || tCommon("notSet")),
        href: "/account/settings/language",
      },
      {
        label: t("learningGoals"),
        value:
          valueSuffix ?? formatProfileLearningGoalsShort(profile || {}),
        href: "/account/settings/goals",
      },
      {
        label: t("notifications"),
        href: "/account/settings/notifications",
      },
      {
        label: t("lesson"),
        href: "/account/settings/lesson",
      },
      {
        label: t("help"),
        href: "/account/settings/help",
      },
      {
        label: t("subscriptions"),
        href: "/account/settings/subscriptions",
      },
      {
        label: t("privacyPolicy"),
        href: "/account/settings/privacy",
      },
      {
        label: t("termsOfUse"),
        href: "/account/settings/terms",
      },
    ];
  }, [isLoading, me, profile, t, tCommon]);
}

function UserProfileSection() {
  const t = useTranslations("settings");
  const { user } = useAuthStore();
  const initials = getUserInitials(user);
  const displayName = getUserDisplayName(user);

  return (
    <div className="flex items-center gap-4 py-6 border-b border-border">
      {user?.avatar ? (
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-green-500">
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
      <div className="flex-1">
        <h3 className="text-lg md:text-xl font-bold text-foreground mb-1">
          {displayName}
        </h3>
        <Link
          href="/account/profile/edit"
          className="text-sm text-primary font-medium no-underline hover:no-underline"
        >
          {t("editProfile")}
        </Link>
      </div>
    </div>
  );
}

const SettingItem: React.FC<SettingItemProps> = ({
  label,
  value,
  href,
  onClick,
  isDanger = false,
}) => {
  const content = (
    <div
      className={`flex items-center justify-between py-4 border-b border-border ${
        isDanger ? "text-accent-red" : ""
      }`}
    >
      <span className="text-base font-medium">{label}</span>
      <div className="flex items-center gap-2 shrink-0">
        {value && (
          <span className="text-sm text-muted-foreground text-right max-w-[55%]">
            {value}
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block no-underline hover:no-underline">
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left no-underline"
    >
      {content}
    </button>
  );
};

function EmailVerificationSection() {
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
      toast.error(
        getErrorMessage(error, t("verificationEmailFailed"))
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="py-4 border-b border-border">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <span className="text-base font-medium text-foreground block">
            {t("emailVerification")}
          </span>
          <span
            className={`text-sm mt-1 block ${
              isEmailVerified ? "text-primary" : "text-accent-red"
            }`}
          >
            {isEmailVerified ? t("verified") : t("notVerified")}
          </span>
        </div>
        {!isEmailVerified && (
          <button
            type="button"
            onClick={handleSendVerification}
            disabled={isSending}
            className="text-sm text-primary font-medium shrink-0 disabled:opacity-50 no-underline hover:no-underline"
          >
            {isSending ? t("sendingEllipsis") : t("verify")}
          </button>
        )}
      </div>
      {!isEmailVerified && (
        <p className="text-xs text-muted-foreground mt-2">
          {t("verifyEmailHint")}
        </p>
      )}
    </div>
  );
}

function SettingsSection({ title, items }: SettingSection) {
  return (
    <div className="py-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">
        {title}
      </h3>
      {items.map((item, index) => (
        <SettingItem key={`${item.label}-${index}`} {...item} />
      ))}
    </div>
  );
}

function LogoutButton() {
  const t = useTranslations("settings");
  const { logout, isLoading } = useAuthStore();
  const router = useRouter();

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
    <div className="pt-4">
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoading}
        className="w-full text-center py-4 text-accent-red font-semibold disabled:opacity-50"
      >
        {isLoading ? t("loggingOutEllipsis") : t("logout")}
      </button>
    </div>
  );
}

function VersionInfo() {
  const t = useTranslations("settings");
  return (
    <div className="pt-8 pb-4 text-center">
      <span className="text-sm text-muted-foreground">{t("version")}</span>
    </div>
  );
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const preferenceItems = usePreferenceSettings();
  const securityItems = useSecuritySettings();

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="h-6"></div>
      <Header showBack title={t("pageTitle")} />

      <div className="max-w-md mx-auto px-4 md:max-w-2xl md:px-8">
        <UserProfileSection />

        <div className="py-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">
            {t("security")}
          </h3>
          <EmailVerificationSection />
          {securityItems.map((item, index) => (
            <SettingItem key={`security-${index}`} {...item} />
          ))}
        </div>

        <SettingsSection title={t("preferences")} items={preferenceItems} />

        <LogoutButton />
        <VersionInfo />
      </div>
    </div>
  );
}
