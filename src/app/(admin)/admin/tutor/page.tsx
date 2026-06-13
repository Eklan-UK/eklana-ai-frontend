"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, UserPlus, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@/lib/api";
import { queryKeys } from "@/lib/react-query";
import Link from "next/link";

type RoleFilter = "all" | "user" | "tutor";

type UserRow = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: string;
};

function displayName(u: UserRow): string {
  const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return name || u.email || "Unknown";
}

export default function AdminTutorPromotePage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [pendingAction, setPendingAction] = useState<{
    userId: string;
    role: "user" | "tutor";
  } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "tutor-promote", "users", search, roleFilter],
    queryFn: async () => {
      return adminAPI.getAllUsers({
        role: roleFilter === "all" ? undefined : roleFilter,
        limit: 200,
        offset: 0,
        search: search.trim() || undefined,
      });
    },
    staleTime: 60_000,
  });

  const users = useMemo(() => {
    const rows = (data?.users ?? []) as UserRow[];
    return rows.filter((u) => u.role === "user" || u.role === "tutor");
  }, [data?.users]);

  const roleMutation = useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: "user" | "tutor";
    }) => adminAPI.assignRole(userId, role, {}),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.role === "tutor"
          ? "Learner promoted to tutor"
          : "Tutor changed back to learner",
      );
      queryClient.invalidateQueries({
        queryKey: ["admin", "tutor-promote"],
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
    },
    onError: (e: Error) => {
      toast.error(e.message || "Could not update user role");
    },
    onSettled: () => {
      setPendingAction(null);
    },
  });

  const handleRoleChange = (
    userId: string,
    name: string,
    role: "user" | "tutor",
  ) => {
    const message =
      role === "tutor"
        ? `Promote "${name}" to tutor? Their role will change from learner to tutor.`
        : `Change "${name}" back to learner? Their role will change from tutor to learner.`;

    if (!window.confirm(message)) return;

    setPendingAction({ userId, role });
    roleMutation.mutate({ userId, role });
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tutor</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage learner and tutor roles. Promote learners to tutors or change
          tutors back to learners.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <nav
              className="inline-flex w-full max-w-md items-center rounded-full border border-gray-200 bg-white px-2 py-1.5 sm:w-auto"
              role="tablist"
              aria-label="Filter by role"
            >
              {(
                [
                  { id: "all", label: "All" },
                  { id: "user", label: "Learners" },
                  { id: "tutor", label: "Tutors" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={roleFilter === tab.id}
                  onClick={() => setRoleFilter(tab.id)}
                  className={`flex-1 rounded-full px-4 py-2 text-sm transition-colors sm:flex-none ${
                    roleFilter === tab.id
                      ? "bg-emerald-50 font-bold text-[#3d8c40]"
                      : "font-medium text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="relative w-full max-w-md lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-100 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#3d8c40]/40 focus:outline-none focus:ring-2 focus:ring-[#3d8c40]/20"
              />
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Showing {users.length} {roleFilter === "all" ? "learner/tutor" : roleFilter === "user" ? "learner" : "tutor"}
            {users.length === 1 ? "" : "s"}
            {search.trim() ? ` matching "${search.trim()}"` : ""}.
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error instanceof Error ? error.message : "Failed to load users"}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  User
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Email
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Role
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#3d8c40]" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-gray-500"
                  >
                    No users match your filters.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const id = String(u._id);
                  const name = displayName(u);
                  const email = u.email || "—";
                  const isTutor = u.role === "tutor";
                  const isLearner = u.role === "user";
                  const tutorBusy =
                    pendingAction?.userId === id &&
                    pendingAction.role === "tutor" &&
                    roleMutation.isPending;
                  const learnerBusy =
                    pendingAction?.userId === id &&
                    pendingAction.role === "user" &&
                    roleMutation.isPending;

                  return (
                    <tr key={id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3.5 font-semibold text-gray-900">
                        {name}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">{email}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isTutor
                              ? "bg-blue-100 text-blue-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {isTutor ? "Tutor" : "Learner"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {isTutor && (
                            <Link
                              href={`/admin/tutor/${id}/students`}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 shadow-sm transition-colors hover:bg-blue-100"
                            >
                              <Users className="h-3.5 w-3.5" strokeWidth={2.5} />
                              Manage Students
                            </Link>
                          )}
                          <button
                            type="button"
                            disabled={isTutor || tutorBusy || learnerBusy}
                            onClick={() => handleRoleChange(id, name, "tutor")}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#3d8c40] px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#327035] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {tutorBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <UserPlus className="h-3.5 w-3.5" strokeWidth={2.5} />
                            )}
                            Tutor
                          </button>
                          <button
                            type="button"
                            disabled={isLearner || tutorBusy || learnerBusy}
                            onClick={() => handleRoleChange(id, name, "user")}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {learnerBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <UserRound className="h-3.5 w-3.5" strokeWidth={2.5} />
                            )}
                            Learner
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
