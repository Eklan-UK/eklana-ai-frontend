"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  Mail,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useTutorStudents } from "@/hooks/useTutor";
import { useAiDrillBuilderLearners } from "@/hooks/useAiDrillBuilderLearners";
import {
  formatEnrollmentBadge,
  TOTAL_MISSION_COUNT,
  useLearnerMissionEnrollments,
  useMissionEnrollmentsList,
  useSetLearnerMissionEnrollments,
} from "@/hooks/useMissionEnrollments";
import {
  getLearnerDisplayName,
  getLearnerId,
} from "@/lib/ai-drill-builder/learner-utils";
import { LearnerAvatar } from "@/components/ai-drill-builder/LearnerAvatar";
import {
  getPartLabel,
  LEARNING_JOURNEY_PARTS,
  type LearningJourneyPartId,
} from "@/domain/learning-journey/learning-journey.catalog";

interface StudentRow {
  id: string;
  name: string;
  email?: string;
  avatar?: string | null;
  image?: string | null;
}

export interface MissionEnrollmentModalProps {
  variant: "tutor" | "admin";
  onClose: () => void;
  initialStudentId?: string;
}

function MissionEnrollmentChecklist({
  learnerId,
  enrolledParts,
  onCancel,
}: {
  learnerId: string;
  enrolledParts: LearningJourneyPartId[];
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<LearningJourneyPartId>>(
    () => new Set(enrolledParts),
  );
  const saveMutation = useSetLearnerMissionEnrollments();

  const togglePart = (part: LearningJourneyPartId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(part)) {
        next.delete(part);
      } else {
        next.add(part);
      }
      return next;
    });
  };

  const handleSave = () => {
    const parts = [...selected].sort((a, b) => a - b);
    saveMutation.mutate(
      { learnerId, parts },
      { onSuccess: () => onCancel() },
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Select the missions this learner should be enrolled in.
      </p>
      <ul className="space-y-2">
        {LEARNING_JOURNEY_PARTS.map((partDef) => {
          const checked = selected.has(partDef.part);
          return (
            <li key={partDef.part}>
              <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  checked={checked}
                  onChange={() => togglePart(partDef.part)}
                />
                <span className="text-sm text-gray-900">{getPartLabel(partDef.part)}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Saving…
            </>
          ) : (
            "Save enrollments"
          )}
        </Button>
      </div>
    </div>
  );
}

function StudentMissionEnrollmentDetail({
  student,
  onBack,
}: {
  student: StudentRow;
  onBack: () => void;
}) {
  const [showChecklist, setShowChecklist] = useState(false);
  const { data: enrolledParts = [], isLoading } = useLearnerMissionEnrollments(
    student.id,
  );

  if (showChecklist) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setShowChecklist(false)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to student
        </button>
        <MissionEnrollmentChecklist
          learnerId={student.id}
          enrolledParts={enrolledParts}
          onCancel={() => setShowChecklist(false)}
        />
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to students
      </button>

      <div className="flex items-center gap-4 mb-6">
        <LearnerAvatar learner={student} size="lg" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{student.name}</h3>
          {student.email && (
            <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              {student.email}
            </p>
          )}
          <p className="text-xs text-emerald-700 font-medium mt-2">
            {formatEnrollmentBadge(enrolledParts.length)}
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">Enrolled Missions</h4>
        <Button type="button" size="sm" onClick={() => setShowChecklist(true)}>
          Manage enrollments
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      ) : (
        <ul className="space-y-2">
          {LEARNING_JOURNEY_PARTS.map((partDef) => {
            const enrolled = enrolledParts.includes(partDef.part);
            return (
              <li
                key={partDef.part}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100"
              >
                {enrolled ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-300 shrink-0" />
                )}
                <span
                  className={`text-sm ${enrolled ? "text-gray-900" : "text-gray-400"}`}
                >
                  {getPartLabel(partDef.part)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function MissionEnrollmentModal({
  variant,
  onClose,
  initialStudentId,
}: MissionEnrollmentModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    initialStudentId ?? null,
  );

  const { data: tutorData, isLoading: tutorLoading } = useTutorStudents(
    { limit: 1000 },
    { enabled: variant === "tutor" },
  );
  const { data: adminData, isLoading: adminLoading } = useAiDrillBuilderLearners(
    variant === "admin",
  );
  const { data: enrollmentMap } = useMissionEnrollmentsList();

  const isLoading = variant === "tutor" ? tutorLoading : adminLoading;

  const students: StudentRow[] = useMemo(() => {
    if (variant === "tutor") {
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
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  }, [variant, tutorData, adminData]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q),
    );
  }, [students, searchQuery]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) ?? null,
    [students, selectedStudentId],
  );

  const getEnrolledCount = useCallback(
    (studentId: string) => enrollmentMap?.get(studentId)?.length ?? 0,
    [enrollmentMap],
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Mission Enrollment
              </h2>
              <p className="text-xs text-gray-500">
                Enroll learners in Learning Journey missions ({TOTAL_MISSION_COUNT}{" "}
                total)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          {selectedStudent ? (
            <StudentMissionEnrollmentDetail
              student={selectedStudent}
              onBack={() => setSelectedStudentId(null)}
            />
          ) : (
            <>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search students by name or email…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                </div>
              ) : filteredStudents.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-10">
                  {searchQuery ? "No students match your search" : "No students found"}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredStudents.map((student) => {
                    const enrolledCount = getEnrolledCount(student.id);
                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => setSelectedStudentId(student.id)}
                        className="w-full text-left"
                      >
                        <Card className="hover:shadow-md transition-shadow cursor-pointer p-4">
                          <div className="flex items-center gap-3">
                            <LearnerAvatar learner={student} size="md" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">
                                {student.name}
                              </p>
                              {student.email && (
                                <p className="text-xs text-gray-500 truncate">
                                  {student.email}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {enrolledCount}/{TOTAL_MISSION_COUNT}
                            </span>
                          </div>
                        </Card>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function EnrollmentButton({
  onClick,
  className = "",
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <UserCheck className="w-4 h-4" />
      Enrollment
    </Button>
  );
}
