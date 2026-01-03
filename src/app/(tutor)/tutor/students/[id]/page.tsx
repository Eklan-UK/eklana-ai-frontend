"use client";

import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft,
  Mail,
  Phone,
  TrendingUp,
  BookOpen,
  CheckCircle,
  Clock,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function StudentDetailPage() {
  const params = useParams();
  const studentId = params.id;

  // Mock data - replace with API call using studentId
  const student = {
    id: studentId,
    name: "Amy Chen",
    email: "amy.chen@example.com",
    progress: 85,
    drillsCompleted: 12,
    drillsActive: 3,
    drillsTotal: 15,
    joinDate: "2024-01-01",
    lastActivity: "2 hours ago",
  };

  const recentDrills = [
    {
      id: "1",
      title: "Daily Vocabulary - Food & Dining",
      type: "vocabulary",
      status: "completed",
      score: 92,
      completedAt: "2024-01-18",
    },
    {
      id: "2",
      title: "Restaurant Conversation",
      type: "roleplay",
      status: "active",
      dueDate: "2024-01-20",
    },
    {
      id: "3",
      title: "Present Continuous Tense",
      type: "grammar",
      status: "completed",
      score: 88,
      completedAt: "2024-01-17",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6"></div>

      <div className="max-w-4xl mx-auto px-4 py-6 md:px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/tutor/students">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
              <Mail className="w-4 h-4" />
              <span>{student.email}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="text-2xl font-bold text-gray-900">
              {student.progress}%
            </div>
            <div className="text-sm text-gray-600">Overall Progress</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${student.progress}%` }}
              ></div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-2xl font-bold text-gray-900">
              {student.drillsCompleted}
            </div>
            <div className="text-sm text-gray-600">Completed</div>
          </Card>

          <Card className="p-4">
            <div className="text-2xl font-bold text-gray-900">
              {student.drillsActive}
            </div>
            <div className="text-sm text-gray-600">Active</div>
          </Card>

          <Card className="p-4">
            <div className="text-2xl font-bold text-gray-900">
              {student.drillsTotal}
            </div>
            <div className="text-sm text-gray-600">Total Assigned</div>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Activity
          </h2>
          <div className="space-y-3">
            {recentDrills.map((drill) => (
              <Card key={drill.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {drill.title}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          drill.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {drill.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="capitalize">{drill.type}</span>
                      {drill.status === "completed" && drill.score && (
                        <>
                          <span>•</span>
                          <span>Score: {drill.score}%</span>
                          <span>•</span>
                          <span>Completed: {drill.completedAt}</span>
                        </>
                      )}
                      {drill.status === "active" && drill.dueDate && (
                        <>
                          <span>•</span>
                          <span>Due: {drill.dueDate}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Link href={`/tutor/drills/create?student=${student.id}`} className="flex-1">
            <Button variant="primary" size="lg" fullWidth>
              <BookOpen className="w-5 h-5 mr-2" />
              Assign New Drill
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

