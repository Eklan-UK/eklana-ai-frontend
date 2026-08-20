"use client";

import type { ReactNode } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { COMPETENCY_FRAMEWORK } from "@/config/competency-framework";
import { fieldClass, smallFieldClass } from "@/components/simulation/scenario-form-shared";
import type { ScenarioFormState } from "@/hooks/useScenarioFormState";

interface ScenarioFormFieldsProps {
  formState: ScenarioFormState;
  /** Injected between "Student Character Name" and "Dramatisation Prompt" — the create form's slide-deck upload/extract UI. Omit for the edit form, which doesn't touch the upload flow. */
  slideDeckSection?: ReactNode;
}

// Shared field set for both the creation and edit scenario forms — everything
// except the slide-deck upload (create-only) and the submit button (each
// form wires its own submit behavior).
export function ScenarioFormFields({ formState, slideDeckSection }: ScenarioFormFieldsProps) {
  const {
    form,
    set,
    displayData,
    setDisplayData,
    studentHint,
    setStudentHint,
    phases,
    addPhase,
    removePhase,
    updatePhaseField,
    setPhaseCharacterInput,
    addPhaseCharacter,
    removePhaseCharacter,
    handlePhaseCharacterKeyDown,
    addBeat,
    removeBeat,
    updateBeatField,
    addFinding,
    removeFinding,
    updateFindingField,
  } = formState;

  return (
    <>
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

      {slideDeckSection}

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
                    onChange={(e) => updatePhaseField(phaseIndex, "triggerCondition", e.target.value)}
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
                        onChange={(e) => updateBeatField(phaseIndex, beatIndex, "character", e.target.value)}
                        placeholder="Character"
                        className={smallFieldClass}
                      />
                      <input
                        type="text"
                        value={beat.intent}
                        onChange={(e) => updateBeatField(phaseIndex, beatIndex, "intent", e.target.value)}
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
                        onChange={(e) => updateFindingField(phaseIndex, findingIndex, "label", e.target.value)}
                        placeholder="Label"
                        className={smallFieldClass}
                      />
                      <input
                        type="text"
                        value={finding.data}
                        onChange={(e) => updateFindingField(phaseIndex, findingIndex, "data", e.target.value)}
                        placeholder="Data"
                        className={smallFieldClass}
                      />
                      <input
                        type="text"
                        value={finding.revealCondition}
                        onChange={(e) =>
                          updateFindingField(phaseIndex, findingIndex, "revealCondition", e.target.value)
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
        <select value={form.topicId} onChange={(e) => set("topicId", e.target.value)} className={fieldClass}>
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
    </>
  );
}
