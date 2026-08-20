"use client";

import { useEffect, useState } from "react";
import { Loader2, Users, Plus, ChevronDown, ChevronUp, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { FileUploadZone } from "@/components/drills/FileUploadZone";
import { useAllLearners } from "@/hooks/useAdmin";
import { useTutorStudents } from "@/hooks/useTutor";
import { COMPETENCY_FRAMEWORK } from "@/config/competency-framework";
import { useScenarioFormState } from "@/hooks/useScenarioFormState";
import {
  buildScenarioFormData,
  validateScenarioForm,
  type ConversationBeatFormState,
  type GatedFindingFormState,
} from "@/components/simulation/scenario-form-shared";
import { ScenarioFormFields } from "@/components/simulation/ScenarioFormFields";
import { LearnerAssignmentPicker } from "@/components/simulation/LearnerAssignmentPicker";
import { ScenarioEditModal } from "@/components/simulation/ScenarioEditModal";

interface ScenarioManagementPageProps {
  variant: "tutor" | "admin";
}

interface AssignedLearner {
  _id: string;
  name: string;
}

interface ScenarioSummary {
  _id: string;
  title: string;
  workplaceSetting: string;
  studentCharacterName: string;
  topicId?: string;
  weeklyFocus: string[];
  maxDurationMinutes: number;
  assignedLearners: AssignedLearner[];
  hasSessions: boolean;
  createdAt: string;
}

export function ScenarioManagementPage({ variant }: ScenarioManagementPageProps) {
  const formState = useScenarioFormState();
  const [slideDeck, setSlideDeck] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(true);
  const [listExpanded, setListExpanded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null);

  // /admin/learners is admin-only, so tutors get their own assigned-students
  // list instead — same branch StudentListPage takes for the same reason.
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

  const fetchScenarios = async () => {
    setScenariosLoading(true);
    try {
      const res = await fetch("/api/v1/admin/simulation/scenarios", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load scenarios");
      setScenarios(json.data ?? []);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load scenarios";
      toast.error(message);
    } finally {
      setScenariosLoading(false);
    }
  };

  useEffect(() => {
    fetchScenarios();
  }, []);

  const handleDeleteScenario = async (scenarioId: string, title: string) => {
    const confirmed = window.confirm(`Delete "${title}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(scenarioId);
    try {
      const res = await fetch(`/api/v1/admin/simulation/scenarios/${scenarioId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to delete scenario");

      setScenarios((prev) => prev.filter((s) => s._id !== scenarioId));
      toast.success("Scenario deleted");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to delete scenario";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Slide deck extraction (preview / pre-fill) ────────────────────────────

  const canExtract = Boolean(slideDeck) && Boolean(formState.form.studentCharacterName.trim());

  const handleExtract = async () => {
    if (!slideDeck) return;
    if (!formState.form.studentCharacterName.trim()) {
      toast.error("Enter the student character name first");
      return;
    }

    setExtracting(true);
    try {
      const extractFormData = new FormData();
      extractFormData.append("file", slideDeck);
      extractFormData.append("studentCharacterName", formState.form.studentCharacterName.trim());

      const res = await fetch("/api/v1/admin/simulation/scenarios/extract", {
        method: "POST",
        credentials: "include",
        body: extractFormData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to extract from slide deck");

      const result = json.data as {
        displayData: string;
        studentHint: string;
        scenarioScript: Array<{
          phaseName: string;
          triggerCondition: string;
          characters: string[];
          conversationBeats: ConversationBeatFormState[];
          gatedFindings: GatedFindingFormState[];
        }>;
      };

      formState.setDisplayData(result.displayData ?? "");
      formState.setStudentHint(result.studentHint ?? "");
      formState.setPhases(
        (result.scenarioScript ?? []).map((phase) => ({
          phaseName: phase.phaseName,
          triggerCondition: phase.triggerCondition,
          characters: phase.characters,
          characterInput: "",
          conversationBeats: phase.conversationBeats,
          gatedFindings: phase.gatedFindings,
        })),
      );
      toast.success("Extracted from slide deck — review and edit below");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to extract from slide deck";
      toast.error(message);
    } finally {
      setExtracting(false);
    }
  };

  // ─── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateScenarioForm(
      formState.form,
      formState.displayData,
      formState.phases,
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
        formState.displayData,
        formState.studentHint,
        formState.phases,
        formState.selectedLearnerIds,
      );
      if (slideDeck) formData.append("file", slideDeck);

      const res = await fetch("/api/v1/admin/simulation/scenarios", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to create scenario");

      toast.success("Scenario created");
      formState.resetForm();
      setSlideDeck(null);
      fetchScenarios();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to create scenario";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="min-w-0">
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-5">
              <h2 className="text-base font-semibold text-gray-900">New Scenario</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
              <ScenarioFormFields
                formState={formState}
                slideDeckSection={
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Slide Deck (optional)</label>
                    <p className="text-xs text-gray-500">
                      Optionally upload a slide deck to pre-fill the fields below.
                    </p>
                    <FileUploadZone
                      acceptedTypes=".pptx"
                      onFileSelect={(file) => setSlideDeck(file)}
                      onRemove={() => setSlideDeck(null)}
                      disabled={submitting || extracting}
                    />
                    <button
                      type="button"
                      onClick={handleExtract}
                      disabled={!canExtract || extracting || submitting}
                      className="flex items-center gap-2 rounded-xl border border-[#3B883E] px-4 py-2 text-sm font-semibold text-[#3B883E] transition-colors hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {extracting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Extracting…
                        </>
                      ) : (
                        "Extract from slides"
                      )}
                    </button>
                    {slideDeck && !formState.form.studentCharacterName.trim() && (
                      <p className="text-xs text-amber-600">Enter the student character name above first</p>
                    )}
                  </div>
                }
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-xl bg-[#3B883E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2f6f32] disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create Scenario
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Side card: learner assignment */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <LearnerAssignmentPicker formState={formState} learners={learners} learnersLoading={learnersLoading} />
        </aside>
      </div>

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setListExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between px-6 py-5"
        >
          <div className="text-left">
            <h2 className="text-base font-semibold text-gray-900">Existing Scenarios</h2>
            <p className="text-sm text-gray-500">
              {scenariosLoading ? "Loading…" : `${scenarios.length} active scenario${scenarios.length === 1 ? "" : "s"}`}
            </p>
          </div>
          {listExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {listExpanded && (
          <div className="border-t border-gray-100 px-6 py-6">
            {scenariosLoading ? (
              <div className="flex justify-center py-8 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : scenarios.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No scenarios yet</p>
            ) : (
              <ul className="space-y-2">
                {scenarios.map((scenario) => (
                  <li
                    key={scenario._id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{scenario.title}</p>
                      <p className="truncate text-xs text-gray-500">{scenario.workplaceSetting}</p>
                      {scenario.topicId && (
                        <p className="truncate text-xs font-medium text-[#3B883E]">
                          {COMPETENCY_FRAMEWORK[scenario.topicId]?.topic ?? scenario.topicId}
                        </p>
                      )}
                    </div>

                    <div
                      className="flex w-40 shrink-0 items-center gap-1.5 text-xs text-gray-500"
                      title={scenario.assignedLearners.map((l) => l.name).join(", ")}
                    >
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {scenario.assignedLearners.length === 0
                          ? "No learners assigned"
                          : scenario.assignedLearners.map((l) => l.name).join(", ")}
                      </span>
                    </div>

                    <p className="w-28 shrink-0 text-right text-xs text-gray-500">
                      {formatDistanceToNow(new Date(scenario.createdAt), { addSuffix: true })}
                    </p>

                    <button
                      type="button"
                      onClick={() => setEditingScenarioId(scenario._id)}
                      disabled={scenario.hasSessions}
                      aria-label={
                        scenario.hasSessions
                          ? `${scenario.title} cannot be edited — students have already started sessions`
                          : `Edit ${scenario.title}`
                      }
                      title={
                        scenario.hasSessions
                          ? "Cannot be edited — students have already started sessions on this scenario"
                          : "Edit scenario"
                      }
                      className="shrink-0 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteScenario(scenario._id, scenario.title)}
                      disabled={deletingId === scenario._id}
                      aria-label={`Delete ${scenario.title}`}
                      className="shrink-0 rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                    >
                      {deletingId === scenario._id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {editingScenarioId && (
        <ScenarioEditModal
          scenarioId={editingScenarioId}
          variant={variant}
          onClose={() => setEditingScenarioId(null)}
          onSaved={() => {
            setEditingScenarioId(null);
            fetchScenarios();
          }}
        />
      )}
    </div>
  );
}
