"use client";

import { GrammarReviewsPageContent } from "@/components/drills/reviews/GrammarReviewsPageContent";

export default function TutorGrammarReviewsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:px-8">
      <GrammarReviewsPageContent backHref="/tutor/drills" />
    </div>
  );
}
