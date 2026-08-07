"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Search, Users, X } from "lucide-react";
import { useAllLearners } from "@/hooks/useAdmin";
import { useAssignPrecisionClinic } from "@/hooks/usePrecisionClinic";
import { Checkbox } from "@/components/ui/Checkbox";

type ClinicAssignModalProps = {
  drillId: string;
  drillTitle: string;
  onClose: () => void;
};

export function ClinicAssignModal({
  drillId,
  drillTitle,
  onClose,
}: ClinicAssignModalProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data, isLoading } = useAllLearners({ limit: 500 });
  const assignMutation = useAssignPrecisionClinic();

  const learners = data?.learners ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return learners;
    return learners.filter((learner: any) => {
      const user = learner.userId || {};
      const name =
        `${learner.firstName ?? user.firstName ?? ""} ${learner.lastName ?? user.lastName ?? ""}`.trim();
      const email = String(learner.email ?? user.email ?? "");
      return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
    });
  }, [learners, search]);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAssign = () => {
    if (selectedIds.length === 0) return;
    assignMutation.mutate(
      {
        id: drillId,
        userIds: selectedIds,
      },
      {
        onSuccess: () => onClose(),
      }
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white dark:bg-card">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4 dark:border-border">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-foreground">
              Assign to Students
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-muted-foreground">
              {drillTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-6 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search learners…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#418b43] dark:border-border dark:bg-background dark:text-foreground"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <Users className="mb-2 h-8 w-8" />
              <p className="text-sm">No learners found</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((learner: {
                _id?: string;
                id?: string;
                firstName?: string;
                lastName?: string;
                email?: string;
                userId?: { firstName?: string; lastName?: string; email?: string };
              }) => {
                const id = (learner._id ?? learner.id)?.toString() ?? "";
                const user = learner.userId;
                const name =
                  `${learner.firstName ?? user?.firstName ?? ""} ${learner.lastName ?? user?.lastName ?? ""}`.trim() ||
                  "Unknown";
                const email = learner.email ?? user?.email ?? "";
                const selected = selectedIds.includes(id);
                return (
                  <li key={id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                        selected
                          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                          : "border-gray-100 bg-gray-50 hover:bg-gray-100 dark:border-border dark:bg-background dark:hover:bg-muted"
                      }`}
                    >
                      <Checkbox
                        checked={selected}
                        onChange={() => toggle(id)}
                        className="rounded border-gray-300"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-foreground">
                          {name}
                        </p>
                        {email ? (
                          <p className="truncate text-xs text-gray-500 dark:text-muted-foreground">
                            {email}
                          </p>
                        ) : null}
                      </div>
                      {selected ? <Check className="h-4 w-4 text-emerald-600" /> : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex gap-3 border-t border-gray-100 px-6 py-4 dark:border-border">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-border dark:text-foreground dark:hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0 || assignMutation.isPending}
            onClick={handleAssign}
            className="flex-1 rounded-xl bg-[#418b43] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#3a7c3b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {assignMutation.isPending
              ? "Assigning…"
              : `Assign (${selectedIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
