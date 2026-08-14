"use client";

import { useMemo, useState } from "react";
import { Loader2, Users, X, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/Checkbox";
import { FileUploadZone } from "@/components/drills/FileUploadZone";
import { useAllLearners } from "@/hooks/useAdmin";

const emptyForm = () => ({
  title: "",
  workplaceSetting: "",
  studentCharacterName: "",
  dramatisationPrompt: "",
  gradingRubric: "",
  maxDurationMinutes: "15",
});

function learnerDisplayName(learner: { firstName?: string; lastName?: string; email?: string }) {
  const name = `${learner.firstName ?? ""} ${learner.lastName ?? ""}`.trim();
  return name || learner.email || "Unknown";
}

export default function AdminSimulationScenariosPage() {
  const [form, setForm] = useState(emptyForm());
  const [weeklyFocus, setWeeklyFocus] = useState<string[]>([]);
  const [weeklyFocusInput, setWeeklyFocusInput] = useState("");
  const [slideDeck, setSlideDeck] = useState<File | null>(null);
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>([]);
  const [learnerSearch, setLearnerSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: learnersData, isLoading: learnersLoading } = useAllLearners({ limit: 1000 });
  const learners = learnersData?.learners ?? [];

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

  const addWeeklyFocusTag = () => {
    const value = weeklyFocusInput.trim();
    if (!value) return;
    if (!weeklyFocus.includes(value)) {
      setWeeklyFocus((prev) => [...prev, value]);
    }
    setWeeklyFocusInput("");
  };

  const handleWeeklyFocusKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addWeeklyFocusTag();
    }
  };

  const removeWeeklyFocusTag = (tag: string) => {
    setWeeklyFocus((prev) => prev.filter((t) => t !== tag));
  };

  const resetForm = () => {
    setForm(emptyForm());
    setWeeklyFocus([]);
    setWeeklyFocusInput("");
    setSlideDeck(null);
    setSelectedLearnerIds([]);
    setLearnerSearch("");
  };

  const validate = (): string | null => {
    if (!form.title.trim()) return "Title is required";
    if (!form.workplaceSetting.trim()) return "Workplace setting is required";
    if (!form.studentCharacterName.trim()) return "Student character name is required";
    if (!form.dramatisationPrompt.trim()) return "Dramatisation prompt is required";
    if (weeklyFocus.length === 0) return "Add at least one weekly focus area";
    if (!form.gradingRubric.trim()) return "Grading rubric is required";
    if (!slideDeck) return "Upload a slide deck (.pptx)";
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
      formData.append("file", slideDeck as File);
      formData.append("title", form.title.trim());
      formData.append("workplaceSetting", form.workplaceSetting.trim());
      formData.append("studentCharacterName", form.studentCharacterName.trim());
      formData.append("dramatisationPrompt", form.dramatisationPrompt.trim());
      formData.append("weeklyFocus", JSON.stringify(weeklyFocus));
      formData.append("gradingRubric", form.gradingRubric.trim());
      formData.append("maxDurationMinutes", form.maxDurationMinutes);
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to create scenario";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Simulation Room</h1>
        <p className="text-sm text-gray-500">
          Upload a slide deck to create a scenario and assign it to learners
        </p>
      </div>

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
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3B883E] focus:ring-1 focus:ring-[#3B883E]/30"
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
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3B883E] focus:ring-1 focus:ring-[#3B883E]/30"
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
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3B883E] focus:ring-1 focus:ring-[#3B883E]/30"
                  />
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
                    className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3B883E] focus:ring-1 focus:ring-[#3B883E]/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Weekly Focus <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={weeklyFocusInput}
                    onChange={(e) => setWeeklyFocusInput(e.target.value)}
                    onKeyDown={handleWeeklyFocusKeyDown}
                    placeholder="Type a focus area and press Enter"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3B883E] focus:ring-1 focus:ring-[#3B883E]/30"
                  />
                  {weeklyFocus.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {weeklyFocus.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-[#3B883E]"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeWeeklyFocusTag(tag)}
                            aria-label={`Remove ${tag}`}
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
                  <label className="text-sm font-medium text-gray-700">
                    Grading Rubric <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={form.gradingRubric}
                    onChange={(e) => set("gradingRubric", e.target.value)}
                    rows={8}
                    placeholder="Describe the competencies to grade and what counts as exceeds / meets / fails"
                    className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3B883E] focus:ring-1 focus:ring-[#3B883E]/30"
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
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3B883E] focus:ring-1 focus:ring-[#3B883E]/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Slide Deck <span className="text-red-500">*</span>
                  </label>
                  <FileUploadZone
                    acceptedTypes=".pptx"
                    onFileSelect={(file) => setSlideDeck(file)}
                    onRemove={() => setSlideDeck(null)}
                    disabled={submitting}
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
      </div>
    </div>
  );
}
