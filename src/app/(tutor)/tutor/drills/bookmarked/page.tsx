"use client";

import { BookmarkedDrillsPage } from "@/components/drills/BookmarkedDrillsPageContent";

export default function TutorBookmarkedDrillsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:px-8">
      <BookmarkedDrillsPage basePath="/tutor/drills" />
    </div>
  );
}
