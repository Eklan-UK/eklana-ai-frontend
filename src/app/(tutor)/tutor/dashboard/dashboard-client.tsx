"use client";

import { Card } from "@/components/ui/Card";
import {
  Clock,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

interface TutorDashboardClientProps {
  recentDrills: any[];
  recentStudents: any[];
}

export function TutorDashboardClient({ recentDrills, recentStudents }: TutorDashboardClientProps) {
  return (
    <>
      {/* Recent Drills */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Recent Drills</h2>
          <Link
            href="/tutor/drills"
            className="text-sm text-green-600 flex items-center gap-1"
          >
            View All
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="space-y-3">
          {recentDrills.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-500">No drills yet. Create your first drill!</p>
            </Card>
          ) : (
            recentDrills.map((drill) => (
              <Link key={drill.id} href={`/tutor/drills/${drill.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-base font-semibold text-gray-900">
                          {drill.title}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            drill.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {drill.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="capitalize">{drill.type}</span>
                        <span>•</span>
                        <span>{drill.students} students</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Due {drill.dueDate}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Student Progress */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Student Progress</h2>
          <Link
            href="/tutor/students"
            className="text-sm text-green-600 flex items-center gap-1"
          >
            View All
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="space-y-3">
          {recentStudents.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-500">No students assigned yet.</p>
            </Card>
          ) : (
            recentStudents.map((student) => (
              <Link key={student.id} href={`/tutor/students/${student.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900 mb-1">
                        {student.name}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                        <span>{student.drillsCompleted || 0} drills completed</span>
                      </div>
                      {student.progress !== undefined && (
                        <>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${student.progress}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {student.progress}% overall progress
                          </div>
                        </>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );
}

