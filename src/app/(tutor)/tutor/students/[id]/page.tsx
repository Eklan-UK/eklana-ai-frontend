"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  Mail,
  Pencil,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { tutorAPI } from "@/lib/api";
import { toast } from "sonner";
import { LearnerProfileAnalytics } from "@/components/shared/learner-profile-analytics";

interface Student {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  progress: number;
  drillsCompleted: number;
  drillsActive: number;
  drillsPendingReview: number;
  drillsReviewed: number;
  drillsTotal: number;
  joinDate?: string;
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    async function fetchStudent() {
      try {
        const response = await fetch(`/api/v1/tutor/students/${studentId}`, {
          credentials: "include",
        });

        if (response.status === 403 || response.status === 404) {
          toast.error("Student not found or not assigned to you");
          router.push("/tutor/students");
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch student");
        }

        const data = await response.json();
        setStudent(data.data?.student || null);
      } catch (err: any) {
        toast.error(err.message || "Failed to load student");
        router.push("/tutor/students");
      } finally {
        setLoading(false);
      }
    }

    if (studentId) {
      fetchStudent();
    }
  }, [studentId, router]);

  const startEditName = () => {
    if (!student) return;
    const parts = student.name.trim().split(/\s+/).filter(Boolean);
    setEditFirst(student.firstName ?? parts[0] ?? "");
    setEditLast(student.lastName ?? (parts.length > 1 ? parts.slice(1).join(" ") : ""));
    setEditingName(true);
  };

  const cancelEditName = () => {
    setEditingName(false);
    setEditFirst("");
    setEditLast("");
  };

  const saveName = async () => {
    const first = editFirst.trim();
    const last = editLast.trim();
    if (!first || !last) {
      toast.error("First and last name are required");
      return;
    }
    setSavingName(true);
    try {
      const res = await tutorAPI.updateStudentName(studentId, { firstName: first, lastName: last });
      const updated = res.data.student;
      setStudent((prev) =>
        prev
          ? { ...prev, name: updated.name, firstName: updated.firstName, lastName: updated.lastName }
          : null,
      );
      setEditingName(false);
      toast.success("Student name updated");
    } catch (e: any) {
      toast.error(e?.message || "Could not update name");
    } finally {
      setSavingName(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6" />

      <div className="max-w-4xl mx-auto px-4 py-6 md:px-8 space-y-8 pb-16">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/tutor/students">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={editFirst}
                    onChange={(e) => setEditFirst(e.target.value)}
                    placeholder="First name"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={savingName}
                    autoComplete="given-name"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={editLast}
                    onChange={(e) => setEditLast(e.target.value)}
                    placeholder="Last name"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={savingName}
                    autoComplete="family-name"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="primary" size="sm" onClick={saveName} disabled={savingName}>
                    {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={cancelEditName} disabled={savingName}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-2">
                  <h1 className="text-2xl font-bold text-gray-900 truncate">{student.name}</h1>
                  <button
                    type="button"
                    onClick={startEditName}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 shrink-0"
                    title="Edit name"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4 shrink-0" />
                    {student.email}
                  </span>
                  {student.joinDate && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 shrink-0" />
                      Joined {formatDate(student.joinDate)}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-gray-900">{student.progress}%</div>
            <div className="text-sm text-gray-600">Progress</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${student.progress}%` }}
              />
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-gray-900">{student.drillsCompleted}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </Card>
          <Card className="p-4 bg-yellow-50 border-yellow-200">
            <div className="text-2xl font-bold text-yellow-700">{student.drillsPendingReview || 0}</div>
            <div className="text-sm text-yellow-600">Pending Review</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-gray-900">{student.drillsTotal}</div>
            <div className="text-sm text-gray-600">Total Assigned</div>
          </Card>
        </div>

        {/* Assign drill CTA */}
        <div>
          <Link href={`/tutor/drills/create?student=${student.id}`}>
            <Button variant="primary" size="lg">
              <BookOpen className="w-5 h-5 mr-2" />
              Assign New Drill
            </Button>
          </Link>
        </div>

        {/* Full analytics — same as admin */}
        <LearnerProfileAnalytics learnerId={studentId} learnerName={student.name} />
      </div>
    </div>
  );
}
