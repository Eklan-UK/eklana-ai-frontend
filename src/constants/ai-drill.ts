export const AI_PARTS = [
  "Part 1: Communication with Patients",
  "Part 2: Communication with Colleagues",
  "Part 3: Communication with Doctors, Families and Friends",
  "Part 4: Bonus Scenarios",
] as const;

export const AI_TOPICS = [
  "Handling Emergency/Critical Situation",
  "Conducting CPR",
  "Follow-up with Patients",
  "Admitting a Patient",
  "Small Talk with a Patient",
] as const;

export const AI_DRILL_TYPES = [
  { value: "vocabulary", label: "Vocabulary" },
  { value: "pronunciation", label: "Pronunciation" },
  { value: "roleplay", label: "Roleplay" },
  { value: "matching", label: "Matching" },
  { value: "definition", label: "Definition" },
  { value: "grammar", label: "Grammar" },
  { value: "sentence_writing", label: "Sentence Writing" },
  { value: "fill_blank", label: "Fill in the Blank" },
  { value: "key_phrases", label: "Key Phrases" },
  { value: "summary", label: "Summary" },
] as const;

export type AiDrillType = (typeof AI_DRILL_TYPES)[number]["value"];

export const AI_DIFFICULTIES = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;
