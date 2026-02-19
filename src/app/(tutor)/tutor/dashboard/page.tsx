// Server Component - Tutor Dashboard
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  BookOpen,
  Users,
  Plus,
  TrendingUp,
  Clock,
  CheckCircle,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { getTutorDashboardData } from "./get-dashboard-data";
import { TutorDashboardClient } from "./dashboard-client";

// Revalidate every 60 seconds (ISR)
export const revalidate = 60;

export default async function TutorDashboard() {
  const dashboardData = await getTutorDashboardData();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6"></div>

      <Header title="Dashboard" />

      <div className="max-w-7xl mx-auto px-4 py-6 md:px-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-xs text-gray-500">Total</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {dashboardData.stats.totalDrills}
            </div>
            <div className="text-xs text-gray-600">Drills</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-xs text-gray-500">Active</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {dashboardData.stats.activeDrills}
            </div>
            <div className="text-xs text-gray-600">Drills</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-primary-600" />
              </div>
              <span className="text-xs text-gray-500">Total</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {dashboardData.stats.totalStudents}
            </div>
            <div className="text-xs text-gray-600">Students</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-xs text-gray-500">Today</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {dashboardData.stats.completedToday}
            </div>
            <div className="text-xs text-gray-600">Completed</div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <Link href="/tutor/drills/create">
            <Button variant="primary" size="lg" fullWidth className="mb-4">
              <Plus className="w-5 h-5 mr-2" />
              Create New Drill
            </Button>
          </Link>
        </div>

        {/* Client Component for Recent Data */}
        <TutorDashboardClient
          recentDrills={dashboardData.recentDrills}
          recentStudents={dashboardData.recentStudents}
        />
      </div>
    </div>
  );
}
