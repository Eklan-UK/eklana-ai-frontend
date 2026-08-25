"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Check, Filter, Loader2, X } from "lucide-react";
import { useAllLearners } from "@/hooks/useAdmin";
import { useTutorStudents } from "@/hooks/useTutor";
import { Checkbox } from "@/components/ui/Checkbox";

export type AnalyticsLearnerSource = "all" | "tutor";

interface AnalyticsLearnerFilterProps {
  value: string[];
  onChange: (learnerIds: string[]) => void;
  learnerSource?: AnalyticsLearnerSource;
}

function learnerDisplayName(learner: {
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
}) {
  const fromParts = `${learner.firstName ?? ""} ${learner.lastName ?? ""}`.trim();
  return fromParts || learner.name || learner.email || "Unknown";
}

type FilterLearner = {
  _id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
};

export function AnalyticsLearnerFilter({
  value,
  onChange,
  learnerSource = "all",
}: AnalyticsLearnerFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: allLearnersData, isLoading: allLoading } = useAllLearners(
    { limit: 1000 },
    { enabled: learnerSource === "all" }
  );
  const { data: tutorData, isLoading: tutorLoading } = useTutorStudents(
    { limit: 1000 },
    { enabled: learnerSource === "tutor" }
  );

  const learners: FilterLearner[] = useMemo(() => {
    if (learnerSource === "tutor") {
      return (tutorData?.students ?? []).map((s: FilterLearner & { _id?: string; id?: string }) => ({
        _id: String(s._id ?? s.id ?? ""),
        firstName: s.firstName,
        lastName: s.lastName,
        name: s.name,
        email: s.email,
      })).filter((s) => s._id);
    }
    return (allLearnersData?.learners ?? []) as FilterLearner[];
  }, [allLearnersData?.learners, learnerSource, tutorData?.students]);

  const isLoading = learnerSource === "tutor" ? tutorLoading : allLoading;
  const emptyLabel =
    learnerSource === "tutor" ? "Showing all assigned students" : "Showing all learners";

  const selectedSet = useMemo(() => new Set(value), [value]);

  const filteredLearners = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return learners;
    return learners.filter((learner) => {
      const name = learnerDisplayName(learner).toLowerCase();
      const email = (learner.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [learners, search]);

  const selectedLearners = useMemo(
    () => learners.filter((l) => selectedSet.has(l._id)),
    [learners, selectedSet]
  );

  const handleToggle = useCallback(
    (learnerId: string) => {
      onChange(
        selectedSet.has(learnerId)
          ? value.filter((id) => id !== learnerId)
          : [...value, learnerId]
      );
    },
    [onChange, selectedSet, value]
  );

  const handleSelectAllFiltered = useCallback(() => {
    const ids = filteredLearners.map((l) => l._id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedSet.has(id));
    if (allSelected) {
      onChange(value.filter((id) => !ids.includes(id)));
    } else {
      onChange(Array.from(new Set([...value, ...ids])));
    }
  }, [filteredLearners, onChange, selectedSet, value]);

  const handleClearAll = useCallback(() => {
    onChange([]);
    setSearch("");
  }, [onChange]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          <Filter className="h-4 w-4 text-gray-500" />
          Filter learners
          {value.length > 0 && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              {value.length}
            </span>
          )}
        </button>

        {value.length === 0 && (
          <span className="text-sm text-gray-500">{emptyLabel}</span>
        )}
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {selectedLearners.map((learner) => (
            <span
              key={learner._id}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-gray-800"
            >
              {learnerDisplayName(learner)}
              <button
                type="button"
                onClick={() => handleToggle(learner._id)}
                className="rounded-full p-0.5 text-gray-500 hover:bg-emerald-100 hover:text-gray-700"
                aria-label={`Remove ${learnerDisplayName(learner)}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs font-medium text-gray-500 hover:text-gray-700 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {open && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">Select learners</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close filter"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2 border-b border-gray-100 px-4 py-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
            />
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-xs font-medium text-emerald-600 hover:underline"
              >
                {filteredLearners.every((l) => selectedSet.has(l._id))
                  ? "Deselect filtered"
                  : "Select all filtered"}
              </button>
              <p className="text-xs text-gray-500">{value.length} selected</p>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto px-3 py-3">
            {isLoading ? (
              <div className="flex justify-center py-8 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : filteredLearners.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No learners found</p>
            ) : (
              <ul className="space-y-1">
                {filteredLearners.map((learner) => {
                  const isSelected = selectedSet.has(learner._id);
                  const name = learnerDisplayName(learner);
                  return (
                    <li key={learner._id}>
                      <label
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 transition-colors ${
                          isSelected
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-transparent hover:bg-gray-50"
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onChange={() => handleToggle(learner._id)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">{name}</p>
                          {learner.email && (
                            <p className="truncate text-xs text-gray-500">{learner.email}</p>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
