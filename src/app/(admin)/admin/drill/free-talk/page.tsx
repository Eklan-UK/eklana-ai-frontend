"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Users,
  Check,
  Pencil,
  X,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/Checkbox";
import { useAllLearners } from "@/hooks/useAdmin";
import {
  FREE_TALK_SCENARIO_TYPES,
  FREE_TALK_SCENARIO_TYPE_LABELS,
  type FreeTalkScenarioType,
  normalizeFreeTalkScenarioStringList,
  freeTalkStringListToMultiline,
} from "@/models/free-talk-scenario.shared";

interface Scenario {
  _id: string;
  title: string;
  background: string;
  task: string;
  include: string[];
  usefulPhrases: string[];
  scenarioType: FreeTalkScenarioType;
  hint: string;
  allLearners: boolean;
  assignedLearnerIds: string[];
  completionDate: string | null;
  createdAt: string;
}

type ScenarioFormFields = ReturnType<typeof emptyForm>;

type ScenarioDraft = {
  id: string;
  form: ScenarioFormFields;
};

const BADGE_COLORS: Record<FreeTalkScenarioType, string> = {
  icu_emergency: "bg-red-100 text-red-700",
  cpr: "bg-rose-100 text-rose-700",
  patient_follow_up: "bg-indigo-100 text-indigo-700",
  admission: "bg-blue-100 text-blue-700",
  small_talk_patient: "bg-purple-100 text-purple-700",
  handover_receive: "bg-yellow-100 text-yellow-700",
  handover: "bg-amber-100 text-amber-700",
  decline_request: "bg-orange-100 text-orange-700",
  small_talk_colleague: "bg-emerald-100 text-emerald-700",
  phone_doctor: "bg-cyan-100 text-cyan-700",
  doctor_rounds: "bg-teal-100 text-teal-700",
  phone_colleague: "bg-sky-100 text-sky-700",
  phone_department: "bg-violet-100 text-violet-700",
  family_questions: "bg-pink-100 text-pink-700",
  phone_family: "bg-fuchsia-100 text-fuchsia-700",
  discharge: "bg-lime-100 text-lime-700",
  grammar: "bg-slate-100 text-slate-700",
};

const emptyForm = () => ({
  title: "",
  scenarioType: "" as FreeTalkScenarioType | "",
  background: "",
  task: "",
  includeText: "",
  usefulPhrasesText: "",
  hint: "",
  completionDate: "",
});

function newDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function completionDateToInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function formatCompletionDateLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function learnerDisplayName(learner: { firstName?: string; lastName?: string; email?: string }) {
  const name = `${learner.firstName ?? ""} ${learner.lastName ?? ""}`.trim();
  return name || learner.email || "Unknown";
}

export default function AdminFreeTalkPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [drafts, setDrafts] = useState<ScenarioDraft[]>(() => [
    { id: newDraftId(), form: emptyForm() },
  ]);
  const [allLearners, setAllLearners] = useState(true);
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>([]);
  const [learnerSearch, setLearnerSearch] = useState("");

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

  const fetchScenarios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/free-talk/scenarios");
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load scenarios");
      setScenarios((json.data ?? []) as Scenario[]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load scenarios";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchScenarios();
  }, [fetchScenarios]);

  const set = (field: keyof ReturnType<typeof emptyForm>, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }));

  const resetAssignment = () => {
    setAllLearners(true);
    setSelectedLearnerIds([]);
    setLearnerSearch("");
  };

  const resetForm = (options?: { keepAssignment?: boolean }) => {
    setForm(emptyForm());
    setEditingId(null);
    setDrafts([{ id: newDraftId(), form: emptyForm() }]);
    if (!options?.keepAssignment) {
      resetAssignment();
    }
  };

  const addDraft = () => {
    setDrafts((prev) => [...prev, { id: newDraftId(), form: emptyForm() }]);
  };

  const removeDraft = (draftId: string) => {
    setDrafts((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((d) => d.id !== draftId);
    });
  };

  const updateDraftForm = (draftId: string, field: keyof ScenarioFormFields, value: unknown) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === draftId ? { ...d, form: { ...d.form, [field]: value } } : d,
      ),
    );
  };

  const loadScenarioForEdit = (sc: Scenario) => {
    setEditingId(sc._id);
    setExpandedId(sc._id);
    setForm({
      title: sc.title,
      scenarioType: sc.scenarioType,
      background: sc.background,
      task: sc.task,
      includeText: freeTalkStringListToMultiline(sc.include),
      usefulPhrasesText: freeTalkStringListToMultiline(sc.usefulPhrases),
      hint: sc.hint ?? "",
      completionDate: completionDateToInputValue(sc.completionDate),
    });
    setAllLearners(sc.allLearners !== false);
    setSelectedLearnerIds(sc.allLearners === false ? [...sc.assignedLearnerIds] : []);
  };

  const handleToggleLearner = (learnerId: string) => {
    if (allLearners) {
      setAllLearners(false);
    }
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

  const buildPayloadFromFields = (fields: ScenarioFormFields) => {
    const include = normalizeFreeTalkScenarioStringList(fields.includeText);
    const usefulPhrases = normalizeFreeTalkScenarioStringList(fields.usefulPhrasesText);
    return {
      title: fields.title.trim(),
      scenarioType: fields.scenarioType,
      background: fields.background.trim(),
      task: fields.task.trim(),
      include,
      usefulPhrases,
      hint: fields.hint.trim(),
      completionDate: fields.completionDate,
      allLearners,
      assignedLearnerIds: allLearners ? [] : selectedLearnerIds,
    };
  };

  const validateFormFields = (fields: ScenarioFormFields, label?: string) => {
    const prefix = label ? `${label}: ` : "";
    if (!fields.title.trim()) {
      toast.error(`${prefix}Title is required`);
      return false;
    }
    if (!fields.scenarioType) {
      toast.error(`${prefix}Scenario type is required`);
      return false;
    }
    if (!fields.background.trim()) {
      toast.error(`${prefix}Background is required`);
      return false;
    }
    if (!fields.task.trim()) {
      toast.error(`${prefix}Task is required`);
      return false;
    }
    if (!fields.completionDate) {
      toast.error(`${prefix}Completion date is required`);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateFormFields(form)) return;
    if (!allLearners && selectedLearnerIds.length === 0) {
      toast.error("Select at least one learner, or choose Everyone");
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildPayloadFromFields(form);
      const url = editingId
        ? `/api/v1/admin/free-talk/scenarios/${editingId}`
        : "/api/v1/admin/free-talk/scenarios";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to save scenario");
      const saved = json.data as Scenario | undefined;
      const assignLabel = saved
        ? saved.allLearners !== false
          ? "everyone"
          : saved.assignedLearnerIds.length === 1
            ? "1 learner"
            : `${saved.assignedLearnerIds.length} learners`
        : null;
      toast.success(
        editingId
          ? `Scenario updated${assignLabel ? ` (${assignLabel})` : ""}`
          : `Scenario created${assignLabel ? ` for ${assignLabel}` : ""}`,
      );
      if (saved && !editingId) {
        setScenarios((prev) => [saved, ...prev.filter((s) => s._id !== saved._id)]);
      }
      resetForm({ keepAssignment: !editingId });
      await fetchScenarios();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save scenario";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAll = async () => {
    if (!allLearners && selectedLearnerIds.length === 0) {
      toast.error("Select at least one learner, or choose Everyone");
      return;
    }
    for (let i = 0; i < drafts.length; i++) {
      if (!validateFormFields(drafts[i].form, `Scenario ${i + 1}`)) return;
    }

    setSubmitting(true);
    let created = 0;
    try {
      for (const draft of drafts) {
        const res = await fetch("/api/v1/admin/free-talk/scenarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayloadFromFields(draft.form)),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? "Failed to save scenario");
        created += 1;
      }
      toast.success(
        created === 1 ? "Scenario created" : `${created} scenarios created`,
      );
      resetForm({ keepAssignment: true });
      await fetchScenarios();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to create scenarios";
      toast.error(
        created > 0
          ? `${message} (${created} of ${drafts.length} saved)`
          : message,
      );
      if (created > 0) await fetchScenarios();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this scenario? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/admin/free-talk/scenarios/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to delete");
      toast.success("Scenario deleted");
      if (editingId === id) resetForm();
      setScenarios((s) => s.filter((sc) => sc._id !== id));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to delete scenario";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const assignmentSummary = (sc: Scenario) => {
    if (sc.allLearners !== false) return "Everyone";
    const n = sc.assignedLearnerIds?.length ?? 0;
    return n === 1 ? "1 learner" : `${n} learners`;
  };

  return (
    <div className="space-y-8">
      <p className="text-sm text-gray-500">
        Create scenarios and assign them to everyone or selected learners
      </p>

      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* Main column */}
          <div className="space-y-8 min-w-0">
            {editingId ? (
              <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
                  <h2 className="text-base font-semibold text-gray-900">Edit Scenario</h2>
                  <button
                    type="button"
                    onClick={() => resetForm()}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
                  >
                    <X className="h-4 w-4" />
                    Cancel edit
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-sm font-medium text-gray-700">
                        Scenario Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={(e) => set("title", e.target.value)}
                        placeholder="e.g. Worsening Abdominal Pain During the Night"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">
                        Scenario Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.scenarioType}
                        onChange={(e) => set("scenarioType", e.target.value as FreeTalkScenarioType)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
                      >
                        <option value="">Select type…</option>
                        {FREE_TALK_SCENARIO_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {FREE_TALK_SCENARIO_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">
                        Completion Date <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={form.completionDate}
                          onChange={(e) => set("completionDate", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
                        />
                        <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">
                      Background <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={form.background}
                      onChange={(e) => set("background", e.target.value)}
                      rows={4}
                      className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">
                      Task <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={form.task}
                      onChange={(e) => set("task", e.target.value)}
                      rows={2}
                      className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Include</label>
                    <textarea
                      value={form.includeText}
                      onChange={(e) => set("includeText", e.target.value)}
                      rows={4}
                      className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Useful Handover Phrases</label>
                    <textarea
                      value={form.usefulPhrasesText}
                      onChange={(e) => set("usefulPhrasesText", e.target.value)}
                      rows={4}
                      className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">
                      Hint <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <textarea
                      value={form.hint}
                      onChange={(e) => set("hint", e.target.value)}
                      rows={2}
                      className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center gap-2 rounded-xl bg-[#3d8c40] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2f6f32] disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Pencil className="h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </section>
            ) : (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-gray-900">New Scenarios</h2>
                  <p className="text-xs text-gray-500">
                    {drafts.length} draft{drafts.length !== 1 ? "s" : ""} · shared assignment
                  </p>
                </div>

                <div className="space-y-4">
                  {drafts.map((draft, index) => (
                    <div
                      key={draft.id}
                      className="rounded-2xl border border-gray-200 bg-white shadow-sm"
                    >
                      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                        <h3 className="text-sm font-semibold text-gray-800">
                          Scenario {index + 1}
                        </h3>
                        {drafts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeDraft(draft.id)}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                            aria-label={`Remove scenario ${index + 1}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-4 px-5 py-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-sm font-medium text-gray-700">
                              Scenario Title <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={draft.form.title}
                              onChange={(e) => updateDraftForm(draft.id, "title", e.target.value)}
                              placeholder="e.g. Worsening Abdominal Pain During the Night"
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">
                              Scenario Type <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={draft.form.scenarioType}
                              onChange={(e) =>
                                updateDraftForm(
                                  draft.id,
                                  "scenarioType",
                                  e.target.value as FreeTalkScenarioType,
                                )
                              }
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
                            >
                              <option value="">Select type…</option>
                              {FREE_TALK_SCENARIO_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {FREE_TALK_SCENARIO_TYPE_LABELS[t]}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">
                              Completion Date <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type="date"
                                value={draft.form.completionDate}
                                onChange={(e) =>
                                  updateDraftForm(draft.id, "completionDate", e.target.value)
                                }
                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
                              />
                              <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-700">
                            Background <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={draft.form.background}
                            onChange={(e) => updateDraftForm(draft.id, "background", e.target.value)}
                            rows={3}
                            className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-700">
                            Task <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={draft.form.task}
                            onChange={(e) => updateDraftForm(draft.id, "task", e.target.value)}
                            rows={2}
                            className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-700">Include</label>
                          <textarea
                            value={draft.form.includeText}
                            onChange={(e) => updateDraftForm(draft.id, "includeText", e.target.value)}
                            rows={4}
                            className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-700">
                            Useful Handover Phrases
                          </label>
                          <textarea
                            value={draft.form.usefulPhrasesText}
                            onChange={(e) =>
                              updateDraftForm(draft.id, "usefulPhrasesText", e.target.value)
                            }
                            rows={4}
                            className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-700">
                            Hint <span className="font-normal text-gray-400">(optional)</span>
                          </label>
                          <textarea
                            value={draft.form.hint}
                            onChange={(e) => updateDraftForm(draft.id, "hint", e.target.value)}
                            rows={2}
                            className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleCreateAll}
                    disabled={submitting}
                    className="flex items-center gap-2 rounded-xl bg-[#3d8c40] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2f6f32] disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Create {drafts.length === 1 ? "Scenario" : `All (${drafts.length})`}
                      </>
                    )}
                  </button>
                </div>
              </section>
            )}

            {!editingId && (
              <div className="flex justify-center py-2">
                <button
                  type="button"
                  onClick={addDraft}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-[#3d8c40]/40 bg-emerald-50 text-[#3d8c40] shadow-sm transition-colors hover:border-[#3d8c40] hover:bg-emerald-100"
                  aria-label="Add another scenario draft"
                >
                  <Plus className="h-7 w-7" />
                </button>
              </div>
            )}

            <section>
              <h2 className="mb-4 text-base font-semibold text-gray-900">
                Saved Scenarios
                {!loading && (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-[#3d8c40]">
                    {scenarios.length}
                  </span>
                )}
              </h2>

              {loading ? (
                <div className="flex items-center justify-center py-16 text-gray-400">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading scenarios…
                </div>
              ) : scenarios.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-8 py-16 text-center">
                  <MessageSquare className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                  <p className="text-sm font-medium text-gray-500">No scenarios yet</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {scenarios.map((sc) => {
                    const isExpanded = expandedId === sc._id;
                    const isEditing = editingId === sc._id;
                    return (
                      <li
                        key={sc._id}
                        className={`rounded-2xl border bg-white shadow-sm ${
                          isEditing ? "border-[#3d8c40] ring-1 ring-[#3d8c40]/30" : "border-gray-200"
                        }`}
                      >
                        <div className="flex items-center gap-2 px-5 py-4">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : sc._id)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <span
                              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_COLORS[sc.scenarioType]}`}
                            >
                              {FREE_TALK_SCENARIO_TYPE_LABELS[sc.scenarioType]}
                            </span>
                            <span className="truncate text-sm font-semibold text-gray-900">{sc.title}</span>
                            <span className="hidden shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 sm:inline-flex">
                              <Calendar className="h-3 w-3" />
                              {formatCompletionDateLabel(sc.completionDate)}
                            </span>
                            <span className="hidden shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 md:inline-flex">
                              <Users className="h-3 w-3" />
                              {assignmentSummary(sc)}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="ml-auto h-4 w-4 shrink-0 text-gray-400" />
                            ) : (
                              <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-gray-400" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => loadScenarioForEdit(sc)}
                            className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-[#3d8c40]"
                            aria-label="Edit scenario"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(sc._id)}
                            disabled={deletingId === sc._id}
                            className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                            aria-label="Delete scenario"
                          >
                            {deletingId === sc._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="space-y-4 border-t border-gray-100 px-5 pb-5 pt-4 text-sm text-gray-700">
                            <p className="text-xs text-gray-500">
                              <Calendar className="mr-1 inline h-3.5 w-3.5" />
                              Completes:{" "}
                              <strong>{formatCompletionDateLabel(sc.completionDate)}</strong>
                              {" · "}
                              <Users className="mr-1 inline h-3.5 w-3.5" />
                              Assigned to: <strong>{assignmentSummary(sc)}</strong>
                            </p>
                            <div>
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Background
                              </p>
                              <p className="whitespace-pre-wrap leading-relaxed">{sc.background}</p>
                            </div>
                            <div>
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Task</p>
                              <p className="whitespace-pre-wrap leading-relaxed">{sc.task}</p>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Side card: learner assignment */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="flex max-h-[calc(100vh-3rem)] flex-col rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Users className="h-4 w-4 text-[#3d8c40]" />
                  Who can access
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Applies to{" "}
                  {editingId
                    ? "the scenario you are editing"
                    : drafts.length === 1
                      ? "the new scenario"
                      : `all ${drafts.length} drafts`}
                </p>
              </div>

              <div className="space-y-3 border-b border-gray-100 px-5 py-4">
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 transition-colors has-[:checked]:border-[#3d8c40] has-[:checked]:bg-emerald-50/50">
                  <input
                    type="radio"
                    name="assignmentMode"
                    checked={allLearners}
                    onChange={() => {
                      setAllLearners(true);
                      setSelectedLearnerIds([]);
                    }}
                    className="text-[#3d8c40] focus:ring-[#3d8c40]"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Everyone</p>
                    <p className="text-xs text-gray-500">All learners see this scenario</p>
                  </div>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 transition-colors has-[:checked]:border-[#3d8c40] has-[:checked]:bg-emerald-50/50">
                  <input
                    type="radio"
                    name="assignmentMode"
                    checked={!allLearners}
                    onChange={() => setAllLearners(false)}
                    className="text-[#3d8c40] focus:ring-[#3d8c40]"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Selected learners</p>
                    <p className="text-xs text-gray-500">Only checked learners below</p>
                  </div>
                </label>
              </div>

              {!allLearners && (
                <>
                  <div className="space-y-2 px-5 pt-3">
                    <input
                      type="text"
                      value={learnerSearch}
                      onChange={(e) => setLearnerSearch(e.target.value)}
                      placeholder="Search name or email…"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
                    />
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="text-xs font-medium text-[#3d8c40] hover:underline"
                    >
                      {filteredLearners.every((l: { _id: string }) => selectedLearnerIds.includes(l._id))
                        ? "Deselect filtered"
                        : "Select all filtered"}
                    </button>
                    <p className="text-xs text-gray-500">
                      {selectedLearnerIds.length} selected
                    </p>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
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
                                {isSelected && <Check className="h-4 w-4 shrink-0 text-[#3d8c40]" />}
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </>
              )}

              {allLearners && (
                <p className="px-5 py-6 text-center text-sm text-gray-500">
                  This scenario will be visible to every learner.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
