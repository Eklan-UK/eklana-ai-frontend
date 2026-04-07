"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@/lib/api";
import { queryKeys } from "@/lib/react-query";

export default function AdminTutorPromotePage() {
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "tutor-promote", "users", search],
    queryFn: async () => {
      return adminAPI.getAllUsers({
        role: "user",
        limit: 200,
        offset: 0,
        search: search.trim() || undefined,
      });
    },
    staleTime: 60_000,
  });

  const users = data?.users ?? [];

  const promoteMutation = useMutation({
    mutationFn: (userId: string) =>
      adminAPI.assignRole(userId, "tutor", {}),
    onSuccess: () => {
      toast.success("Learner promoted to tutor");
      queryClient.invalidateQueries({
        queryKey: ["admin", "tutor-promote"],
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
    },
    onError: (e: Error) => {
      toast.error(e.message || "Could not promote user");
    },
    onSettled: () => {
      setPendingId(null);
    },
  });

  const handlePromote = (userId: string, name: string) => {
    if (
      !window.confirm(
        `Promote "${name}" to tutor? Their role will change from learner (user) to tutor.`,
      )
    ) {
      return;
    }
    setPendingId(userId);
    promoteMutation.mutate(userId);
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tutor</h1>
        <p className="mt-1 text-sm text-gray-500">
          Select a learner and promote them to a tutor account. Their role will
          change from learner to tutor.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-100 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#3d8c40]/40 focus:outline-none focus:ring-2 focus:ring-[#3d8c40]/20"
            />
          </div>
          <p className="text-xs text-gray-400">
            Showing learners (<span className="font-medium text-gray-600">role: user</span>
            ) only.
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error instanceof Error ? error.message : "Failed to load learners"}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Learner
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Email
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#3d8c40]" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-10 text-center text-gray-500"
                  >
                    No learners match your search.
                  </td>
                </tr>
              ) : (
                users.map((u: Record<string, unknown>) => {
                  const id = String(u._id ?? "");
                  const first = (u.firstName as string) || "";
                  const last = (u.lastName as string) || "";
                  const name =
                    `${first} ${last}`.trim() || (u.email as string) || "Unknown";
                  const email = (u.email as string) || "—";
                  const busy = pendingId === id && promoteMutation.isPending;

                  return (
                    <tr key={id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3.5 font-semibold text-gray-900">
                        {name}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">{email}</td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handlePromote(id, name)}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#3d8c40] px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#327035] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserPlus className="h-3.5 w-3.5" strokeWidth={2.5} />
                          )}
                          Promote to tutor
                        </button>
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
