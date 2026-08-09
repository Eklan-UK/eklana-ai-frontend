"use client";

import { Trophy } from "lucide-react";

export default function AdminWeeklyChallengePage() {
  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">
          Weekly Challenge
        </h1>
        <p className="text-gray-500 text-sm dark:text-muted-foreground">
          Manage the learner-facing Weekly Challenge program
        </p>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-white py-20 text-center dark:border-border dark:bg-card">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
          <Trophy className="h-7 w-7" />
        </div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-foreground">
          Management tools coming soon
        </h2>
        <p className="max-w-sm text-sm text-gray-500 dark:text-muted-foreground">
          Admin tools for reviewing and configuring the Weekly Challenge
          program are on the way. Check back soon.
        </p>
      </div>
    </div>
  );
}
