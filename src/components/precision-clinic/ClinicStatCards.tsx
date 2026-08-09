"use client";

import { FileText, Layers, Send, Users } from "lucide-react";

export type ClinicStatCardData = {
  totalDrills: number;
  practiceItems: number;
  publishedDrills: number;
  assignedDrills: number;
};

const CARDS: Array<{
  key: keyof ClinicStatCardData;
  label: string;
  subtitle: string;
  icon: typeof FileText;
  iconWrap: string;
}> = [
  {
    key: "totalDrills",
    label: "Total Drills",
    subtitle: "All clinic drills",
    icon: FileText,
    iconWrap: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  {
    key: "practiceItems",
    label: "Practice Items",
    subtitle: "Across all drills",
    icon: Layers,
    iconWrap: "bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300",
  },
  {
    key: "publishedDrills",
    label: "Published Drills",
    subtitle: "Assigned to learners",
    icon: Send,
    iconWrap: "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300",
  },
  {
    key: "assignedDrills",
    label: "Assigned Drills",
    subtitle: "Assigned to learners",
    icon: Users,
    iconWrap: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300",
  },
];

export function ClinicStatCards({
  stats,
  loading,
}: {
  stats: ClinicStatCardData;
  loading?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-border dark:bg-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-muted-foreground">
                  {card.label}
                </p>
                <p className="mt-2 font-nunito text-3xl font-bold tabular-nums text-gray-900 dark:text-foreground">
                  {loading ? "—" : stats[card.key]}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-muted-foreground">
                  {card.subtitle}
                </p>
              </div>
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${card.iconWrap}`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
