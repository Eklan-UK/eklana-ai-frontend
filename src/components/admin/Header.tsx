"use client";

import React from "react";
import { Search, Bell } from "lucide-react";
import Image from "next/image";
import { useAuthStore } from "@/store/auth-store";
import { getUserDisplayName, getUserInitials } from "@/utils/user";

const Header: React.FC = () => {
  const { user } = useAuthStore();
  const displayName = getUserDisplayName(user);
  const initials = getUserInitials(user);
  const avatarUrl = user?.avatar || user?.image;

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-8 z-10 shrink-0">
      <div className="relative w-full max-w-md md:max-w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search learners, calls, notes..."
          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      <div className="flex items-center gap-4 md:gap-6 shrink-0">
        <button
          type="button"
          className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 border-2 border-white rounded-full" />
        </button>

        <div className="flex items-center gap-3 border-l border-gray-200 pl-4 md:pl-6">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={40}
              height={40}
              className="w-10 h-10 rounded-full border border-gray-200 object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full border border-gray-200 bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-sm font-semibold text-white">
              {initials}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
