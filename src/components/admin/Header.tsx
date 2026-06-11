"use client";

import React from "react";
import Image from "next/image";
import { useAuthStore } from "@/store/auth-store";
import { getUserDisplayName, getUserInitials } from "@/utils/user";
import { NotificationBell } from "@/components/notifications/NotificationBell";

const Header: React.FC = () => {
  const { user } = useAuthStore();
  const displayName = getUserDisplayName(user);
  const initials = getUserInitials(user);
  const avatarUrl = user?.avatar || user?.image;

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-end px-4 md:px-8 z-10 shrink-0 dark:bg-card dark:border-border">
      <div className="flex items-center gap-4 md:gap-6 shrink-0">
        <NotificationBell />

        <div className="flex items-center gap-3 border-l border-gray-200 pl-4 md:pl-6 dark:border-border">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={40}
              height={40}
              className="w-10 h-10 rounded-full border border-gray-200 object-cover dark:border-border"
            />
          ) : (
            <div className="w-10 h-10 rounded-full border border-gray-200 bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-sm font-semibold text-white dark:border-border">
              {initials}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
