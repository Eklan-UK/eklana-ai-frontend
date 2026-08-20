"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import {
  getUserDisplayName,
  getUserFirstName,
  getUserInitials,
} from "@/utils/user";
import { NotificationBell } from "@/components/notifications/NotificationBell";

const Header: React.FC = () => {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const displayName = getUserDisplayName(user);
  const firstName = getUserFirstName(user);
  const initials = getUserInitials(user);
  const avatarUrl = user?.avatar || user?.image;
  const isDashboard = pathname === "/admin/dashboard";

  return (
    <header
      className={`z-10 flex h-16 shrink-0 items-center border-b border-gray-200 bg-white px-4 md:px-8 dark:border-border dark:bg-card ${
        isDashboard ? "justify-between gap-4" : "justify-end"
      }`}
    >
      {isDashboard ? (
        <div className="min-w-0">
          <h1 className="text-base font-extrabold tracking-tight text-[#101828] dark:text-foreground">
            Dashboard
          </h1>
          <p className="text-[10.5px] font-semibold text-[#99a1af] dark:text-muted-foreground">
            Overview of Eklan operations and learner activity
          </p>
        </div>
      ) : null}

      <div className="flex shrink-0 items-center gap-2.5 md:gap-3">
        {isDashboard ? (
          <Link
            href="/admin/drills/create"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#2a602c] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#418b43]"
          >
            <span className="text-[13px] font-black leading-none">+</span>
            Create Drill
          </Link>
        ) : null}

        <NotificationBell />

        <div className="flex items-center gap-2">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={isDashboard ? 28 : 40}
              height={isDashboard ? 28 : 40}
              className={`${
                isDashboard ? "h-7 w-7" : "h-10 w-10"
              } rounded-full border border-gray-200 object-cover dark:border-border`}
            />
          ) : (
            <div
              className={`${
                isDashboard
                  ? "h-7 w-7 bg-[#2a602c] text-[11px]"
                  : "h-10 w-10 border border-gray-200 bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm dark:border-border"
              } flex items-center justify-center rounded-full font-extrabold text-white`}
            >
              {initials}
            </div>
          )}
          <span className="hidden text-xs font-bold text-[#364153] sm:inline dark:text-foreground">
            {firstName}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;
