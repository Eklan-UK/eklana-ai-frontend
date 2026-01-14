"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft,
  Mail,
  BookOpen,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Student {
  id: string;
  name: string;
  email: string;
  progress: number;
  drillsCompleted: number;
  drillsActive: number;
  drillsTotal: number;
  joinDate?: string;
  lastActivity?: string;
  recentDrills?: RecentDrill[];
}

interface RecentDrill {
  id: string;
  title: string;
  type: string;
  status: string;
  score?: number;
  completedAt?: string;
  dueDate?: string;
}

export default function StudentDetailPage() {
  const params = useParams();
  const studentId = params.id as string;
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStudent() {
      try {
        const response = await fetch(`/api/v1/tutor/students/${studentId}`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch student");
        }

        const data = await response.json();
        setStudent(data.data?.student || null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (studentId) {
      fetchStudent();
    }
  }, [studentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="h-6"></div>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/tutor/students">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition mb-4">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          </Link>
          <Card className="p-8 text-center">
            <p className="text-gray-600">
              {error || "Student not found"}
            </p>
          </Card>
        </div>
      </div>
    );
  }

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
        {student.recentDrills && student.recentDrills.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Recent Activity
            </h2>
            <div className="space-y-3">
              {student.recentDrills.map((drill) => (
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
                              : drill.status === "in-progress"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {drill.status === "in-progress" ? "In Progress" : drill.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="capitalize">{drill.type}</span>
                        {drill.status === "completed" && drill.score !== undefined && (
                          <>
                            <span>•</span>
                            <span>Score: {drill.score}%</span>
                          </>
                        )}
                        {drill.completedAt && (
                          <>
                            <span>•</span>
                            <span>
                              Completed: {new Date(drill.completedAt).toLocaleDateString()}
                            </span>
                          </>
                        )}
                        {drill.status !== "completed" && drill.dueDate && (
                          <>
                            <span>•</span>
                            <span>
                              Due: {new Date(drill.dueDate).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty state for no drills */}
        {(!student.recentDrills || student.recentDrills.length === 0) && (
          <Card className="p-8 text-center mb-6">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No drills assigned yet</p>
            <p className="text-sm text-gray-500">
              Assign a drill to this student to get started
            </p>
          </Card>
        )}

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
