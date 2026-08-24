export interface PhaseFormState {
  phaseTitle: string;
  situation: string;
  clinicalInformation: string;
  triggerCondition: string;
  characters: string[];
  characterInput: string;
  dramatisationPrompt: string;
}

export interface HintFormState {
  phaseTitle: string;
  hintText: string;
}

export interface ScenarioFormValues {
  workplaceSetting: string;
  studentCharacterName: string;
  gradingRubric: string;
  maxDurationMinutes: string;
  topicId: string;
}

export const emptyPhase = (): PhaseFormState => ({
  phaseTitle: "",
  situation: "",
  clinicalInformation: "",
  triggerCondition: "",
  characters: [],
  characterInput: "",
  dramatisationPrompt: "",
});

export const emptyHint = (): HintFormState => ({
  phaseTitle: "",
  hintText: "",
});

export const emptyForm = (): ScenarioFormValues => ({
  workplaceSetting: "",
  studentCharacterName: "",
  gradingRubric: "",
  maxDurationMinutes: "15",
  topicId: "",
});

export function learnerDisplayName(learner: { firstName?: string; lastName?: string; email?: string }) {
  const name = `${learner.firstName ?? ""} ${learner.lastName ?? ""}`.trim();
  return name || learner.email || "Unknown";
}

export const fieldClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3B883E] focus:ring-1 focus:ring-[#3B883E]/30";
export const smallFieldClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#3B883E] focus:ring-1 focus:ring-[#3B883E]/30";

export function validateScenarioForm(
  form: ScenarioFormValues,
  background: string,
  patientInformation: string,
  phases: PhaseFormState[],
  hints: HintFormState[],
  selectedLearnerIds: string[],
): string | null {
  if (!form.workplaceSetting.trim()) return "Workplace setting is required";
  if (!form.studentCharacterName.trim()) return "Student character name is required";
  if (!form.topicId) return "Select a topic";
  if (!background.trim()) return "Background is required";
  if (!patientInformation.trim()) return "Patient information is required";
  if (!form.gradingRubric.trim()) return "Grading rubric is required";
  if (phases.length === 0) return "Add at least one phase";
  const hasValidPhase = phases.some(
    (p) =>
      p.phaseTitle.trim() &&
      p.situation.trim() &&
      p.clinicalInformation.trim() &&
      p.characters.length > 0 &&
      p.dramatisationPrompt.trim(),
  );
  if (!hasValidPhase) {
    return "Add at least one phase with a title, situation, clinical information, at least one AI-voiced character, and a dramatisation prompt";
  }
  const hasIncompleteHint = hints.some((h) => !h.phaseTitle.trim() || !h.hintText.trim());
  if (hasIncompleteHint) return "Each hint needs a phase and hint text";
  if (selectedLearnerIds.length === 0) return "Select at least one learner";
  return null;
}

export function buildScenarioFormData(
  form: ScenarioFormValues,
  background: string,
  patientInformation: string,
  phases: PhaseFormState[],
  hints: HintFormState[],
  selectedLearnerIds: string[],
): FormData {
  const formData = new FormData();
  formData.append("workplaceSetting", form.workplaceSetting.trim());
  formData.append("studentCharacterName", form.studentCharacterName.trim());
  formData.append("topicId", form.topicId);
  formData.append("gradingRubric", form.gradingRubric.trim());
  formData.append("maxDurationMinutes", form.maxDurationMinutes);
  formData.append("background", background.trim());
  formData.append("patientInformation", patientInformation.trim());
  formData.append(
    "scenarioScript",
    JSON.stringify(phases.map(({ characterInput: _characterInput, ...phase }) => phase)),
  );
  formData.append("hints", JSON.stringify(hints));
  for (const learnerId of selectedLearnerIds) {
    formData.append("assignedLearnerIds", learnerId);
  }
  return formData;
}
