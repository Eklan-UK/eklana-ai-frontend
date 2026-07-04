"use client";

import { Loader2, Users, X } from "lucide-react";
import { useDrillAssignments } from "@/hooks/useAdmin";

interface AssignedStudentsModalProps {
  drillId: string;
  drillTitle?: string;
  onClose: () => void;
}

/**
 * Shared "quick view" modal listing the students a drill is assigned to.
 * Used by the admin/tutor drill detail pages and the weekly drill list so
 * assignment status can be checked without navigating away.
 */
export function AssignedStudentsModal({
  drillId,
  drillTitle,
  onClose,
}: AssignedStudentsModalProps) {
  const { data, isLoading } = useDrillAssignments(drillId);
  const assignments: any[] = data?.assignments ?? data?.data?.assignments ?? [];

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              {drillTitle || "Assigned Students"}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {isLoading
                ? "Loading…"
                : assignments.length === 0
                  ? "No students assigned"
                  : `${assignments.length} student${assignments.length !== 1 ? "s" : ""} assigned`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <Users className="w-8 h-8 mb-2" />
              <p className="text-sm">No students assigned to this drill yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {assignments.map((a: any) => {
                const user = a.learnerId ?? a.userId ?? a.user;
                const name = user
                  ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
                  : "Unknown";
                const email = user?.email ?? "";
                const status = a.status ?? "pending";
                return (
                  <li key={a._id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{name}</p>
                      {email && <p className="text-xs text-gray-500">{email}</p>}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        status === "completed"
                          ? "bg-emerald-100 text-emerald-700"
                          : status === "in_progress"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {status.replace("_", " ")}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
