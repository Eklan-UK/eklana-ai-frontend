import type { LearningJourneyPartId } from "@/domain/learning-journey/learning-journey.catalog";

export interface VocabularyItem {
  word?: string;
  wordTranslation?: string;
  text: string;
  translation?: string;
}

export interface PronunciationItem {
  sound: string;
  word: string;
  sentence: string;
}

export interface MatchingPair {
  left: string;
  right: string;
  leftTranslation?: string;
  rightTranslation?: string;
}

export interface GrammarItem {
  pattern: string;
  hint?: string;
  example: string;
}

export interface SentenceWritingItem {
  word: string;
  hint?: string;
}

export interface RoleplayScene {
  scene_name: string;
  context?: string;
  dialogue: Array<{
    speaker: string;
    text: string;
    translation?: string;
  }>;
}

export interface FillBlankItem {
  context?: string;
  sentence: string;
  blanks: Array<{
    position: number;
    correctAnswer: string;
    options: string[];
    hint?: string;
  }>;
  translation?: string;
}

export interface KeyPhraseItem {
  context?: string;
  prompt: string;
  respondentName?: string;
  options: string[];
  correctAnswer: string;
}

export interface DrillDraft {
  vocabularyItems: VocabularyItem[];
  pronunciationItems: PronunciationItem[];
  studentCharacterName: string;
  aiCharacterNames: string[];
  /** Parallel to aiCharacterNames; empty = drill-level ttsVoiceKey / default */
  aiCharacterVoiceKeys: string[];
  /** Parallel to aiCharacterNames; empty = Bot/initials fallback in roleplay UI */
  aiCharacterAvatars: string[];
  drillIntro: string;
  roleplayScenes: RoleplayScene[];
  matchingPairs: MatchingPair[];
  grammarItems: GrammarItem[];
  sentenceWritingItems: SentenceWritingItem[];
  articleTitle: string;
  articleContent: string;
  listeningTitle: string;
  listeningContent: string;
  fillBlankItems: FillBlankItem[];
  keyPhraseItems: KeyPhraseItem[];
  drillTitle: string;
  drillType: string;
  difficulty: string;
  completionDate: string;
  durationDays: number;
  context: string;
  audioExampleUrl: string;
  /** Accent/gender key for ElevenLabs; empty = env default voice */
  ttsVoiceKey: string;
  selectedUsers: string[];
  generateTTSAudio: boolean;
  journeyPart: LearningJourneyPartId | "";
  journeyTopic: string;
}

export function getDefaultCompletionDate(): string {
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 7);
  const y = defaultDate.getFullYear();
  const m = String(defaultDate.getMonth() + 1).padStart(2, "0");
  const day = String(defaultDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getDefaultDrillDraft(overrides?: Partial<DrillDraft>): DrillDraft {
  return {
    vocabularyItems: [
      { word: "", wordTranslation: "", text: "", translation: "" },
    ],
    pronunciationItems: [{ sound: "", word: "", sentence: "" }],
    studentCharacterName: "",
    aiCharacterNames: [""],
    aiCharacterVoiceKeys: [""],
    aiCharacterAvatars: [""],
    drillIntro: "",
    roleplayScenes: [
      {
        scene_name: "Scene 1",
        context: "",
        dialogue: [
          { speaker: "ai_0", text: "", translation: "" },
          { speaker: "student", text: "", translation: "" },
        ],
      },
    ],
    matchingPairs: [
      { left: "", right: "", leftTranslation: "", rightTranslation: "" },
    ],
    grammarItems: [{ pattern: "", hint: "", example: "" }],
    sentenceWritingItems: [{ word: "", hint: "" }],
    articleTitle: "",
    articleContent: "",
    listeningTitle: "",
    listeningContent: "",
    fillBlankItems: [
      {
        context: "",
        sentence: "",
        blanks: [
          {
            position: 0,
            correctAnswer: "",
            options: ["", ""],
            hint: "",
          },
        ],
        translation: "",
      },
    ],
    keyPhraseItems: [
      {
        context: "",
        respondentName: "",
        prompt: "",
        options: ["", ""],
        correctAnswer: "",
      },
    ],
    drillTitle: "",
    drillType: "vocabulary",
    difficulty: "intermediate",
    completionDate: "",
    durationDays: 7,
    context: "",
    audioExampleUrl: "",
    ttsVoiceKey: "",
    selectedUsers: [],
    generateTTSAudio: true,
    journeyPart: "",
    journeyTopic: "",
    ...overrides,
  };
}
