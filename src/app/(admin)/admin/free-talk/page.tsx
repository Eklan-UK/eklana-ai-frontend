"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Loader2, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import {
  FREE_TALK_SCENARIO_TYPES,
  type FreeTalkScenarioType,
  normalizeFreeTalkScenarioStringList,
  freeTalkStringListToMultiline,
} from "@/models/free-talk-scenario.shared";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Scenario {
  _id: string;
  title: string;
  background: string;
  task: string;
  include: string[];
  usefulPhrases: string[];
  scenarioType: FreeTalkScenarioType;
  hint: string;
  createdAt: string;
}

const SCENARIO_TYPE_LABELS: Record<FreeTalkScenarioType, string> = {
  icu_emergency: "ICU Emergency",
  admission: "Admission",
  small_talk_patient: "Small Talk — Patient",
  handover: "Handover",
  decline_request: "Decline Request",
  phone_doctor: "Phone the Doctor",
  small_talk_colleague: "Small Talk — Colleague",
};

const BADGE_COLORS: Record<FreeTalkScenarioType, string> = {
  icu_emergency: "bg-red-100 text-red-700",
  admission: "bg-blue-100 text-blue-700",
  small_talk_patient: "bg-purple-100 text-purple-700",
  handover: "bg-amber-100 text-amber-700",
  decline_request: "bg-orange-100 text-orange-700",
  phone_doctor: "bg-cyan-100 text-cyan-700",
  small_talk_colleague: "bg-emerald-100 text-emerald-700",
};

// ─── Empty form ────────────────────────────────────────────────────────────────

const emptyForm = () => ({
  title: "",
  scenarioType: "" as FreeTalkScenarioType | "",
  background: "",
  task: "",
  includeText: "",
  usefulPhrasesText: "",
  hint: "",
});

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminFreeTalkPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchScenarios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/free-talk/scenarios");
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load scenarios");
      setScenarios(json.data ?? []);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load scenarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchScenarios();
  }, [fetchScenarios]);

  // ── Form helpers ───────────────────────────────────────────────────────────

  const set = (field: keyof ReturnType<typeof emptyForm>, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }));

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (!form.scenarioType) { toast.error("Scenario type is required"); return; }
    if (!form.background.trim()) { toast.error("Background is required"); return; }
    if (!form.task.trim()) { toast.error("Task is required"); return; }

    const include = normalizeFreeTalkScenarioStringList(form.includeText);
    const usefulPhrases = normalizeFreeTalkScenarioStringList(form.usefulPhrasesText);

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/admin/free-talk/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          scenarioType: form.scenarioType,
          background: form.background.trim(),
          task: form.task.trim(),
          include,
          usefulPhrases,
          hint: form.hint.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to create scenario");
      toast.success("Scenario created successfully");
      setForm(emptyForm());
      await fetchScenarios();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create scenario");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this scenario? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/admin/free-talk/scenarios/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to delete");
      toast.success("Scenario deleted");
      setScenarios((s) => s.filter((sc) => sc._id !== id));
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete scenario");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Page header */}
      <div className="border-b border-gray-200 bg-white px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
            <MessageSquare className="h-5 w-5 text-[#3d8c40]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Free Talk Scenarios</h1>
            <p className="text-sm text-gray-500">Create and manage Eklan Free Talk scenarios</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-8 px-8 pt-8">
        {/* ── Create form ── */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-5">
            <h2 className="text-base font-semibold text-gray-900">Create New Scenario</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
            {/* Row: Title + Type */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
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
                      {SCENARIO_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Background */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Background <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-400">Clinical context for the scenario</p>
              <textarea
                value={form.background}
                onChange={(e) => set("background", e.target.value)}
                placeholder="e.g. Sarah Thompson is a 42-year-old patient admitted for gall bladder inflammation and possible acute cholecystitis. During your night shift, her abdominal pain increased suddenly…"
                rows={4}
                className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
              />
            </div>

            {/* Task */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Task <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-400">What the student must say or do</p>
              <textarea
                value={form.task}
                onChange={(e) => set("task", e.target.value)}
                placeholder="e.g. You are handing over Sarah Thompson to the next nurse at shift change."
                rows={2}
                className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
              />
            </div>

            {/* Include */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Include</label>
              <p className="text-xs text-gray-400">
                Paste or type freely (your own bullets, numbers, or paragraphs). Line breaks split into separate
                items for the app; blank lines are ignored.
              </p>
              <textarea
                value={form.includeText}
                onChange={(e) => set("includeText", e.target.value)}
                placeholder={"Her current pain level\nVitals and monitoring\nPending investigations"}
                rows={6}
                className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
              />
            </div>

            {/* Useful Phrases */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Useful Handover Phrases</label>
              <p className="text-xs text-gray-400">
                Paste or type freely. Line breaks split into separate items; blank lines are ignored.
              </p>
              <textarea
                value={form.usefulPhrasesText}
                onChange={(e) => set("usefulPhrasesText", e.target.value)}
                placeholder={`Her pain increased overnight.\nI'd like to hand over Sarah Thompson.`}
                rows={6}
                className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-[#3d8c40] focus:ring-1 focus:ring-[#3d8c40]/30"
              />
            </div>

            {/* Hint (optional) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Hint <span className="text-gray-400 font-normal">(optional)</span></label>
              <p className="text-xs text-gray-400">Shown to the student under "Your Turn". Defaults to Task if left blank.</p>
              <textarea
                value={form.hint}
                onChange={(e) => set("hint", e.target.value)}
                placeholder="Leave blank to use the Task as the hint…"
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

        {/* ── Scenarios list ── */}
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
              <p className="mt-1 text-xs text-gray-400">Create your first scenario using the form above.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {scenarios.map((sc) => {
                const isExpanded = expandedId === sc._id;
                return (
                  <li
                    key={sc._id}
                    className="rounded-2xl border border-gray-200 bg-white shadow-sm"
                  >
                    {/* Header row */}
                    <div className="flex items-center gap-3 px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : sc._id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        aria-expanded={isExpanded}
                      >
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_COLORS[sc.scenarioType]}`}
                        >
                          {SCENARIO_TYPE_LABELS[sc.scenarioType]}
                        </span>
                        <span className="truncate text-sm font-semibold text-gray-900">
                          {sc.title}
                        </span>
                        <span className="ml-auto shrink-0 text-gray-400">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(sc._id)}
                        disabled={deletingId === sc._id}
                        className="ml-2 shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                        aria-label="Delete scenario"
                      >
                        {deletingId === sc._id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4 text-sm text-gray-700">
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Background</p>
                          <p className="whitespace-pre-wrap leading-relaxed">{sc.background}</p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Task</p>
                          <p className="whitespace-pre-wrap leading-relaxed">{sc.task}</p>
                        </div>
                        {sc.include.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Include</p>
                            <p className="whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 leading-relaxed">
                              {freeTalkStringListToMultiline(sc.include)}
                            </p>
                          </div>
                        )}
                        {sc.usefulPhrases.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                              Useful Phrases
                            </p>
                            <p className="whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 leading-relaxed">
                              {freeTalkStringListToMultiline(sc.usefulPhrases)}
                            </p>
                          </div>
                        )}
                        {sc.hint && (
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Hint</p>
                            <p className="leading-relaxed">{sc.hint}</p>
                          </div>
                        )}
                        <p className="text-xs text-gray-400">
                          Created {new Date(sc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
