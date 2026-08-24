"use client";

import type { ReactNode } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { COMPETENCY_FRAMEWORK } from "@/config/competency-framework";
import { fieldClass, smallFieldClass } from "@/components/simulation/scenario-form-shared";
import type { ScenarioFormState } from "@/hooks/useScenarioFormState";

interface ScenarioFormFieldsProps {
  formState: ScenarioFormState;
  /** Injected between "Student Character Name" and "Background" — the create form's slide-deck upload/extract UI. Omit for the edit form, which doesn't touch the upload flow. */
  slideDeckSection?: ReactNode;
}

// Shared field set for both the creation and edit scenario forms — everything
// except the slide-deck upload (create-only) and the submit button (each
// form wires its own submit behavior).
export function ScenarioFormFields({ formState, slideDeckSection }: ScenarioFormFieldsProps) {
  const {
    form,
    set,
    background,
    setBackground,
    patientInformation,
    setPatientInformation,
    phases,
    addPhase,
    removePhase,
    updatePhaseField,
    setPhaseCharacterInput,
    addPhaseCharacter,
    removePhaseCharacter,
    handlePhaseCharacterKeyDown,
    hints,
    addHint,
    removeHint,
    updateHintField,
  } = formState;

  const enteredPhaseTitles = Array.from(
    new Set(phases.map((p) => p.phaseTitle.trim()).filter(Boolean)),
  );

  return (
    <>
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
        <label className="text-sm font-medium text-gray-700">
          Dramatisation Prompt <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500">
          Overall direction for how the AI-voiced character(s) should play this scenario across the whole encounter — layered underneath each phase's own dramatisation prompt.
        </p>
        <textarea
          value={form.dramatisationPrompt}
          onChange={(e) => set("dramatisationPrompt", e.target.value)}
          rows={4}
          placeholder="Describe how the AI character(s) should play this scenario overall"
          className={`resize-y ${fieldClass}`}
        />
      </div>

      {slideDeckSection}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">
          Background <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500">
          Shown to the learner once, before Phase 1 — the presenting situation, setting, and handoff context.
        </p>
        <textarea
          value={background}
          onChange={(e) => setBackground(e.target.value)}
          rows={4}
          placeholder="Read aloud by an AI voice at the start of the session"
          className={`resize-y ${fieldClass}`}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">
          Patient Information <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500">
          Shown to the learner once, right after Background — baseline readings, status, or chart data.
        </p>
        <textarea
          value={patientInformation}
          onChange={(e) => setPatientInformation(e.target.value)}
          rows={4}
          placeholder="Read aloud by an AI voice, right after Background"
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
                  <label className="text-xs font-medium text-gray-700">Phase Title</label>
                  <input
                    type="text"
                    value={phase.phaseTitle}
                    onChange={(e) => updatePhaseField(phaseIndex, "phaseTitle", e.target.value)}
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
                    onChange={(e) => updatePhaseField(phaseIndex, "triggerCondition", e.target.value)}
                    placeholder="e.g. Learner escalates to the charge nurse"
                    className={smallFieldClass}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">Situation</label>
                <p className="text-xs text-gray-500">
                  Scene-setting text shown to the student at the start of this phase, before its conversation begins.
                </p>
                <textarea
                  value={phase.situation}
                  onChange={(e) => updatePhaseField(phaseIndex, "situation", e.target.value)}
                  rows={3}
                  placeholder="What's happening / what has changed as this phase begins"
                  className={`resize-y ${smallFieldClass}`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">Clinical Information</label>
                <p className="text-xs text-gray-500">
                  Shown to the student upfront for this phase — not gated or reveal-conditioned.
                </p>
                <textarea
                  value={phase.clinicalInformation}
                  onChange={(e) => updatePhaseField(phaseIndex, "clinicalInformation", e.target.value)}
                  rows={3}
                  placeholder="Readings, updates, or other info relevant to this phase"
                  className={`resize-y ${smallFieldClass}`}
                />
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
                <label className="text-xs font-medium text-gray-700">Dramatisation Prompt</label>
                <p className="text-xs text-gray-500">
                  Direction for how the AI-voiced character(s) should play this phase — sent directly into the live scene instruction.
                </p>
                <textarea
                  value={phase.dramatisationPrompt}
                  onChange={(e) => updatePhaseField(phaseIndex, "dramatisationPrompt", e.target.value)}
                  rows={4}
                  placeholder="Describe how the AI character(s) should play out this phase"
                  className={`resize-y ${smallFieldClass}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Hints</label>
          <button
            type="button"
            onClick={addHint}
            className="flex items-center gap-1 text-xs font-medium text-[#3B883E] hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Add hint
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Optional, on-demand reference material the learner can look up during a specific phase. Add as many as you like — including multiple hints for the same phase.
        </p>

        {hints.length === 0 && <p className="text-sm text-gray-500">No hints yet</p>}

        <div className="space-y-2">
          {hints.map((hint, hintIndex) => (
            <div
              key={hintIndex}
              className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[200px_1fr_auto]"
            >
              <select
                value={hint.phaseTitle}
                onChange={(e) => updateHintField(hintIndex, "phaseTitle", e.target.value)}
                className={smallFieldClass}
              >
                <option value="">Select a phase…</option>
                {enteredPhaseTitles.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={hint.hintText}
                onChange={(e) => updateHintField(hintIndex, "hintText", e.target.value)}
                placeholder="Hint text shown to the learner"
                className={smallFieldClass}
              />
              <button
                type="button"
                onClick={() => removeHint(hintIndex)}
                aria-label="Remove hint"
                className="shrink-0 rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">
          Topic <span className="text-red-500">*</span>
        </label>
        <select value={form.topicId} onChange={(e) => set("topicId", e.target.value)} className={fieldClass}>
          <option value="">Select a topic…</option>
          {Object.entries(COMPETENCY_FRAMEWORK).map(([id, { topic }]) => (
            <option key={id} value={id}>
              {topic}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500">
          Determines the competencies this scenario is graded against. Topic is also the only identifier shown for this scenario elsewhere in the admin UI — there is no separate title.
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
    </>
  );
}
