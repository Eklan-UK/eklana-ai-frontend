"use client";

import { Header } from "@/components/layout/Header";
import { BadgeGallery } from "@/components/badges/BadgeGallery";

export default function BadgesPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-6" />
      <Header showBack title="Badges" />
      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8 space-y-4">
        <BadgeGallery />
      </div>
    </div>
  );
}
