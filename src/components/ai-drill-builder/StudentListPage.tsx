"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, Mail, Loader2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useTutorStudents } from "@/hooks/useTutor";
import { useAiDrillBuilderLearners } from "@/hooks/useAiDrillBuilderLearners";
import { computeCurrentWeek } from "@/lib/ai-drill-builder/week-utils";
import {
  getLearnerDisplayName,
  getLearnerId,
} from "@/lib/ai-drill-builder/learner-utils";
import { LearnerAvatar } from "@/components/ai-drill-builder/LearnerAvatar";

interface StudentListPageProps {
  variant: "tutor" | "admin";
}

interface StudentCard {
  id: string;
  name: string;
  email?: string;
  avatar?: string | null;
  image?: string | null;
  subscriptionActivatedAt?: string | null;
  createdAt?: string | null;
}

export function StudentListPage({ variant }: StudentListPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const basePath =
    variant === "tutor" ? "/tutor/ai-drill-builder" : "/admin/ai-drill-builder";

  const { data: tutorData, isLoading: tutorLoading } = useTutorStudents(
    { limit: 1000 },
    { enabled: variant === "tutor" },
  );
  const {
    data: adminData,
    isLoading: adminLoading,
    isError: adminError,
    error: adminErrorDetail,
    refetch: refetchAdminLearners,
  } = useAiDrillBuilderLearners(variant === "admin");

  const isLoading = variant === "tutor" ? tutorLoading : adminLoading;
  const isTutor = variant === "tutor";

  const students: StudentCard[] = useMemo(() => {
    if (isTutor) {
      return (tutorData?.students ?? [])
        .map((s: Record<string, unknown>) => {
          const id = getLearnerId(s as Parameters<typeof getLearnerId>[0]);
          if (!id) return null;
          return {
            id,
            name: getLearnerDisplayName(
              s as Parameters<typeof getLearnerDisplayName>[0],
            ),
            email: s.email as string | undefined,
            avatar: s.avatar as string | null | undefined,
            image: s.image as string | null | undefined,
            subscriptionActivatedAt: s.subscriptionActivatedAt as string | null,
            createdAt: s.createdAt as string | null,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);
    }
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
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  }, [isTutor, tutorData, adminData]);

  const filteredStudents = students.filter((student) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      student.name.toLowerCase().includes(query) ||
      student.email?.toLowerCase().includes(query)
    );
  });

  return (
    <div>
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search students by name or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {variant === "admin" && adminError ? (
        <Card className="p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-gray-700 font-medium mb-1">Failed to load learners</p>
          <p className="text-sm text-gray-500 mb-4">
            {(adminErrorDetail as Error)?.message ??
              "Something went wrong while fetching the learner list."}
          </p>
          <Button type="button" onClick={() => refetchAdminLearners()}>
            Try again
          </Button>
        </Card>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : filteredStudents.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">
            {searchQuery
              ? "No students match your search"
              : variant === "tutor"
                ? "No students assigned yet"
                : "No learners found"}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredStudents.map((student) => {
            const currentWeek = computeCurrentWeek(
              student.subscriptionActivatedAt,
              student.createdAt,
            );
            return (
              <Link key={student.id} href={`${basePath}/${student.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <LearnerAvatar learner={student} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {student.name}
                          </h3>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Week {currentWeek}
                          </span>
                        </div>
                        {student.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                            <Mail className="w-4 h-4 shrink-0" />
                            <span className="truncate">{student.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
