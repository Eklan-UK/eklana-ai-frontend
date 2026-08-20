"use client";

import { Check, Loader2, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { learnerDisplayName } from "@/components/simulation/scenario-form-shared";
import type { ScenarioFormState } from "@/hooks/useScenarioFormState";

interface Learner {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface LearnerAssignmentPickerProps {
  formState: ScenarioFormState;
  learners: Learner[];
  learnersLoading: boolean;
}

// Shared "who can access this scenario" sidebar for both the creation and
// edit forms.
export function LearnerAssignmentPicker({ formState, learners, learnersLoading }: LearnerAssignmentPickerProps) {
  const {
    selectedLearnerIds,
    learnerSearch,
    setLearnerSearch,
    handleToggleLearner,
    filterLearners,
    handleSelectAllFiltered,
  } = formState;

  const filteredLearners = filterLearners(learners);

  return (
    <div className="flex max-h-[calc(100vh-3rem)] flex-col rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Users className="h-4 w-4 text-[#3B883E]" />
          Who can access <span className="text-red-500">*</span>
        </h3>
        <p className="mt-1 text-xs text-gray-500">Select the learners who can practise this scenario</p>
      </div>

      <div className="space-y-2 px-5 pt-4">
        <input
          type="text"
          value={learnerSearch}
          onChange={(e) => setLearnerSearch(e.target.value)}
          placeholder="Search name or email…"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#3B883E] focus:ring-1 focus:ring-[#3B883E]/30"
        />
        <button
          type="button"
          onClick={() => handleSelectAllFiltered(filteredLearners.map((l) => l._id))}
          className="text-xs font-medium text-[#3B883E] hover:underline"
        >
          {filteredLearners.length > 0 && filteredLearners.every((l) => selectedLearnerIds.includes(l._id))
            ? "Deselect filtered"
            : "Select all filtered"}
        </button>
        <p className="text-xs text-gray-500">{selectedLearnerIds.length} selected</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3">
        {learnersLoading ? (
          <div className="flex justify-center py-8 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filteredLearners.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No learners found</p>
        ) : (
          <ul className="space-y-1">
            {filteredLearners.map((learner) => {
              const isSelected = selectedLearnerIds.includes(learner._id);
              const name = learnerDisplayName(learner);
              return (
                <li key={learner._id}>
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 transition-colors ${
                      isSelected ? "border-emerald-200 bg-emerald-50" : "border-transparent hover:bg-gray-50"
                    }`}
                  >
                    <Checkbox checked={isSelected} onChange={() => handleToggleLearner(learner._id)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{name}</p>
                      {learner.email && <p className="truncate text-xs text-gray-500">{learner.email}</p>}
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-[#3B883E]" />}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
