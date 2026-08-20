"use client";

import React from "react";
import { useDashboardStats } from "@/hooks/useAdmin";
import { DashboardStatCards } from "@/components/admin/dashboard/DashboardStatCards";
import { QuickActions } from "@/components/admin/dashboard/QuickActions";
import { UpcomingDiscoveryCallsTable } from "@/components/admin/dashboard/UpcomingDiscoveryCallsTable";

const Dashboard: React.FC = () => {
  const { data: stats, isLoading: loading } = useDashboardStats();

  return (
    <div className="space-y-5 pb-12">
      <DashboardStatCards
        loading={loading}
        totalUsers={stats?.totalUsers ?? 0}
        subscribedUsers={stats?.subscribedUsers ?? 0}
        totalActiveLearners={stats?.totalActiveLearners ?? 0}
        zeroPauseChallengeTrialUsers={stats?.zeroPauseChallengeTrialUsers ?? 0}
        zeroPauseChallengePostTrialUsers={
          stats?.zeroPauseChallengePostTrialUsers ?? 0
        }
        zeroPauseMaintainerUsers={stats?.zeroPauseMaintainerUsers ?? 0}
        newProSubscribersThisMonth={stats?.newProSubscribersThisMonth ?? 0}
      />
      <QuickActions />
      <UpcomingDiscoveryCallsTable />
    </div>
  );
};

export default Dashboard;
