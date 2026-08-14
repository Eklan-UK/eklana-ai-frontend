"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, MessageSquare } from "lucide-react";

export default function DrillBuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isFreeTalk = pathname?.startsWith("/admin/drill/free-talk");

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">Drill Builder</h1>
        <p className="text-sm text-gray-500 dark:text-muted-foreground">
          Manage drills, assignments, and Simulation Room scenarios
        </p>
      </div>

      <nav
        className="inline-flex w-full max-w-xl items-center rounded-full border border-gray-200 bg-white px-2 py-1.5 sm:w-auto dark:border-border dark:bg-card"
        role="tablist"
        aria-label="Drill builder sections"
      >
        <Link
          href="/admin/drill"
          role="tab"
          aria-selected={!isFreeTalk}
          className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm transition-colors sm:flex-none ${
            !isFreeTalk
              ? "bg-emerald-50 font-bold text-[#3d8c40] dark:bg-primary-900/40 dark:text-primary-300"
              : "font-medium text-gray-500 hover:text-gray-700 dark:text-muted-foreground dark:hover:text-foreground"
          }`}
        >
          <BookOpen className="h-4 w-4 shrink-0" />
          All Drills
        </Link>
        <Link
          href="/admin/drill/free-talk"
          role="tab"
          aria-selected={isFreeTalk}
          className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm transition-colors sm:flex-none ${
            isFreeTalk
              ? "bg-emerald-50 font-bold text-[#3d8c40] dark:bg-primary-900/40 dark:text-primary-300"
              : "font-medium text-gray-500 hover:text-gray-700 dark:text-muted-foreground dark:hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          Simulation Room Scenarios
        </Link>
      </nav>

      {children}
    </div>
  );
}
