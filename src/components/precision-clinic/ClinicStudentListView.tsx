"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ChevronRight,
  Loader2,
  Mail,
  Search,
  Target,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAiDrillBuilderLearners } from "@/hooks/useAiDrillBuilderLearners";
import { usePrecisionClinicStats } from "@/hooks/usePrecisionClinic";
import { useClinicEnrollmentsList } from "@/hooks/usePrecisionClinicEnrollments";
import { computeCurrentWeek } from "@/lib/ai-drill-builder/week-utils";
import {
  getLearnerDisplayName,
  getLearnerId,
} from "@/lib/ai-drill-builder/learner-utils";
import { LearnerAvatar } from "@/components/ai-drill-builder/LearnerAvatar";
import { ClinicStatCards, type ClinicStatCardData } from "./ClinicStatCards";
import {
  ClinicEnrollmentButton,
  ClinicEnrollmentModal,
} from "./ClinicEnrollmentModal";

interface StudentCard {
  id: string;
  name: string;
  email?: string;
  avatar?: string | null;
  image?: string | null;
  subscriptionActivatedAt?: string | null;
  createdAt?: string | null;
  precisionClinicWeekCount?: number | null;
}

export function ClinicStudentListView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [enrollmentModalOpen, setEnrollmentModalOpen] = useState(false);

  const { data: statsData, isLoading: statsLoading } =
    usePrecisionClinicStats();
  const { data: enrolledIds } = useClinicEnrollmentsList();
  const {
    data: adminData,
    isLoading: learnersLoading,
    isError: adminError,
    error: adminErrorDetail,
    refetch: refetchAdminLearners,
  } = useAiDrillBuilderLearners(true);

  const stats: ClinicStatCardData = useMemo(() => {
    return {
      totalDrills: statsData?.total ?? 0,
      practiceItems: statsData?.practiceItems ?? 0,
      publishedDrills: statsData?.published ?? 0,
      assignedDrills: statsData?.assigned ?? statsData?.published ?? 0,
    };
  }, [statsData]);

  const students: StudentCard[] = useMemo(() => {
    return (adminData?.learners ?? [])
      .map((s) => {
        const id = getLearnerId(s);
        if (!id) return null;
        return {
          id,
          name: getLearnerDisplayName(s),
          email: s.email,
          avatar: s.avatar,
          image: s.image,
          subscriptionActivatedAt: s.subscriptionActivatedAt,
          createdAt: s.createdAt,
          precisionClinicWeekCount:
            typeof s.precisionClinicWeekCount === "number"
              ? s.precisionClinicWeekCount
              : null,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  }, [adminData]);

  const filteredStudents = students.filter((student) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      student.name.toLowerCase().includes(query) ||
      student.email?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
          <Target className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">
            Eklan Precision Clinic
          </h1>
          <p className="mt-1 max-w-xl text-sm text-gray-500 dark:text-muted-foreground">
            Create targeted drills to help your students improve their weak areas.
          </p>
        </div>
      </div>

      <ClinicStatCards stats={stats} loading={statsLoading && !statsData} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <ClinicEnrollmentButton
          onClick={() => setEnrollmentModalOpen(true)}
        />
      </div>

      <div className="mb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search students by name or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-border dark:bg-card dark:text-foreground"
          />
        </div>
      </div>

      {adminError ? (
        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
          <p className="mb-1 font-medium text-gray-700 dark:text-foreground">
            Failed to load learners
          </p>
          <p className="mb-4 text-sm text-gray-500 dark:text-muted-foreground">
            {(adminErrorDetail as Error)?.message ??
              "Something went wrong while fetching the learner list."}
          </p>
          <Button type="button" onClick={() => refetchAdminLearners()}>
            Try again
          </Button>
        </Card>
      ) : learnersLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : filteredStudents.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500 dark:text-muted-foreground">
            {searchQuery
              ? "No students match your search"
              : "No learners found"}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredStudents.map((student) => {
            const currentWeek =
              typeof student.precisionClinicWeekCount === "number" &&
              student.precisionClinicWeekCount >= 1
                ? student.precisionClinicWeekCount
                : computeCurrentWeek(
                    student.subscriptionActivatedAt,
                    student.createdAt,
                  );
            return (
              <Link
                key={student.id}
                href={`/admin/precision-clinic/students/${student.id}`}
              >
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-1 items-center gap-4">
                      <LearnerAvatar learner={student} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground">
                            {student.name}
                          </h3>
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Week {currentWeek}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                              enrolledIds?.has(student.id)
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-gray-200 bg-gray-50 text-gray-600"
                            }`}
                          >
                            {enrolledIds?.has(student.id) ? "Enrolled" : "Locked"}
                          </span>
                        </div>
                        {student.email ? (
                          <div className="mt-1 flex items-center gap-2 text-sm text-gray-600 dark:text-muted-foreground">
                            <Mail className="h-4 w-4 shrink-0" />
                            <span className="truncate">{student.email}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {enrollmentModalOpen && (
        <ClinicEnrollmentModal
          onClose={() => setEnrollmentModalOpen(false)}
        />
      )}
    </div>
  );
}
