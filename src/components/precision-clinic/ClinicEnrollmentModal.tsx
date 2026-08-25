"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  Lock,
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
  useClinicEnrollmentsList,
  useLearnerClinicEnrollment,
  useSetLearnerClinicEnrollment,
} from "@/hooks/usePrecisionClinicEnrollments";
import {
  getLearnerDisplayName,
  getLearnerId,
} from "@/lib/ai-drill-builder/learner-utils";
import { LearnerAvatar } from "@/components/ai-drill-builder/LearnerAvatar";

interface StudentRow {
  id: string;
  name: string;
  email?: string;
  avatar?: string | null;
  image?: string | null;
}

function ClinicEnrollmentToggle({
  learnerId,
  enrolled,
  onCancel,
}: {
  learnerId: string;
  enrolled: boolean;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState(enrolled);
  const saveMutation = useSetLearnerClinicEnrollment();

  const handleSave = () => {
    saveMutation.mutate(
      { learnerId, enrolled: selected },
      { onSuccess: () => onCancel() },
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Unlock Precision Clinic for this learner, or lock it again. Existing
        assignments are kept either way.
      </p>
      <button
        type="button"
        onClick={() => setSelected((prev) => !prev)}
        className="w-full text-left"
      >
        <div
          className={`flex items-center gap-3 p-3 rounded-xl border ${
            selected
              ? "border-emerald-200 bg-emerald-50"
              : "border-gray-200 hover:bg-gray-50"
          }`}
        >
          {selected ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <Lock className="w-5 h-5 text-gray-400 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">
              {selected ? "Enrolled" : "Locked"}
            </p>
            <p className="text-xs text-gray-500">
              {selected
                ? "Learner can open Precision Clinic (Pro still required)."
                : "Learner cannot open Precision Clinic until enrolled."}
            </p>
          </div>
        </div>
      </button>
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
            "Save enrollment"
          )}
        </Button>
      </div>
    </div>
  );
}

function StudentClinicEnrollmentDetail({
  student,
  onBack,
}: {
  student: StudentRow;
  onBack: () => void;
}) {
  const [showToggle, setShowToggle] = useState(false);
  const { data: enrolled = false, isLoading } = useLearnerClinicEnrollment(
    student.id,
  );

  if (showToggle) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setShowToggle(false)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to student
        </button>
        <ClinicEnrollmentToggle
          learnerId={student.id}
          enrolled={enrolled}
          onCancel={() => setShowToggle(false)}
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
          <p
            className={`text-xs font-medium mt-2 ${
              enrolled ? "text-emerald-700" : "text-gray-500"
            }`}
          >
            {enrolled ? "Enrolled" : "Locked"}
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">
          Precision Clinic access
        </h4>
        <Button type="button" size="sm" onClick={() => setShowToggle(true)}>
          Manage enrollment
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
          {enrolled ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <Circle className="w-5 h-5 text-gray-300 shrink-0" />
          )}
          <span
            className={`text-sm ${enrolled ? "text-gray-900" : "text-gray-400"}`}
          >
            {enrolled ? "Enrolled" : "Locked"}
          </span>
        </div>
      )}
    </div>
  );
}

export interface ClinicEnrollmentModalProps {
  onClose: () => void;
  initialStudentId?: string;
  variant?: "admin" | "tutor";
}

export function ClinicEnrollmentModal({
  onClose,
  initialStudentId,
  variant = "admin",
}: ClinicEnrollmentModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    initialStudentId ?? null,
  );

  const { data: tutorData, isLoading: tutorLoading } = useTutorStudents(
    { limit: 1000 },
    { enabled: variant === "tutor" },
  );
  const { data: adminData, isLoading: adminLoading } =
    useAiDrillBuilderLearners(variant === "admin");
  const { data: enrolledIds } = useClinicEnrollmentsList();

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

  const isEnrolled = useCallback(
    (studentId: string) => enrolledIds?.has(studentId) ?? false,
    [enrolledIds],
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
                Clinic Enrollment
              </h2>
              <p className="text-xs text-gray-500">
                Unlock Precision Clinic for individual learners
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
            <StudentClinicEnrollmentDetail
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
                  {searchQuery
                    ? "No students match your search"
                    : variant === "tutor"
                      ? "No assigned students found"
                      : "No students found"}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredStudents.map((student) => {
                    const enrolled = isEnrolled(student.id);
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
                            <span
                              className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                                enrolled
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-gray-50 text-gray-600 border-gray-200"
                              }`}
                            >
                              {enrolled ? "Enrolled" : "Locked"}
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

export function ClinicEnrollmentButton({
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
