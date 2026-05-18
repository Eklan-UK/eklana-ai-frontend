"use client";

import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { ProLockHoverWrap } from "@/components/subscription/ProLockHoverWrap";
import { ProLockedCtaSwap } from "@/components/subscription/ProLockedCtaSwap";

export function AssignedDrillsTitleRow({ isSubscribed = true }: { isSubscribed?: boolean }) {
  const t = useTranslations("account");

  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg md:text-xl font-bold text-foreground">
        {t("assignedDrills")}
      </h3>
      {isSubscribed ? (
        <Link
          href="/account/drills"
          className="text-sm text-green-600 flex items-center gap-1"
        >
          {t("seeAll")}
          <ChevronRight className="w-4 h-4" />
        </Link>
      ) : (
        <ProLockHoverWrap className="inline-flex">
          <ProLockedCtaSwap density="chip">
            <span className="text-sm text-muted-foreground flex items-center gap-1 opacity-70 cursor-default pointer-events-none rounded-md border border-border bg-muted/40 px-2.5 py-1">
              {t("seeAll")}
              <Lock className="w-3.5 h-3.5" />
            </span>
          </ProLockedCtaSwap>
        </ProLockHoverWrap>
      )}
    </div>
  );
}

export function AssignedDrillsEmptyMessage() {
  const t = useTranslations("account");
  return <p className="text-muted-foreground">{t("noDrillsYet")}</p>;
}
