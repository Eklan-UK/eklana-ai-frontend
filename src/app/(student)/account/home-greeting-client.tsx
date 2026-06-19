"use client";

import { useTranslations } from "next-intl";
import { StreakBadge } from "@/components/streak/StreakBadge";
import { HomeBadgeButton } from "@/components/badges/HomeBadgeButton";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export function HomeGreetingClient({
  firstName,
}: {
  firstName?: string | null;
}) {
  const t = useTranslations("account");
  const displayName = firstName?.trim() || t("guestName");

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          {t("hello", { name: displayName })}
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          {t("goodToSeeYou")}
        </p>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <HomeBadgeButton />
        <StreakBadge />
        <NotificationBell />
      </div>
    </div>
  );
}
