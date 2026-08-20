"use client";

import Link from "next/link";
import { ZERO_PAUSE_PRODUCT_LABELS } from "@/domain/subscriptions/subscription.types";

const ICON_DIR = "/images/admin-dashboard";

export interface DashboardStatCardsProps {
  loading: boolean;
  totalUsers: number;
  subscribedUsers: number;
  totalActiveLearners: number;
  zeroPauseChallengeTrialUsers: number;
  zeroPauseChallengePostTrialUsers: number;
  zeroPauseMaintainerUsers: number;
  newProSubscribersThisMonth: number;
}

function StatIcon({ src, bg }: { src: string; bg: string }) {
  return (
    <div
      className={`flex size-[48px] shrink-0 items-center justify-center overflow-clip rounded-[22px] ${bg}`}
    >
      {/* Figma-exported SVG; next/image does not serve local SVGs reliably. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={22} height={22} className="size-[22px]" />
    </div>
  );
}

export function DashboardStatCards({
  loading,
  totalUsers,
  subscribedUsers,
  totalActiveLearners,
  zeroPauseChallengeTrialUsers,
  zeroPauseChallengePostTrialUsers,
  zeroPauseMaintainerUsers,
  newProSubscribersThisMonth,
}: DashboardStatCardsProps) {
  const cards = [
    {
      title: "Total Signups",
      value: totalUsers,
      subtitle: "All registered learners",
      href: "/admin/Learners",
      icon: `${ICON_DIR}/stat-total-signups.svg`,
      iconBg: "bg-[#e8f5f2]",
    },
    {
      title: "Eklan Pro Subscribers",
      value: subscribedUsers,
      subtitle: `${newProSubscribersThisMonth} new this month`,
      href: "/admin/subscriptions",
      icon: `${ICON_DIR}/stat-pro-subscribers.svg`,
      iconBg: "bg-[#fef3c7]",
    },
    {
      title: "Total Active Users",
      value: totalActiveLearners,
      subtitle: "Active in the last 30 days",
      href: "/admin/Learners",
      icon: `${ICON_DIR}/stat-active-users.svg`,
      iconBg: "bg-[#eff6ff]",
    },
    {
      title: `${ZERO_PAUSE_PRODUCT_LABELS.challenge} Subscribers (Trial)`,
      value: zeroPauseChallengeTrialUsers,
      subtitle: "Currently in free trial",
      href: "/admin/subscriptions",
      icon: `${ICON_DIR}/stat-zero-pause-trial.svg`,
      iconBg: "bg-[#ede9fe]",
    },
    {
      title: `${ZERO_PAUSE_PRODUCT_LABELS.challenge} Subscribers (Post-Trial)`,
      value: zeroPauseChallengePostTrialUsers,
      subtitle: "Converted from trial",
      href: "/admin/subscriptions",
      icon: `${ICON_DIR}/stat-zero-pause-post-trial.svg`,
      iconBg: "bg-[#fce7f3]",
    },
    {
      title: `${ZERO_PAUSE_PRODUCT_LABELS.maintainer} Subscribers`,
      value: zeroPauseMaintainerUsers,
      subtitle: "On maintenance plan",
      href: "/admin/subscriptions",
      icon: `${ICON_DIR}/stat-zero-pause-maintenance.svg`,
      iconBg: "bg-[#f1f5f9]",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Link
          key={card.title}
          href={card.href}
          className="flex items-center gap-4 rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-border dark:bg-card"
        >
          <StatIcon src={card.icon} bg={card.iconBg} />
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold text-[#99a1af] dark:text-muted-foreground">
              {card.title}
            </p>
            <p className="text-[30px] font-extrabold leading-[30px] tracking-tight text-[#101828] dark:text-foreground">
              {loading ? "..." : card.value}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-[#99a1af] dark:text-muted-foreground">
              {card.subtitle}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
