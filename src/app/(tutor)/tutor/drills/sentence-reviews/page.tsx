"use client";

import { SentenceReviewsPageContent } from "@/components/drills/reviews/SentenceReviewsPageContent";

export default function TutorSentenceReviewsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:px-8">
      <SentenceReviewsPageContent backHref="/tutor/drills" />
    </div>
  );
}
