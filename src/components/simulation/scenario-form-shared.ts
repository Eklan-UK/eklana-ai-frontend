export interface ConversationBeatFormState {
  character: string;
  intent: string;
  triggerCondition: string;
}

export interface GatedFindingFormState {
  label: string;
  data: string;
  revealCondition: string;
}

export interface PhaseFormState {
  phaseName: string;
  triggerCondition: string;
  characters: string[];
  characterInput: string;
  conversationBeats: ConversationBeatFormState[];
  gatedFindings: GatedFindingFormState[];
}

export interface ScenarioFormValues {
  title: string;
  workplaceSetting: string;
  studentCharacterName: string;
  dramatisationPrompt: string;
  gradingRubric: string;
  maxDurationMinutes: string;
  topicId: string;
}

export const emptyPhase = (): PhaseFormState => ({
  phaseName: "",
  triggerCondition: "",
  characters: [],
  characterInput: "",
  conversationBeats: [],
  gatedFindings: [],
});

export const emptyForm = (): ScenarioFormValues => ({
  title: "",
  workplaceSetting: "",
  studentCharacterName: "",
  dramatisationPrompt: "",
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
  displayData: string,
  phases: PhaseFormState[],
  selectedLearnerIds: string[],
): string | null {
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
}

export function buildScenarioFormData(
  form: ScenarioFormValues,
  displayData: string,
  studentHint: string,
  phases: PhaseFormState[],
  selectedLearnerIds: string[],
): FormData {
  const formData = new FormData();
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
    JSON.stringify(phases.map(({ characterInput: _characterInput, ...phase }) => phase)),
  );
  for (const learnerId of selectedLearnerIds) {
    formData.append("assignedLearnerIds", learnerId);
  }
  return formData;
}
