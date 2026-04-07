"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTutorSessionAttendance } from "@/hooks/useClasses";

export function TutorSessionAttendanceClient({ sessionId }: { sessionId: string }) {
  const { data, isLoading, error } = useTutorSessionAttendance(sessionId);

  return (
    <div className="space-y-6 pb-24">
      <Link
        href="/tutor/classes"
        className="inline-flex items-center gap-2 text-sm font-medium text-green-700 hover:text-green-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to classes
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Session attendance</h1>
        <p className="mt-1 text-sm text-gray-500">
          Learners enrolled in this class series. “Present” is recorded when a student joins from the
          app.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-600">Loading…</p>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error instanceof Error ? error.message : "Could not load attendance."}
        </div>
      ) : null}

      {data?.attendance?.length ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Learner</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined (app)</th>
              </tr>
            </thead>
            <tbody>
              {data.attendance.map((row) => (
                <tr key={row.learnerId} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.displayName}</td>
                  <td className="px-4 py-3 capitalize text-gray-700">{row.status}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {row.joinedAt
                      ? new Date(row.joinedAt).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!isLoading && data && data.attendance.length === 0 ? (
        <p className="text-sm text-gray-600">No enrolled learners for this session.</p>
      ) : null}
    </div>
  );
}
