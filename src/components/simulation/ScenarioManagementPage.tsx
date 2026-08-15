"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Users, X, Check, Plus, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Checkbox } from "@/components/ui/Checkbox";
import { FileUploadZone } from "@/components/drills/FileUploadZone";
import { useAllLearners } from "@/hooks/useAdmin";
import { useTutorStudents } from "@/hooks/useTutor";
import { COMPETENCY_FRAMEWORK } from "@/config/competency-framework";

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
  createdAt: string;
}

interface ConversationBeatFormState {
  character: string;
  intent: string;
  triggerCondition: string;
}

interface GatedFindingFormState {
  label: string;
  data: string;
  revealCondition: string;
}

interface PhaseFormState {
  phaseName: string;
  triggerCondition: string;
  characters: string[];
  characterInput: string;
  conversationBeats: ConversationBeatFormState[];
  gatedFindings: GatedFindingFormState[];
}

const emptyPhase = (): PhaseFormState => ({
  phaseName: "",
  triggerCondition: "",
  characters: [],
  characterInput: "",
  conversationBeats: [],
  gatedFindings: [],
});

const emptyForm = () => ({
  title: "",
  workplaceSetting: "",
  studentCharacterName: "",
  dramatisationPrompt: "",
  gradingRubric: "",
  maxDurationMinutes: "15",
  topicId: "",
});

function learnerDisplayName(learner: { firstName?: string; lastName?: string; email?: string }) {
  const name = `${learner.firstName ?? ""} ${learner.lastName ?? ""}`.trim();
  return name || learner.email || "Unknown";
}

const fieldClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3B883E] focus:ring-1 focus:ring-[#3B883E]/30";
const smallFieldClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#3B883E] focus:ring-1 focus:ring-[#3B883E]/30";

export function ScenarioManagementPage({ variant }: ScenarioManagementPageProps) {
  const [form, setForm] = useState(emptyForm());
  const [slideDeck, setSlideDeck] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [displayData, setDisplayData] = useState("");
  const [studentHint, setStudentHint] = useState("");
  const [phases, setPhases] = useState<PhaseFormState[]>([]);
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>([]);
  const [learnerSearch, setLearnerSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(true);
  const [listExpanded, setListExpanded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const filteredLearners = useMemo(() => {
    const q = learnerSearch.trim().toLowerCase();
    if (!q) return learners;
    return learners.filter((learner: { firstName?: string; lastName?: string; email?: string }) => {
      const name = learnerDisplayName(learner).toLowerCase();
      const email = (learner.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [learners, learnerSearch]);

  const set = (field: keyof ReturnType<typeof emptyForm>, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleToggleLearner = (learnerId: string) => {
    setSelectedLearnerIds((prev) =>
      prev.includes(learnerId) ? prev.filter((id) => id !== learnerId) : [...prev, learnerId],
    );
  };

  const handleSelectAllFiltered = () => {
    const ids = filteredLearners.map((l: { _id: string }) => l._id);
    const allSelected = ids.length > 0 && ids.every((id: string) => selectedLearnerIds.includes(id));
    if (allSelected) {
      setSelectedLearnerIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedLearnerIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  // ─── Slide deck extraction (preview / pre-fill) ────────────────────────────

  const canExtract = Boolean(slideDeck) && Boolean(form.studentCharacterName.trim());

  const handleExtract = async () => {
    if (!slideDeck) return;
    if (!form.studentCharacterName.trim()) {
      toast.error("Enter the student character name first");
      return;
    }

    setExtracting(true);
    try {
      const extractFormData = new FormData();
      extractFormData.append("file", slideDeck);
      extractFormData.append("studentCharacterName", form.studentCharacterName.trim());

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

      setDisplayData(result.displayData ?? "");
      setStudentHint(result.studentHint ?? "");
      setPhases(
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

  // ─── Phases editor ──────────────────────────────────────────────────────────

  const addPhase = () => setPhases((prev) => [...prev, emptyPhase()]);

  const removePhase = (phaseIndex: number) =>
    setPhases((prev) => prev.filter((_, i) => i !== phaseIndex));

  const updatePhaseField = (
    phaseIndex: number,
    field: "phaseName" | "triggerCondition",
    value: string,
  ) =>
    setPhases((prev) => prev.map((p, i) => (i === phaseIndex ? { ...p, [field]: value } : p)));

  const setPhaseCharacterInput = (phaseIndex: number, value: string) =>
    setPhases((prev) => prev.map((p, i) => (i === phaseIndex ? { ...p, characterInput: value } : p)));

  const addPhaseCharacter = (phaseIndex: number) =>
    setPhases((prev) =>
      prev.map((p, i) => {
        if (i !== phaseIndex) return p;
        const value = p.characterInput.trim();
        if (!value || p.characters.includes(value)) return { ...p, characterInput: "" };
        return { ...p, characters: [...p.characters, value], characterInput: "" };
      }),
    );

  const removePhaseCharacter = (phaseIndex: number, character: string) =>
    setPhases((prev) =>
      prev.map((p, i) =>
        i === phaseIndex ? { ...p, characters: p.characters.filter((c) => c !== character) } : p,
      ),
    );

  const handlePhaseCharacterKeyDown = (
    phaseIndex: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addPhaseCharacter(phaseIndex);
    }
  };

  const addBeat = (phaseIndex: number) =>
    setPhases((prev) =>
      prev.map((p, i) =>
        i === phaseIndex
          ? {
              ...p,
              conversationBeats: [
                ...p.conversationBeats,
                { character: "", intent: "", triggerCondition: "" },
              ],
            }
          : p,
      ),
    );

  const removeBeat = (phaseIndex: number, beatIndex: number) =>
    setPhases((prev) =>
      prev.map((p, i) =>
        i === phaseIndex
          ? { ...p, conversationBeats: p.conversationBeats.filter((_, bi) => bi !== beatIndex) }
          : p,
      ),
    );

  const updateBeatField = (
    phaseIndex: number,
    beatIndex: number,
    field: "character" | "intent" | "triggerCondition",
    value: string,
  ) =>
    setPhases((prev) =>
      prev.map((p, i) =>
        i === phaseIndex
          ? {
              ...p,
              conversationBeats: p.conversationBeats.map((b, bi) =>
                bi === beatIndex ? { ...b, [field]: value } : b,
              ),
            }
          : p,
      ),
    );

  const addFinding = (phaseIndex: number) =>
    setPhases((prev) =>
      prev.map((p, i) =>
        i === phaseIndex
          ? { ...p, gatedFindings: [...p.gatedFindings, { label: "", data: "", revealCondition: "" }] }
          : p,
      ),
    );

  const removeFinding = (phaseIndex: number, findingIndex: number) =>
    setPhases((prev) =>
      prev.map((p, i) =>
        i === phaseIndex
          ? { ...p, gatedFindings: p.gatedFindings.filter((_, fi) => fi !== findingIndex) }
          : p,
      ),
    );

  const updateFindingField = (
    phaseIndex: number,
    findingIndex: number,
    field: "label" | "data" | "revealCondition",
    value: string,
  ) =>
    setPhases((prev) =>
      prev.map((p, i) =>
        i === phaseIndex
          ? {
              ...p,
              gatedFindings: p.gatedFindings.map((f, fi) =>
                fi === findingIndex ? { ...f, [field]: value } : f,
              ),
            }
          : p,
      ),
    );

  // ─── Submit ─────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm(emptyForm());
    setSlideDeck(null);
    setDisplayData("");
    setStudentHint("");
    setPhases([]);
    setSelectedLearnerIds([]);
    setLearnerSearch("");
  };

  const validate = (): string | null => {
    if (!form.title.trim()) return "Title is required";
    if (!form.workplaceSetting.trim()) return "Workplace setting is required";
    if (!form.studentCharacterName.trim()) return "Student character name is required";
    if (!form.dramatisationPrompt.trim()) return "Dramatisation prompt is required";
    if (!form.topicId) return "Select a topic";
    if (!displayData.trim()) return "Background / Briefing is required";
    if (!form.gradingRubric.trim()) return "Grading rubric is required";
    if (phases.length === 0) return "Add at least one phase";
    const hasValidPhase = phases.some((p) => p.phaseName.trim() && p.characters.length > 0);
    if (!hasValidPhase) return "Add at least one phase with a name and at least one AI-voiced character";
    if (selectedLearnerIds.length === 0) return "Select at least one learner";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      if (slideDeck) formData.append("file", slideDeck);
      formData.append("title", form.title.trim());
      formData.append("workplaceSetting", form.workplaceSetting.trim());
      formData.append("studentCharacterName", form.studentCharacterName.trim());
      formData.append("dramatisationPrompt", form.dramatisationPrompt.trim());
      formData.append("topicId", form.topicId);
      formData.append("gradingRubric", form.gradingRubric.trim());
      formData.append("maxDurationMinutes", form.maxDurationMinutes);
      formData.append("displayData", displayData.trim());
      formData.append("studentHint", studentHint.trim());
      formData.append(
        "scenarioScript",
        JSON.stringify(
          phases.map(({ characterInput: _characterInput, ...phase }) => phase),
        ),
      );
      for (const learnerId of selectedLearnerIds) {
        formData.append("assignedLearnerIds", learnerId);
      }

      const res = await fetch("/api/v1/admin/simulation/scenarios", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to create scenario");

      toast.success("Scenario created");
      resetForm();
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
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. Handover to Night Shift After a Fall"
                  className={fieldClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Workplace Setting <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.workplaceSetting}
                  onChange={(e) => set("workplaceSetting", e.target.value)}
                  placeholder="e.g. Medical-surgical inpatient ward"
                  className={fieldClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Student Character Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.studentCharacterName}
                  onChange={(e) => set("studentCharacterName", e.target.value)}
                  placeholder="e.g. Nurse Sunju"
                  className={fieldClass}
                />
              </div>

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
                {slideDeck && !form.studentCharacterName.trim() && (
                  <p className="text-xs text-amber-600">
                    Enter the student character name above first
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Dramatisation Prompt <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.dramatisationPrompt}
                  onChange={(e) => set("dramatisationPrompt", e.target.value)}
                  rows={4}
                  placeholder="Describe how the AI character(s) should play out this scenario"
                  className={`resize-y ${fieldClass}`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Background / Briefing <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500">
                  What the learner hears at the start of the session — presenting situation, baseline vitals, handoff info.
                </p>
                <textarea
                  value={displayData}
                  onChange={(e) => setDisplayData(e.target.value)}
                  rows={4}
                  placeholder="Read aloud by an AI voice at the start of the session"
                  className={`resize-y ${fieldClass}`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Vitals / Clinical Info</label>
                <p className="text-xs text-gray-500">
                  Optional on-demand hint content shown to the student only if they choose to look it up — not shown automatically.
                </p>
                <textarea
                  value={studentHint}
                  onChange={(e) => setStudentHint(e.target.value)}
                  rows={3}
                  placeholder="Reference material the learner can look up during the session"
                  className={`resize-y ${fieldClass}`}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Phases <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={addPhase}
                    className="flex items-center gap-1 text-xs font-medium text-[#3B883E] hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add phase
                  </button>
                </div>

                {phases.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No phases yet. Add one, or extract from a slide deck above.
                  </p>
                )}

                <div className="space-y-4">
                  {phases.map((phase, phaseIndex) => (
                    <div key={phaseIndex} className="space-y-4 rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Phase {phaseIndex + 1}
                        </p>
                        <button
                          type="button"
                          onClick={() => removePhase(phaseIndex)}
                          aria-label={`Remove phase ${phaseIndex + 1}`}
                          className="rounded-lg p-1.5 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-700">Phase Name</label>
                          <input
                            type="text"
                            value={phase.phaseName}
                            onChange={(e) => updatePhaseField(phaseIndex, "phaseName", e.target.value)}
                            placeholder="e.g. Initial Assessment"
                            className={smallFieldClass}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-700">
                            Ends When / Trigger Condition
                          </label>
                          <input
                            type="text"
                            value={phase.triggerCondition}
                            onChange={(e) =>
                              updatePhaseField(phaseIndex, "triggerCondition", e.target.value)
                            }
                            placeholder="e.g. Learner escalates to the charge nurse"
                            className={smallFieldClass}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-700">AI-Voiced Characters</label>
                        <input
                          type="text"
                          value={phase.characterInput}
                          onChange={(e) => setPhaseCharacterInput(phaseIndex, e.target.value)}
                          onKeyDown={(e) => handlePhaseCharacterKeyDown(phaseIndex, e)}
                          placeholder="Type a character name and press Enter"
                          className={smallFieldClass}
                        />
                        {phase.characters.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {phase.characters.map((character) => (
                              <span
                                key={character}
                                className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-[#3B883E]"
                              >
                                {character}
                                <button
                                  type="button"
                                  onClick={() => removePhaseCharacter(phaseIndex, character)}
                                  aria-label={`Remove ${character}`}
                                  className="text-[#3B883E]/70 hover:text-[#3B883E]"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-gray-700">Conversation Beats</label>
                          <button
                            type="button"
                            onClick={() => addBeat(phaseIndex)}
                            className="flex items-center gap-1 text-xs font-medium text-[#3B883E] hover:underline"
                          >
                            <Plus className="h-3 w-3" />
                            Add beat
                          </button>
                        </div>
                        {phase.conversationBeats.length === 0 && (
                          <p className="text-xs text-gray-500">No conversation beats yet</p>
                        )}
                        <div className="space-y-2">
                          {phase.conversationBeats.map((beat, beatIndex) => (
                            <div
                              key={beatIndex}
                              className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
                            >
                              <input
                                type="text"
                                value={beat.character}
                                onChange={(e) =>
                                  updateBeatField(phaseIndex, beatIndex, "character", e.target.value)
                                }
                                placeholder="Character"
                                className={smallFieldClass}
                              />
                              <input
                                type="text"
                                value={beat.intent}
                                onChange={(e) =>
                                  updateBeatField(phaseIndex, beatIndex, "intent", e.target.value)
                                }
                                placeholder="Intent"
                                className={smallFieldClass}
                              />
                              <input
                                type="text"
                                value={beat.triggerCondition}
                                onChange={(e) =>
                                  updateBeatField(phaseIndex, beatIndex, "triggerCondition", e.target.value)
                                }
                                placeholder="Trigger condition"
                                className={smallFieldClass}
                              />
                              <button
                                type="button"
                                onClick={() => removeBeat(phaseIndex, beatIndex)}
                                aria-label="Remove conversation beat"
                                className="shrink-0 rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-gray-700">Gated Findings</label>
                          <button
                            type="button"
                            onClick={() => addFinding(phaseIndex)}
                            className="flex items-center gap-1 text-xs font-medium text-[#3B883E] hover:underline"
                          >
                            <Plus className="h-3 w-3" />
                            Add finding
                          </button>
                        </div>
                        {phase.gatedFindings.length === 0 && (
                          <p className="text-xs text-gray-500">No gated findings yet</p>
                        )}
                        <div className="space-y-2">
                          {phase.gatedFindings.map((finding, findingIndex) => (
                            <div
                              key={findingIndex}
                              className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
                            >
                              <input
                                type="text"
                                value={finding.label}
                                onChange={(e) =>
                                  updateFindingField(phaseIndex, findingIndex, "label", e.target.value)
                                }
                                placeholder="Label"
                                className={smallFieldClass}
                              />
                              <input
                                type="text"
                                value={finding.data}
                                onChange={(e) =>
                                  updateFindingField(phaseIndex, findingIndex, "data", e.target.value)
                                }
                                placeholder="Data"
                                className={smallFieldClass}
                              />
                              <input
                                type="text"
                                value={finding.revealCondition}
                                onChange={(e) =>
                                  updateFindingField(
                                    phaseIndex,
                                    findingIndex,
                                    "revealCondition",
                                    e.target.value,
                                  )
                                }
                                placeholder="Reveal condition"
                                className={smallFieldClass}
                              />
                              <button
                                type="button"
                                onClick={() => removeFinding(phaseIndex, findingIndex)}
                                aria-label="Remove gated finding"
                                className="shrink-0 rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Topic <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.topicId}
                  onChange={(e) => set("topicId", e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select a topic…</option>
                  {Object.entries(COMPETENCY_FRAMEWORK).map(([id, { topic }]) => (
                    <option key={id} value={id}>
                      {topic}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Determines the competencies this scenario is graded against.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Grading Rubric <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.gradingRubric}
                  onChange={(e) => set("gradingRubric", e.target.value)}
                  rows={8}
                  placeholder="Describe the competencies to grade and what counts as exceeds / meets / fails"
                  className={`resize-y ${fieldClass}`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Max Duration (minutes) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.maxDurationMinutes}
                  onChange={(e) => set("maxDurationMinutes", e.target.value)}
                  className={fieldClass}
                />
              </div>

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
          <div className="flex max-h-[calc(100vh-3rem)] flex-col rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Users className="h-4 w-4 text-[#3B883E]" />
                Who can access <span className="text-red-500">*</span>
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Select the learners who can practise this scenario
              </p>
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
                onClick={handleSelectAllFiltered}
                className="text-xs font-medium text-[#3B883E] hover:underline"
              >
                {filteredLearners.length > 0 &&
                filteredLearners.every((l: { _id: string }) => selectedLearnerIds.includes(l._id))
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
                  {filteredLearners.map((learner: { _id: string; firstName?: string; lastName?: string; email?: string }) => {
                    const isSelected = selectedLearnerIds.includes(learner._id);
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
                            onChange={() => handleToggleLearner(learner._id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900">{name}</p>
                            {learner.email && (
                              <p className="truncate text-xs text-gray-500">{learner.email}</p>
                            )}
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
    </div>
  );
}
