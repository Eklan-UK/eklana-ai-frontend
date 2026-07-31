"use client";

import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { SavedDrillsList } from "@/components/drills/SavedDrillsList";

export default function BookmarksPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-[max(5.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="h-6"></div>
      <Header showBack title="My Bookmarks" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        <SavedDrillsList />
      </div>

      <BottomNav />
    </div>
  );
}
