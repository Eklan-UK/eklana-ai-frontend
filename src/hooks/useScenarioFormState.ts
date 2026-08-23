import { useState } from "react";
import {
  emptyForm,
  emptyHint,
  emptyPhase,
  learnerDisplayName,
  type ConversationBeatFormState,
  type HintFormState,
  type PhaseFormState,
  type ScenarioFormValues,
} from "@/components/simulation/scenario-form-shared";

export interface ScenarioFormInitialValues {
  form: ScenarioFormValues;
  background: string;
  patientInformation: string;
  phases: PhaseFormState[];
  hints: HintFormState[];
  selectedLearnerIds: string[];
}

// Shared state + handlers behind the scenario create/edit forms — both call
// sites (creation form, edit form) need the identical field/phase/hint/learner
// editing behavior, just seeded with different initial values.
export function useScenarioFormState(initial?: ScenarioFormInitialValues) {
  const [form, setFormState] = useState<ScenarioFormValues>(initial?.form ?? emptyForm());
  const [background, setBackground] = useState(initial?.background ?? "");
  const [patientInformation, setPatientInformation] = useState(initial?.patientInformation ?? "");
  const [phases, setPhases] = useState<PhaseFormState[]>(initial?.phases ?? []);
  const [hints, setHints] = useState<HintFormState[]>(initial?.hints ?? []);
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>(
    initial?.selectedLearnerIds ?? [],
  );
  const [learnerSearch, setLearnerSearch] = useState("");

  const set = (field: keyof ScenarioFormValues, value: string) =>
    setFormState((f) => ({ ...f, [field]: value }));

  const resetForm = (values?: ScenarioFormInitialValues) => {
    setFormState(values?.form ?? emptyForm());
    setBackground(values?.background ?? "");
    setPatientInformation(values?.patientInformation ?? "");
    setPhases(values?.phases ?? []);
    setHints(values?.hints ?? []);
    setSelectedLearnerIds(values?.selectedLearnerIds ?? []);
    setLearnerSearch("");
  };

  const handleToggleLearner = (learnerId: string) => {
    setSelectedLearnerIds((prev) =>
      prev.includes(learnerId) ? prev.filter((id) => id !== learnerId) : [...prev, learnerId],
    );
  };

  const filterLearners = <T extends { firstName?: string; lastName?: string; email?: string }>(
    learners: T[],
  ) => {
    const q = learnerSearch.trim().toLowerCase();
    if (!q) return learners;
    return learners.filter((learner) => {
      const name = learnerDisplayName(learner).toLowerCase();
      const email = (learner.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  };

  const handleSelectAllFiltered = (filteredIds: string[]) => {
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedLearnerIds.includes(id));
    if (allSelected) {
      setSelectedLearnerIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedLearnerIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  // ─── Phases editor ──────────────────────────────────────────────────────

  const addPhase = () => setPhases((prev) => [...prev, emptyPhase()]);

  const removePhase = (phaseIndex: number) =>
    setPhases((prev) => prev.filter((_, i) => i !== phaseIndex));

  const updatePhaseField = (
    phaseIndex: number,
    field: "phaseTitle" | "situation" | "clinicalInformation" | "triggerCondition",
    value: string,
  ) => setPhases((prev) => prev.map((p, i) => (i === phaseIndex ? { ...p, [field]: value } : p)));

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
    field: keyof ConversationBeatFormState,
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

  // ─── Hints editor ────────────────────────────────────────────────────────
  // A carousel of { phaseTitle, hintText } entries — multiple hints per phase
  // title are allowed, so this is a flat list, not keyed by phase.

  const addHint = () => setHints((prev) => [...prev, emptyHint()]);

  const removeHint = (hintIndex: number) =>
    setHints((prev) => prev.filter((_, i) => i !== hintIndex));

  const updateHintField = (hintIndex: number, field: keyof HintFormState, value: string) =>
    setHints((prev) => prev.map((h, i) => (i === hintIndex ? { ...h, [field]: value } : h)));

  return {
    form,
    set,
    background,
    setBackground,
    patientInformation,
    setPatientInformation,
    phases,
    setPhases,
    hints,
    setHints,
    selectedLearnerIds,
    setSelectedLearnerIds,
    learnerSearch,
    setLearnerSearch,
    resetForm,
    handleToggleLearner,
    filterLearners,
    handleSelectAllFiltered,
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
    addHint,
    removeHint,
    updateHintField,
  };
}

export type ScenarioFormState = ReturnType<typeof useScenarioFormState>;
