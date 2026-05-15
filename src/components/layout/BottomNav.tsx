"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { ProLockHoverWrap } from "@/components/subscription/ProLockHoverWrap";

const HOME_HREF = "/home";

type NavDef = {
  nameKey: "home" | "practice" | "myPlan" | "profile";
  href: string;
  iconActive: string;
  iconInactive: string;
};

const navDefs: NavDef[] = [
  {
    nameKey: "home",
    href: HOME_HREF,
    iconActive: "/icons/home-fill.svg",
    iconInactive: "/icons/home.svg",
  },
  {
    nameKey: "practice",
    href: "/account/practice",
    iconActive: "/icons/practice.svg",
    iconInactive: "/icons/practice-grey.svg",
  },
  {
    nameKey: "myPlan",
    href: "/account/drills",
    iconActive: "/icons/target-arrow-green.svg",
    iconInactive: "/icons/target-arrow.svg",
  },
  {
    nameKey: "profile",
    href: "/account/profile",
    iconActive: "/icons/user-fill.svg",
    iconInactive: "/icons/user.svg",
  },
];

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { data: me, isLoading: meLoading } = useUserCurrent();
  // Default locked while loading to avoid flash of unlocked state.
  const isSubscribed = !meLoading && me?.user?.isSubscribed === true;

  const navItems = useMemo(
    () =>
      navDefs.map((d) => ({
        ...d,
        name: t(d.nameKey),
      })),
    [t]
  );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-md mx-auto px-1 py-1 grid grid-cols-4 items-center gap-0">
        {navItems.map((item) => {
          const isHomeTab = item.href === HOME_HREF;
          const isActive = isHomeTab
            ? pathname === "/home" || pathname === "/account"
            : pathname === item.href ||
              (item.href !== HOME_HREF && pathname?.startsWith(item.href));

          const isMyPlan = item.nameKey === "myPlan";
          const locked = isMyPlan && !isSubscribed;

          const inner = (
            <>
              {isActive && !locked && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-full bg-[#3B883E]" />
              )}

              <div
                className={`w-6 h-6 flex items-center justify-center transition-all duration-200 relative ${
                  isActive && !locked ? "scale-110" : ""
                }`}
              >
                <Image
                  src={isActive && !locked ? item.iconActive : item.iconInactive}
                  alt={item.name}
                  width={24}
                  height={24}
                  className={
                    isActive && !locked
                      ? "[filter:invert(40%)_sepia(80%)_saturate(400%)_hue-rotate(90deg)_brightness(85%)]"
                      : "opacity-50"
                  }
                />
                {locked && (
                  <span className="absolute -top-1 -right-1 bg-orange-100 rounded-full p-0.5">
                    <Lock className="w-2.5 h-2.5 text-orange-700" />
                  </span>
                )}
              </div>

              <span
                className={`text-[9px] sm:text-[10px] font-medium font-satoshi transition-colors duration-200 leading-tight text-center ${
                  isActive && !locked ? "text-[#3B883E]" : "text-muted-foreground"
                }`}
              >
                {item.name}
              </span>
            </>
          );

          if (locked) {
            return (
              <ProLockHoverWrap
                key={item.href}
                className="flex flex-col items-center gap-0.5 py-2 px-0.5 relative min-w-0 opacity-50 cursor-not-allowed"
                placement="top"
              >
                {inner}
              </ProLockHoverWrap>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className="flex flex-col items-center gap-0.5 py-2 px-0.5 relative min-w-0"
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
