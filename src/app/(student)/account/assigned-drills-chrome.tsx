"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

export function AssignedDrillsTitleRow() {
  const t = useTranslations("account");

  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg md:text-xl font-bold text-gray-900">
        {t("assignedDrills")}
      </h3>
      <Link
        href="/account/drills"
        className="text-sm text-green-600 flex items-center gap-1"
      >
        {t("seeAll")}
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

export function AssignedDrillsEmptyMessage() {
  const t = useTranslations("account");
  return <p className="text-gray-600">{t("noDrillsYet")}</p>;
}
