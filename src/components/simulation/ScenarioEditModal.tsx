"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useAllLearners } from "@/hooks/useAdmin";
import { useTutorStudents } from "@/hooks/useTutor";
import { useScenarioFormState } from "@/hooks/useScenarioFormState";
import {
  buildScenarioFormData,
  validateScenarioForm,
  type PhaseFormState,
} from "@/components/simulation/scenario-form-shared";
import { ScenarioFormFields } from "@/components/simulation/ScenarioFormFields";
import { LearnerAssignmentPicker } from "@/components/simulation/LearnerAssignmentPicker";

interface ScenarioEditModalProps {
  scenarioId: string;
  variant: "tutor" | "admin";
  onClose: () => void;
  onSaved: () => void;
}

interface ScenarioDetail {
  workplaceSetting: string;
  studentCharacterName: string;
  gradingRubric: string;
  maxDurationMinutes: number;
  topicId: string;
  background: string;
  patientInformation: string;
  hints: Array<{ phaseTitle: string; hintText: string }>;
  scenarioScript: Omit<PhaseFormState, "characterInput">[];
  assignedLearnerIds: Array<{ _id: string }>;
  hasSessions: boolean;
}

export function ScenarioEditModal({ scenarioId, variant, onClose, onSaved }: ScenarioEditModalProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const formState = useScenarioFormState();

  const { data: adminLearnersData, isLoading: adminLearnersLoading } = useAllLearners(
    { limit: 1000 },
    { enabled: variant === "admin" },
  );
  const { data: tutorStudentsData, isLoading: tutorStudentsLoading } = useTutorStudents(
    { limit: 1000 },
    { enabled: variant === "tutor" },
  );
  const learners = variant === "admin" ? adminLearnersData?.learners ?? [] : tutorStudentsData?.students ?? [];
  const learnersLoading = variant === "admin" ? adminLearnersLoading : tutorStudentsLoading;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/v1/admin/simulation/scenarios/${scenarioId}`, {
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? "Failed to load scenario");
        if (cancelled) return;

        const scenario = json.data as ScenarioDetail;
        formState.resetForm({
          form: {
            workplaceSetting: scenario.workplaceSetting,
            studentCharacterName: scenario.studentCharacterName,
            gradingRubric: scenario.gradingRubric,
            maxDurationMinutes: String(scenario.maxDurationMinutes),
            topicId: scenario.topicId,
          },
          background: scenario.background,
          patientInformation: scenario.patientInformation,
          phases: (scenario.scenarioScript ?? []).map((phase) => ({ ...phase, characterInput: "" })),
          hints: scenario.hints ?? [],
          selectedLearnerIds: (scenario.assignedLearnerIds ?? []).map((l) => l._id),
        });
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Failed to load scenario";
        setLoadError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Initial load only — formState.resetForm is stable across renders (from useState setters).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateScenarioForm(
      formState.form,
      formState.background,
      formState.patientInformation,
      formState.phases,
      formState.hints,
      formState.selectedLearnerIds,
    );
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const formData = buildScenarioFormData(
        formState.form,
        formState.background,
        formState.patientInformation,
        formState.phases,
        formState.hints,
        formState.selectedLearnerIds,
      );

      const res = await fetch(`/api/v1/admin/simulation/scenarios/${scenarioId}`, {
        method: "PATCH",
        credentials: "include",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to update scenario");

      toast.success("Scenario updated");
      onSaved();
    } catch (e: unknown) {
      // Covers the race where a student starts a session between this modal
      // opening and submit — the PATCH guard rejects with a 400 and the
      // message here is exactly what the backend sent.
      const message = e instanceof Error ? e.message : "Failed to update scenario";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <h2 className="text-base font-semibold text-gray-900">Edit Scenario</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : loadError ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-red-600">{loadError}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-8 px-6 py-6 lg:grid-cols-[1fr_320px]">
            <div className="min-w-0 space-y-6">
              <ScenarioFormFields formState={formState} />

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-xl bg-[#3B883E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2f6f32] disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </div>

            <aside className="lg:sticky lg:top-6 lg:self-start">
              <LearnerAssignmentPicker formState={formState} learners={learners} learnersLoading={learnersLoading} />
            </aside>
          </form>
        )}
      </div>
    </div>
  );
}
