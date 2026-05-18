"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ChevronRight, CalendarDays, Lock } from "lucide-react";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { ProLockHoverWrap } from "@/components/subscription/ProLockHoverWrap";
import { ProLockedCtaSwap } from "@/components/subscription/ProLockedCtaSwap";

export function AccountHomeContentClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("account");
  const { data: me, isLoading: meLoading } = useUserCurrent();
  const isSubscribed = !meLoading && me?.user?.isSubscribed === true;

  return (
    <>
      <div className="mb-4 md:mb-6">
        {isSubscribed ? (
          <Link href="/account/classes">
            <Button
              variant="outline"
              size="lg"
              fullWidth
              className="border-primary/30 text-primary hover:bg-primary/10"
            >
              <CalendarDays className="mr-2 h-5 w-5 shrink-0" />
              {t("viewSessions")}
            </Button>
          </Link>
        ) : (
          <ProLockHoverWrap className="block">
            <ProLockedCtaSwap density="full">
              <Button
                variant="outline"
                size="lg"
                fullWidth
                tabIndex={-1}
                type="button"
                className="border-border text-muted-foreground opacity-80 cursor-default pointer-events-none"
              >
                <Lock className="mr-2 h-4 w-4 shrink-0" />
                {t("viewSessions")}
              </Button>
            </ProLockedCtaSwap>
          </ProLockHoverWrap>
        )}
      </div>

      <div className="mb-4 md:mb-6">
        <h3 className="text-lg md:text-xl font-bold font-nunito text-foreground mb-4">
          {t("yourProgress")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>

        <Link
          href="/account/bookmarks"
          className="mt-3 flex items-center justify-between w-full border border-border rounded-full px-4 py-3 hover:bg-muted transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
              <span className="text-base">📘</span>
            </div>
            <span className="text-sm font-semibold font-satoshi text-foreground">
              {t("savedDrills")}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-text-secondary transition-colors" />
        </Link>
      </div>
    </>
  );
}
