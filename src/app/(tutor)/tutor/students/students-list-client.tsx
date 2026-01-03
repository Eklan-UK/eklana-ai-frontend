"use client";

import { Card } from "@/components/ui/Card";
import {
  Search,
  ChevronRight,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { tutorAPI } from "@/lib/api";

interface StudentsListClientProps {
  initialStudents: any[];
}

export function StudentsListClient({ initialStudents }: StudentsListClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<any[]>(initialStudents);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setStudents(initialStudents);
  }, [initialStudents]);

  const filteredStudents = students.filter((student) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        student.name?.toLowerCase().includes(query) ||
        student.email?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <>
      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Students List */}
      <div className="space-y-4">
        {filteredStudents.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-gray-500">
              {searchQuery ? "No students match your search" : "No students assigned yet"}
            </p>
          </Card>
        ) : (
          filteredStudents.map((student) => (
            <Link key={student.id || student._id} href={`/tutor/students/${student.id || student._id}`}>
              <Card className="hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                      {student.name?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {student.name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                        <Mail className="w-4 h-4" />
                        <span>{student.email}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                        <span>{student.drillsCompleted || 0} completed</span>
                        <span>•</span>
                        <span>{student.drillsActive || 0} active</span>
                        {student.lastActivity && (
                          <>
                            <span>•</span>
                            <span>Last active {student.lastActivity}</span>
                          </>
                        )}
                      </div>
                      {student.progress !== undefined && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all"
                              style={{ width: `${student.progress}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {student.progress}% overall progress
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </>
  );
}

