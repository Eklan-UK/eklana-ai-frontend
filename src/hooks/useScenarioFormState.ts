import { useState } from "react";
import {
  emptyForm,
  emptyPhase,
  learnerDisplayName,
  type ConversationBeatFormState,
  type GatedFindingFormState,
  type PhaseFormState,
  type ScenarioFormValues,
} from "@/components/simulation/scenario-form-shared";

export interface ScenarioFormInitialValues {
  form: ScenarioFormValues;
  displayData: string;
  studentHint: string;
  phases: PhaseFormState[];
  selectedLearnerIds: string[];
}

// Shared state + handlers behind the scenario create/edit forms — both call
// sites (creation form, edit form) need the identical field/phase/learner
// editing behavior, just seeded with different initial values.
export function useScenarioFormState(initial?: ScenarioFormInitialValues) {
  const [form, setFormState] = useState<ScenarioFormValues>(initial?.form ?? emptyForm());
  const [displayData, setDisplayData] = useState(initial?.displayData ?? "");
  const [studentHint, setStudentHint] = useState(initial?.studentHint ?? "");
  const [phases, setPhases] = useState<PhaseFormState[]>(initial?.phases ?? []);
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>(
    initial?.selectedLearnerIds ?? [],
  );
  const [learnerSearch, setLearnerSearch] = useState("");

  const set = (field: keyof ScenarioFormValues, value: string) =>
    setFormState((f) => ({ ...f, [field]: value }));

  const resetForm = (values?: ScenarioFormInitialValues) => {
    setFormState(values?.form ?? emptyForm());
    setDisplayData(values?.displayData ?? "");
    setStudentHint(values?.studentHint ?? "");
    setPhases(values?.phases ?? []);
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
    field: "phaseName" | "triggerCondition",
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
    field: keyof GatedFindingFormState,
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

  return {
    form,
    set,
    displayData,
    setDisplayData,
    studentHint,
    setStudentHint,
    phases,
    setPhases,
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
    addFinding,
    removeFinding,
    updateFindingField,
  };
}

export type ScenarioFormState = ReturnType<typeof useScenarioFormState>;
