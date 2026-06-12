"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Search,
  UserPlus,
  UserMinus,
  Loader2,
  Users,
  Mail,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { adminAPI } from "@/lib/api";
import {
  useTutorAssignedStudents,
  useAssignTutorToStudent,
  useUnassignTutorFromStudent,
} from "@/hooks/useAdmin";
import { Card } from "@/components/ui/Card";

function displayName(u: { firstName?: string; lastName?: string; email?: string }) {
  const full = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return full || u.email || "Unknown";
}

export default function TutorStudentsPage() {
  const params = useParams();
  const tutorId = params.tutorId as string;

  const [assignedSearch, setAssignedSearch] = useState("");
  const [addSearch, setAddSearch] = useState("");

  // Fetch tutor info
  const { data: tutorData } = useQuery({
    queryKey: ["admin", "user", tutorId],
    queryFn: () => adminAPI.getUserById(tutorId),
    enabled: !!tutorId,
    staleTime: 60_000,
  });
  const tutor = tutorData?.user;
  const tutorName = tutor ? displayName(tutor) : "Tutor";

  // Assigned students
  const {
    data: assignedData,
    isLoading: assignedLoading,
  } = useTutorAssignedStudents(tutorId, assignedSearch);
  const assignedStudents = assignedData?.students ?? [];

  const assignedIds = useMemo(
    () => new Set(assignedStudents.map((s) => s.id)),
    [assignedStudents]
  );

  // Available learners to add
  const { data: allLearnersData, isLoading: learnersLoading } = useQuery({
    queryKey: ["admin", "learners", "all-for-assign", addSearch],
    queryFn: () =>
      adminAPI.getAllLearners({
        search: addSearch.trim() || undefined,
        limit: 50,
        offset: 0,
      }),
    staleTime: 30_000,
  });
  const allLearners = useMemo(() => {
    const learners =
      (allLearnersData as any)?.data?.learners ??
      (allLearnersData as any)?.learners ??
      [];
    return (learners as any[]).filter((l: any) => !assignedIds.has(l._id ?? l.id));
  }, [allLearnersData, assignedIds]);

  const assignMutation = useAssignTutorToStudent(tutorId);
  const unassignMutation = useUnassignTutorFromStudent(tutorId);

  const [pendingAssign, setPendingAssign] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  const handleAssign = useCallback(
    (studentId: string) => {
      setPendingAssign(studentId);
      assignMutation.mutate(studentId, {
        onSettled: () => setPendingAssign(null),
      });
    },
    [assignMutation]
  );

  const handleRemove = useCallback(
    (studentId: string) => {
      if (!window.confirm("Remove this student from the tutor's list?")) return;
      setPendingRemove(studentId);
      unassignMutation.mutate(studentId, {
        onSettled: () => setPendingRemove(null),
      });
    },
    [unassignMutation]
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      {/* Header */}
      <div>
        <Link
          href="/admin/tutor"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tutors
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {tutorName}&rsquo;s Students
            </h1>
            {tutor?.email && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                <Mail className="h-4 w-4" />
                {tutor.email}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2">
            <Users className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">
              {assignedStudents.length} assigned
            </span>
          </div>
        </div>
      </div>

      {/* Assigned students */}
      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          Assigned Students
        </h2>

        <div className="mb-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search assigned students…"
              value={assignedSearch}
              onChange={(e) => setAssignedSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {assignedLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : assignedStudents.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            {assignedSearch
              ? "No assigned students match your search."
              : "No students assigned to this tutor yet. Assign some below."}
          </p>
        ) : (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {assignedStudents.map((s) => (
              <div
                key={s.assignmentId}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="font-medium text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.email}</p>
                  <p className="text-xs text-gray-400">
                    Assigned{" "}
                    {new Date(s.assignedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/learners/${s.id}`}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    View Profile
                  </Link>
                  <button
                    type="button"
                    disabled={pendingRemove === s.id}
                    onClick={() => handleRemove(s.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                  >
                    {pendingRemove === s.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserMinus className="h-3.5 w-3.5" />
                    )}
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add students */}
      <Card className="p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">
          Add Students
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          Search learners and assign them to this tutor. A student can be
          assigned to multiple tutors.
        </p>

        <div className="mb-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search learners by name or email…"
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
        </div>

        {learnersLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          </div>
        ) : allLearners.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            {addSearch
              ? "No unassigned learners match your search."
              : "All learners are already assigned to this tutor."}
          </p>
        ) : (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {allLearners.map((l: any) => {
              const studentId = l._id ?? l.id;
              const name = displayName(l);
              const isBusy = pendingAssign === studentId;
              return (
                <div
                  key={studentId}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-gray-900">{name}</p>
                    <p className="text-xs text-gray-500">{l.email}</p>
                  </div>
                  <button
                    type="button"
                    disabled={isBusy || assignMutation.isPending}
                    onClick={() => handleAssign(studentId)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#3d8c40] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#327035] disabled:opacity-50"
                  >
                    {isBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5" />
                    )}
                    Assign
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {assignedStudents.length > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              {assignedStudents.length} student
              {assignedStudents.length === 1 ? "" : "s"} already assigned to{" "}
              {tutorName} and hidden from this list.
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
