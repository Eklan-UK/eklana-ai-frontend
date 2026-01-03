// Server Component - Students List Page
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import {
  Users,
  Search,
  TrendingUp,
  BookOpen,
  ChevronRight,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { StudentsListClient } from "./students-list-client";
import { getTutorStudents } from "./get-students";

// Revalidate every 60 seconds (ISR)
export const revalidate = 60;

export default async function StudentsPage() {
  const initialData = await getTutorStudents();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6"></div>

      <Header title="My Students" />

      <div className="max-w-7xl mx-auto px-4 py-6 md:px-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {initialData.total || 0}
                </div>
                <div className="text-sm text-gray-600">Total Students</div>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {initialData.students?.reduce((sum: number, s: any) => sum + (s.drillsCompleted || 0), 0) || 0}
                </div>
                <div className="text-sm text-gray-600">Total Completed</div>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {initialData.students?.length > 0
                    ? Math.round(
                        initialData.students.reduce((sum: number, s: any) => sum + (s.progress || 0), 0) /
                          initialData.students.length
                      )
                    : 0}%
                </div>
                <div className="text-sm text-gray-600">Avg. Progress</div>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Client Component for Interactive Features */}
        <StudentsListClient initialStudents={initialData.students || []} />
      </div>
    </div>
  );
}
