"use client";

import { useTranslations } from "next-intl";
import { StreakBadge } from "@/components/streak/StreakBadge";
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
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {t("hello", { name: displayName })}
        </h1>
        <p className="text-sm md:text-base text-gray-600 mt-1">
          {t("goodToSeeYou")}
        </p>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path
              d="M10 2L12.09 7.26L18 8.27L14 12.14L14.91 18.02L10 15.77L5.09 18.02L6 12.14L2 8.27L7.91 7.26L10 2Z"
              fill="white"
            />
          </svg>
        </div>
        <StreakBadge />
        <NotificationBell />
      </div>
    </div>
  );
}
