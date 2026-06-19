"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import {
  ArrowLeft,
  FileText,
  Plus,
  X,
  Calendar as CalendarIcon,
  ChevronDown,
  Loader2,
  Volume2,
  Search,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { drillAPI } from "@/lib/api";
import { toast } from "sonner";
import { useDrill } from "@/hooks/useDrills";
import { useTutorStudents } from "@/hooks/useTutor";
import { FileUploadZone } from "@/components/drills/FileUploadZone";
import { ContentPreview } from "@/components/drills/ContentPreview";
import { TemplateDownload } from "@/components/drills/TemplateDownload";
import { ClipboardPaste } from "@/components/drills/ClipboardPaste";
import { ParsedContent } from "@/services/document-parser.service";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import {
  generateDrillAudio,
  extractTextsForDrillType,
  applyAudioUrls,
} from "@/services/drill-audio.service";
import { LearningJourneyPartTopicFields } from "@/components/admin/LearningJourneyPartTopicFields";
import {
  isValidPartTopicPair,
  type LearningJourneyPartId,
} from "@/domain/learning-journey/learning-journey.catalog";
import {
  mergeMediaFieldsFromSource,
  normalizeFillBlankItems,
  validateFillBlankItems,
} from "@/utils/drill";

interface Sentence {
  english: string;
  korean: string;
}

interface VocabularyItem {
  word?: string;
  wordTranslation?: string;
  text: string;
  translation?: string;
}

interface PronunciationItem {
  sound: string;
  word: string;
  sentence: string;
}

interface MatchingPair {
  left: string;
  right: string;
  leftTranslation?: string;
  rightTranslation?: string;
}


interface GrammarItem {
  pattern: string;
  hint?: string;
  example: string;
}

interface SentenceWritingItem {
  word: string;
  hint?: string;
}

interface RoleplayScene {
  scene_name: string;
  context?: string;
  dialogue: Array<{
    speaker: string;
    text: string;
    translation?: string;
  }>;
}

interface FillBlankItem {
  sentence: string;
  blanks: Array<{
    position: number;
    correctAnswer: string;
    options: string[];
    hint?: string;
  }>;
  translation?: string;
}

interface KeyPhraseItem {
  prompt: string;
  respondentName?: string;
  options: string[];
  correctAnswer: string;
}

const DRAFT_KEY = "drill_draft";

interface TutorDrillDraft {
  vocabularyItems: VocabularyItem[];
  pronunciationItems: PronunciationItem[];
  studentCharacterName: string;
  aiCharacterNames: string[];
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
  selectedUsers: string[];
  generateTTSAudio: boolean;
  journeyPart: LearningJourneyPartId | "";
  journeyTopic: string;
}

function getDefaultCompletionDate(): string {
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 7);
  return defaultDate.toISOString().split("T")[0];
}

function getDefaultTutorDrillDraft(): TutorDrillDraft {
  return {
    vocabularyItems: [
      { word: "", wordTranslation: "", text: "", translation: "" },
    ],
    pronunciationItems: [{ sound: "", word: "", sentence: "" }],
    studentCharacterName: "",
    aiCharacterNames: [""],
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
      { respondentName: "", prompt: "", options: ["", ""], correctAnswer: "" },
    ],
    drillTitle: "",
    drillType: "vocabulary",
    difficulty: "intermediate",
    completionDate: getDefaultCompletionDate(),
    durationDays: 7,
    context: "",
    audioExampleUrl: "",
    selectedUsers: [],
    generateTTSAudio: true,
    journeyPart: "",
    journeyTopic: "",
  };
}

function CreateDrillPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const drillId = searchParams.get("drillId") || searchParams.get("id");
  const isEditMode = !!drillId;

  // Vocabulary
  const [vocabularyItems, setVocabularyItems] = useState<VocabularyItem[]>([
    { word: "", wordTranslation: "", text: "", translation: "" },
  ]);
  const [pronunciationItems, setPronunciationItems] = useState<
    PronunciationItem[]
  >([{ sound: "", word: "", sentence: "" }]);

  // Roleplay
  const [studentCharacterName, setStudentCharacterName] = useState("");
  const [aiCharacterNames, setAiCharacterNames] = useState<string[]>([""]);
  const [drillIntro, setDrillIntro] = useState("");
  const [roleplayScenes, setRoleplayScenes] = useState<RoleplayScene[]>([
    {
      scene_name: "Scene 1",
      context: "",
      dialogue: [
        { speaker: "ai_0", text: "", translation: "" },
        { speaker: "student", text: "", translation: "" },
      ],
    },
  ]);

  // Matching
  const [matchingPairs, setMatchingPairs] = useState<MatchingPair[]>([
    { left: "", right: "", leftTranslation: "", rightTranslation: "" },
  ]);


  // Grammar
  const [grammarItems, setGrammarItems] = useState<GrammarItem[]>([
    { pattern: "", hint: "", example: "" },
  ]);

  // Sentence Writing
  const [sentenceWritingItems, setSentenceWritingItems] = useState<
    SentenceWritingItem[]
  >([{ word: "", hint: "" }]);

  // Summary
  const [articleTitle, setArticleTitle] = useState("");
  const [articleContent, setArticleContent] = useState("");

  // Listening
  const [listeningTitle, setListeningTitle] = useState("");
  const [listeningContent, setListeningContent] = useState("");

  // Fill Blank
  const [fillBlankItems, setFillBlankItems] = useState<FillBlankItem[]>([
    {
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
  ]);

  // Key Phrases
  const [keyPhraseItems, setKeyPhraseItems] = useState<KeyPhraseItem[]>([
    { respondentName: "", prompt: "", options: ["", ""], correctAnswer: "" },
  ]);

  // Common fields
  const [drillTitle, setDrillTitle] = useState("");
  const [drillType, setDrillType] = useState("vocabulary");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [completionDate, setCompletionDate] = useState("");
  const [durationDays, setDurationDays] = useState(7);
  const [context, setContext] = useState("");
  const [audioExampleUrl, setAudioExampleUrl] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [studentSearch, setStudentSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const { data: studentsData, isLoading: loadingUsers } = useTutorStudents({
    limit: 1000,
  });
  const users = studentsData?.students ?? [];
  const [parsedContent, setParsedContent] = useState<ParsedContent | null>(
    null
  );
  const [showPreview, setShowPreview] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  // Pre-generate TTS audio option
  const [generateTTSAudio, setGenerateTTSAudio] = useState(true);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState("");
  const [showReassignConfirm, setShowReassignConfirm] = useState(false);
  const [journeyPart, setJourneyPart] = useState<LearningJourneyPartId | "">("");
  const [journeyTopic, setJourneyTopic] = useState("");

  const applyDraft = useCallback((draft: TutorDrillDraft) => {
    setVocabularyItems(draft.vocabularyItems);
    setPronunciationItems(draft.pronunciationItems);
    setStudentCharacterName(draft.studentCharacterName);
    setAiCharacterNames(draft.aiCharacterNames);
    setDrillIntro(draft.drillIntro);
    setRoleplayScenes(draft.roleplayScenes);
    setMatchingPairs(draft.matchingPairs);
    setGrammarItems(draft.grammarItems);
    setSentenceWritingItems(draft.sentenceWritingItems);
    setArticleTitle(draft.articleTitle);
    setArticleContent(draft.articleContent);
    setListeningTitle(draft.listeningTitle);
    setListeningContent(draft.listeningContent);
    setFillBlankItems(draft.fillBlankItems);
    setKeyPhraseItems(draft.keyPhraseItems);
    setDrillTitle(draft.drillTitle);
    setDrillType(draft.drillType);
    setDifficulty(draft.difficulty);
    setCompletionDate(draft.completionDate);
    setDurationDays(draft.durationDays);
    setContext(draft.context);
    setAudioExampleUrl(draft.audioExampleUrl);
    setSelectedUsers(new Set(draft.selectedUsers));
    setGenerateTTSAudio(draft.generateTTSAudio);
    setJourneyPart(draft.journeyPart ?? "");
    setJourneyTopic(draft.journeyTopic ?? "");
  }, []);

  const buildDraft = useCallback((): TutorDrillDraft => {
    return {
      vocabularyItems,
      pronunciationItems,
      studentCharacterName,
      aiCharacterNames,
      drillIntro,
      roleplayScenes,
      matchingPairs,
      grammarItems,
      sentenceWritingItems,
      articleTitle,
      articleContent,
      listeningTitle,
      listeningContent,
      fillBlankItems,
      keyPhraseItems,
      drillTitle,
      drillType,
      difficulty,
      completionDate,
      durationDays,
      context,
      audioExampleUrl,
      selectedUsers: Array.from(selectedUsers),
      generateTTSAudio,
      journeyPart,
      journeyTopic,
    };
  }, [
    vocabularyItems,
    pronunciationItems,
    studentCharacterName,
    aiCharacterNames,
    drillIntro,
    roleplayScenes,
    matchingPairs,
    grammarItems,
    sentenceWritingItems,
    articleTitle,
    articleContent,
    listeningTitle,
    listeningContent,
    fillBlankItems,
    keyPhraseItems,
    drillTitle,
    drillType,
    difficulty,
    completionDate,
    durationDays,
    context,
    audioExampleUrl,
    selectedUsers,
    generateTTSAudio,
    journeyPart,
    journeyTopic,
  ]);

  const saveDraft = useCallback(() => {
    if (isEditMode) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(buildDraft()));
    } catch (e) {
      console.warn("Failed to save drill draft:", e);
    }
  }, [isEditMode, buildDraft]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
  }, []);

  // Load drill data in edit mode
  const { data: drillData, isLoading: loadingDrill } = useDrill(
    drillId || ""
  );
  const totalAssignments = drillData?.totalAssignments ?? 0;
  const isAssignedDrill = isEditMode && totalAssignments > 0;

  useEffect(() => {
    if (!isEditMode) {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        try {
          const parsedDraft = JSON.parse(savedDraft) as TutorDrillDraft;
          if (parsedDraft && typeof parsedDraft === "object") {
            applyDraft(parsedDraft);
            toast.success("Draft restored", {
              action: {
                label: "Discard",
                onClick: () => {
                  clearDraft();
                  applyDraft(getDefaultTutorDrillDraft());
                  toast.info("Draft discarded");
                },
              },
            });
          }
        } catch (e) {
          console.warn("Failed to parse saved drill draft:", e);
          clearDraft();
          setCompletionDate(getDefaultCompletionDate());
        }
      } else {
        setCompletionDate(getDefaultCompletionDate());
      }
    }
  }, [isEditMode, applyDraft, clearDraft]);

  // Auto-save draft (create mode only)
  useEffect(() => {
    if (isEditMode) return;
    const timeoutId = setTimeout(saveDraft, 1000);
    return () => clearTimeout(timeoutId);
  }, [isEditMode, saveDraft]);

  // Save draft before page unload (create mode only)
  useEffect(() => {
    if (isEditMode) return;
    const handleBeforeUnload = () => saveDraft();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isEditMode, saveDraft]);

  // Load drill data when in edit mode
  useEffect(() => {
    if (isEditMode && drillData) {
      const drill = drillData;

      // Set basic fields
      setDrillTitle(drill.title || "");
      setDrillType(drill.type || "vocabulary");
      setDifficulty(drill.difficulty || "intermediate");
      setCompletionDate(
        drill.date ? new Date(drill.date).toISOString().split("T")[0] : ""
      );
      setDurationDays(drill.duration_days || 7);
      setContext(drill.context || "");
      setAudioExampleUrl(drill.audio_example_url || "");
      setJourneyPart(
        drill.learning_journey_part != null
          ? (drill.learning_journey_part as LearningJourneyPartId)
          : "",
      );
      setJourneyTopic(drill.learning_journey_topic || "");

      // Set assigned users (IDs or legacy emails)
      if (drill.assigned_to && Array.isArray(drill.assigned_to)) {
        const assignedRefs = new Set(drill.assigned_to);
        const assignedUserIds = new Set<string>();
        users.forEach((user: any) => {
          const userId = user._id.toString();
          if (
            assignedRefs.has(userId) ||
            (user.email && assignedRefs.has(user.email))
          ) {
            assignedUserIds.add(userId);
          }
        });
        setSelectedUsers(assignedUserIds);
      }

      // Set type-specific fields
      if (drill.type === "vocabulary" && drill.target_sentences) {
        setVocabularyItems(
          drill.target_sentences.length > 0
            ? drill.target_sentences.map((ts: any) => ({
              word: ts.word || "",
              wordTranslation: ts.wordTranslation || "",
              text: ts.text || "",
              translation: ts.translation || "",
            }))
            : [{ word: "", wordTranslation: "", text: "", translation: "" }]
        );
      } else if (drill.type === "pronunciation" && drill.pronunciation_items) {
        setPronunciationItems(
          drill.pronunciation_items.length > 0
            ? drill.pronunciation_items.map((p: any) => ({
              sound: p.sound || "",
              word: p.word || "",
              sentence: p.sentence || "",
            }))
            : [{ sound: "", word: "", sentence: "" }]
        );
      } else if (drill.type === "roleplay") {
        setStudentCharacterName(drill.student_character_name || "");
        setAiCharacterNames(
          drill.ai_character_names && drill.ai_character_names.length > 0
            ? drill.ai_character_names
            : drill.ai_character_name
              ? [drill.ai_character_name]
              : [""]
        );
        setDrillIntro(
          typeof drill.drill_intro === "string" ? drill.drill_intro : ""
        );
        setRoleplayScenes(
          drill.roleplay_scenes && drill.roleplay_scenes.length > 0
            ? drill.roleplay_scenes.map((scene: any) => ({
              scene_name: scene.scene_name || "",
              context: scene.context || "",
              dialogue: scene.dialogue || [],
            }))
            : [
              {
                scene_name: "Scene 1",
                context: "",
                dialogue: [
                  { speaker: "ai_0", text: "", translation: "" },
                  { speaker: "student", text: "", translation: "" },
                ],
              },
            ]
        );
      } else if (drill.type === "matching" && drill.matching_pairs) {
        setMatchingPairs(
          drill.matching_pairs.length > 0
            ? drill.matching_pairs.map((mp: any) => ({
              left: mp.left || "",
              right: mp.right || "",
              leftTranslation: mp.leftTranslation || "",
              rightTranslation: mp.rightTranslation || "",
            }))
            : [
              {
                left: "",
                right: "",
                leftTranslation: "",
                rightTranslation: "",
              },
            ]
        );
      } else if (drill.type === "grammar" && drill.grammar_items) {
        setGrammarItems(
          drill.grammar_items.length > 0
            ? drill.grammar_items.map((gi: any) => ({
              pattern: gi.pattern || "",
              hint: gi.hint || "",
              example: gi.example || "",
            }))
            : [{ pattern: "", hint: "", example: "" }]
        );
      } else if (
        drill.type === "sentence_writing" &&
        drill.sentence_writing_items
      ) {
        setSentenceWritingItems(
          drill.sentence_writing_items.length > 0
            ? drill.sentence_writing_items.map((swi: any) => ({
              word: swi.word || "",
              hint: swi.hint || "",
            }))
            : [{ word: "", hint: "" }]
        );
      } else if (drill.type === "summary") {
        setArticleTitle(drill.article_title || "");
        setArticleContent(drill.article_content || "");
      } else if (drill.type === "listening") {
        setListeningTitle(drill.listening_drill_title || "");
        setListeningContent(drill.listening_drill_content || "");
      } else if (drill.type === "fill_blank" && drill.fill_blank_items) {
        setFillBlankItems(
          drill.fill_blank_items.length > 0
            ? drill.fill_blank_items.map((item: any) => ({
              sentence: item.sentence || "",
              blanks: item.blanks || [
                {
                  position: 0,
                  correctAnswer: "",
                  options: ["", ""],
                  hint: "",
                },
              ],
              translation: item.translation || "",
            }))
            : [
              {
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
            ]
        );
      } else if (drill.type === "key_phrases" && drill.key_phrase_items) {
        setKeyPhraseItems(
          drill.key_phrase_items.length > 0
            ? drill.key_phrase_items.map((item: any) => ({
              prompt: item.prompt || "",
              respondentName: item.respondentName || "",
              options: item.options?.length >= 2 ? item.options : ["", ""],
              correctAnswer: item.correctAnswer || "",
            }))
            : [{ respondentName: "", prompt: "", options: ["", ""], correctAnswer: "" }]
        );
      }
    }
  }, [isEditMode, drillData, users]);

  // Vocabulary helpers
  const addVocabularyItem = () => {
    setVocabularyItems([
      ...vocabularyItems,
      { word: "", wordTranslation: "", text: "", translation: "" },
    ]);
  };

  const removeVocabularyItem = (index: number) => {
    setVocabularyItems(vocabularyItems.filter((_, i) => i !== index));
  };

  const updateVocabularyItem = (
    index: number,
    field: keyof VocabularyItem,
    value: string
  ) => {
    const updated = [...vocabularyItems];
    updated[index] = { ...updated[index], [field]: value };
    setVocabularyItems(updated);
  };

  const addPronunciationItem = () => {
    setPronunciationItems([
      ...pronunciationItems,
      { sound: "", word: "", sentence: "" },
    ]);
  };

  const removePronunciationItem = (index: number) => {
    if (pronunciationItems.length <= 1) {
      setPronunciationItems([{ sound: "", word: "", sentence: "" }]);
      return;
    }
    setPronunciationItems(pronunciationItems.filter((_, i) => i !== index));
  };

  const updatePronunciationItem = (
    index: number,
    field: keyof PronunciationItem,
    value: string
  ) => {
    const updated = [...pronunciationItems];
    updated[index] = { ...updated[index], [field]: value };
    setPronunciationItems(updated);
  };
  const addRoleplayScene = () => {
    setRoleplayScenes([
      ...roleplayScenes,
      {
        scene_name: `Scene ${roleplayScenes.length + 1}`,
        context: "",
        dialogue: [
          { speaker: "ai_0", text: "", translation: "" },
          { speaker: "student", text: "", translation: "" },
        ],
      },
    ]);
  };

  const removeRoleplayScene = (index: number) => {
    setRoleplayScenes(roleplayScenes.filter((_, i) => i !== index));
  };

  const addAiCharacter = () => {
    setAiCharacterNames([...aiCharacterNames, ""]);
  };

  const removeAiCharacter = (index: number) => {
    if (aiCharacterNames.length > 1) {
      setAiCharacterNames(aiCharacterNames.filter((_, i) => i !== index));
    }
  };

  const addDialogueTurn = (sceneIndex: number) => {
    const scenes = [...roleplayScenes];
    const dialogue = scenes[sceneIndex].dialogue || [];
    const lastTurn = dialogue[dialogue.length - 1];
    const nextSpeaker = lastTurn?.speaker === "student" ? "ai_0" : "student";
    scenes[sceneIndex].dialogue = [
      ...dialogue,
      { speaker: nextSpeaker, text: "", translation: "" },
    ];
    setRoleplayScenes(scenes);
  };

  const removeDialogueTurn = (sceneIndex: number, turnIndex: number) => {
    const scenes = [...roleplayScenes];
    if (scenes[sceneIndex].dialogue.length > 2) {
      scenes[sceneIndex].dialogue = scenes[sceneIndex].dialogue.filter(
        (_, i) => i !== turnIndex
      );
      setRoleplayScenes(scenes);
    }
  };

  // Matching helpers
  const addMatchingPair = () => {
    setMatchingPairs([
      ...matchingPairs,
      { left: "", right: "", leftTranslation: "", rightTranslation: "" },
    ]);
  };

  const removeMatchingPair = (index: number) => {
    setMatchingPairs(matchingPairs.filter((_, i) => i !== index));
  };

  const updateMatchingPair = (
    index: number,
    field: keyof MatchingPair,
    value: string
  ) => {
    const updated = [...matchingPairs];
    updated[index] = { ...updated[index], [field]: value };
    setMatchingPairs(updated);
  };


  // Grammar helpers
  const addGrammarItem = () => {
    setGrammarItems([...grammarItems, { pattern: "", hint: "", example: "" }]);
  };

  const removeGrammarItem = (index: number) => {
    setGrammarItems(grammarItems.filter((_, i) => i !== index));
  };

  const updateGrammarItem = (
    index: number,
    field: keyof GrammarItem,
    value: string
  ) => {
    const updated = [...grammarItems];
    updated[index] = { ...updated[index], [field]: value };
    setGrammarItems(updated);
  };

  // Sentence Writing helpers
  const addSentenceWritingItem = () => {
    setSentenceWritingItems([...sentenceWritingItems, { word: "", hint: "" }]);
  };

  const removeSentenceWritingItem = (index: number) => {
    setSentenceWritingItems(sentenceWritingItems.filter((_, i) => i !== index));
  };

  const updateSentenceWritingItem = (
    index: number,
    field: keyof SentenceWritingItem,
    value: string
  ) => {
    const updated = [...sentenceWritingItems];
    updated[index] = { ...updated[index], [field]: value };
    setSentenceWritingItems(updated);
  };

  const toggleUser = (userId: string) => {
    const id = userId.toString();
    const updated = new Set(selectedUsers);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedUsers(updated);
  };

  const filteredUsers = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return users;

    return users.filter((user) => {
      const name = `${user.firstName || ""} ${user.lastName || ""} ${user.name || ""}`
        .trim()
        .toLowerCase();
      const email = (user.email || "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [users, studentSearch]);

  const allFilteredSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every((user) => selectedUsers.has(user._id.toString()));

  const toggleAllUsers = () => {
    const targetIds = filteredUsers.map((u) => u._id.toString());

    if (allFilteredSelected) {
      const updated = new Set(selectedUsers);
      targetIds.forEach((id) => updated.delete(id));
      setSelectedUsers(updated);
      return;
    }

    const updated = new Set(selectedUsers);
    targetIds.forEach((id) => updated.add(id));
    setSelectedUsers(updated);
  };

  // Handle file upload
  const handleFileSelect = async (file: File) => {
    try {
      setIsParsing(true);
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/v1/drills/parse-document", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to parse document");
      }

      const result = await response.json();
      setParsedContent(result.data);
      setShowPreview(true);
      toast.success("Document parsed successfully");
    } catch (error: any) {
      toast.error("Failed to parse document: " + error.message);
    } finally {
      setIsParsing(false);
    }
  };

  // Handle clipboard parse
  const handleClipboardParse = (parsed: ParsedContent) => {
    setParsedContent(parsed);
    setShowPreview(true);
  };

  // Apply parsed content to form
  const handleApplyParsedContent = () => {
    if (!parsedContent) return;

    const { extractedData, type } = parsedContent;
    const { title, items, metadata } = extractedData;

    // Update form data
    if (title) {
      setDrillTitle(title);
    }

    // Set type if detected with high confidence
    if (type !== "unknown" && parsedContent.confidence >= 0.6) {
      setDrillType(type);
    }

    // Set difficulty if detected
    if (metadata?.difficulty) {
      setDifficulty(metadata.difficulty);
    }

    // Set context if available
    if (metadata?.context) {
      setContext(metadata.context);
    }

    // Populate type-specific fields
    switch (type) {
      case "vocabulary":
        setVocabularyItems(
          items.length > 0
            ? items
            : [{ word: "", wordTranslation: "", text: "", translation: "" }]
        );
        break;
      case "matching":
        setMatchingPairs(
          items.length > 0
            ? items
            : [
              {
                left: "",
                right: "",
                leftTranslation: "",
                rightTranslation: "",
              },
            ]
        );
        break;
      case "roleplay":
        setRoleplayScenes(
          items.length > 0
            ? items
            : [
              {
                scene_name: "Scene 1",
                dialogue: [
                  { speaker: "ai_0", text: "", translation: "" },
                  { speaker: "student", text: "", translation: "" },
                ],
              },
            ]
        );
        break;
      case "grammar":
        setGrammarItems(
          items.length > 0 ? items : [{ pattern: "", example: "", hint: "" }]
        );
        break;
      case "sentence_writing":
        setSentenceWritingItems(
          items.length > 0 ? items : [{ word: "", hint: "" }]
        );
        break;
      case "summary":
        if (items.length > 0 && items[0].content) {
          setArticleContent(items[0].content);
        }
        if (title) {
          setArticleTitle(title);
        }
        break;
      case "listening":
        if (items.length > 0 && items[0].content) {
          setListeningContent(items[0].content);
        }
        if (title) {
          setListeningTitle(title);
        }
        break;
      case "fill_blank":
        setFillBlankItems(
          items.length > 0
            ? items
            : [
              {
                sentence: "",
                blanks: [
                  { position: 0, correctAnswer: "", options: ["", ""], hint: "" },
                ],
                translation: "",
              },
            ]
        );
        break;
    }

    setShowPreview(false);
    setParsedContent(null);
    toast.success("Form populated with parsed data");
  };

  const validateDrillContent = (): boolean => {
    if (!drillTitle.trim()) {
      toast.error("Please enter a drill title");
      return false;
    }

    if (!completionDate) {
      toast.error("Please select a completion date");
      return false;
    }

    if (drillType === "vocabulary") {
      if (
        vocabularyItems.length === 0 ||
        vocabularyItems.some((v) => !v.text.trim())
      ) {
        toast.error("Please add at least one vocabulary item with a sentence");
        return false;
      }
    } else if (drillType === "pronunciation") {
      if (pronunciationItems.length === 0) {
        toast.error("Add at least one pronunciation item");
        return false;
      }
      for (const p of pronunciationItems) {
        if (!p.sound.trim() || !p.word.trim() || !p.sentence.trim()) {
          toast.error("Each pronunciation item needs Sound, Word, and Sentence");
          return false;
        }
      }
    } else if (drillType === "roleplay") {
      if (!context.trim()) {
        toast.error("Please provide a context/scenario for the roleplay");
        return false;
      }
      if (!studentCharacterName.trim()) {
        toast.error("Please provide a student character name");
        return false;
      }
      if (aiCharacterNames.some((name) => !name.trim())) {
        toast.error("Please provide all AI character names");
        return false;
      }
      if (
        roleplayScenes.length === 0 ||
        roleplayScenes.some(
          (s) => s.dialogue.length < 2 || s.dialogue.some((d) => !d.text.trim())
        )
      ) {
        toast.error("Please add at least one scene with complete dialogue");
        return false;
      }
    } else if (drillType === "matching") {
      if (
        matchingPairs.length === 0 ||
        matchingPairs.some((p) => !p.left.trim() || !p.right.trim())
      ) {
        toast.error(
          "Please add at least one matching pair with both sides filled"
        );
        return false;
      }
    } else if (drillType === "grammar") {
      if (
        grammarItems.length === 0 ||
        grammarItems.some((g) => !g.pattern.trim() || !g.example.trim())
      ) {
        toast.error("Please add at least one grammar pattern with an example sentence");
        return false;
      }
    } else if (drillType === "sentence_writing") {
      if (
        sentenceWritingItems.length === 0 ||
        sentenceWritingItems.some((s) => !s.word.trim())
      ) {
        toast.error("Please add at least one word for sentence writing");
        return false;
      }
    } else if (drillType === "summary") {
      if (!articleTitle.trim() || !articleContent.trim()) {
        toast.error("Please provide both article title and content");
        return false;
      }
    } else if (drillType === "listening") {
      if (!listeningTitle.trim() || !listeningContent.trim()) {
        toast.error("Please provide both listening title and content");
        return false;
      }
    } else if (drillType === "fill_blank") {
      const fillBlankError = validateFillBlankItems(fillBlankItems);
      if (fillBlankError) {
        toast.error(fillBlankError);
        return false;
      }
    } else if (drillType === "key_phrases") {
      if (keyPhraseItems.length === 0 || !keyPhraseItems.some(item => item.prompt.trim())) {
        toast.error("Please add at least one key phrase question");
        return false;
      }
      for (const item of keyPhraseItems) {
        if (!item.prompt.trim()) continue;
        if (item.options.filter(o => o.trim()).length < 2) {
          toast.error("Each question must have at least 2 options");
          return false;
        }
        if (!item.correctAnswer.trim()) {
          toast.error("Please select a correct answer for each question");
          return false;
        }
        if (!item.options.includes(item.correctAnswer)) {
          toast.error("Correct answer must be one of the options");
          return false;
        }
      }
    }

    return true;
  };

  const buildDrillPayload = (options?: {
    assignedTo?: string[];
    isActive?: boolean;
    omitAssignment?: boolean;
  }): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      title: drillTitle,
      type: drillType,
      difficulty: difficulty.toLowerCase(),
      date: new Date(completionDate).toISOString(),
      duration_days: durationDays,
      context: context || undefined,
      audio_example_url: audioExampleUrl || undefined,
    };

    if (journeyPart && journeyTopic) {
      payload.learning_journey_part = journeyPart;
      payload.learning_journey_topic = journeyTopic;
    }

    if (!options?.omitAssignment) {
      if (options?.assignedTo !== undefined) {
        payload.assigned_to = options.assignedTo;
      }
      if (options?.isActive !== undefined) {
        payload.is_active = options.isActive;
      }
    }

    if (drillType === "vocabulary") {
      payload.target_sentences = vocabularyItems
        .filter((v) => v.text.trim())
        .map((v) => ({
          word: v.word?.trim() || undefined,
          wordTranslation: v.wordTranslation?.trim() || undefined,
          text: v.text.trim(),
          translation: v.translation?.trim() || undefined,
        }));
      payload.pronunciation_items = [];
    } else if (drillType === "pronunciation") {
      payload.target_sentences = [];
      payload.pronunciation_items = pronunciationItems
        .filter((p) => p.sound.trim() && p.word.trim() && p.sentence.trim())
        .map((p) => ({
          sound: p.sound.trim(),
          word: p.word.trim(),
          sentence: p.sentence.trim(),
        }));
    } else if (drillType === "roleplay") {
      payload.student_character_name = studentCharacterName.trim();
      payload.ai_character_names = aiCharacterNames.filter((name) => name.trim());
      payload.drill_intro = drillIntro.trim();
      payload.roleplay_scenes = roleplayScenes.map((scene) => ({
        scene_name: scene.scene_name.trim(),
        context: scene.context?.trim() || undefined,
        dialogue: scene.dialogue
          .filter((d) => d.text.trim())
          .map((d) => ({
            speaker: d.speaker,
            text: d.text.trim(),
            translation: d.translation?.trim() || undefined,
          })),
      }));
    } else if (drillType === "matching") {
      payload.matching_pairs = matchingPairs
        .filter((p) => p.left.trim() && p.right.trim())
        .map((p) => ({
          left: p.left.trim(),
          right: p.right.trim(),
          leftTranslation: p.leftTranslation?.trim() || undefined,
          rightTranslation: p.rightTranslation?.trim() || undefined,
        }));
    } else if (drillType === "grammar") {
      payload.grammar_items = grammarItems
        .filter((g) => g.pattern.trim())
        .map((g) => ({
          pattern: g.pattern.trim(),
          hint: g.hint?.trim() || undefined,
          example: g.example?.trim() || undefined,
        }));
    } else if (drillType === "sentence_writing") {
      payload.sentence_writing_items = sentenceWritingItems
        .filter((s) => s.word.trim())
        .map((s) => ({
          word: s.word.trim(),
          hint: s.hint?.trim() || undefined,
        }));
    } else if (drillType === "summary") {
      payload.article_title = articleTitle.trim();
      payload.article_content = articleContent.trim();
    } else if (drillType === "listening") {
      payload.listening_drill_title = listeningTitle.trim();
      payload.listening_drill_content = listeningContent.trim();
    } else if (drillType === "fill_blank") {
      payload.fill_blank_items = normalizeFillBlankItems(fillBlankItems);
    } else if (drillType === "key_phrases") {
      payload.key_phrase_items = keyPhraseItems
        .filter((item) => item.prompt.trim())
        .map((item) => ({
          prompt: item.prompt.trim(),
          respondentName: item.respondentName?.trim() || undefined,
          options: item.options.filter((o) => o.trim()),
          correctAnswer: item.correctAnswer.trim(),
        }));
    }

    return payload;
  };

  const handleSaveDrill = async () => {
    if (!validateDrillContent()) return;

    try {
      setSaving(true);

      const payload = buildDrillPayload(
        isAssignedDrill
          ? { omitAssignment: true }
          : { assignedTo: [], isActive: false }
      );

      if (isEditMode && drillId) {
        await drillAPI.update(drillId, payload);
        clearDraft();
        toast.success("Drill saved successfully!");
      } else {
        await drillAPI.create(payload);
        clearDraft();
        if (selectedUsers.size > 0) {
          toast.success(
            "Drill saved as draft. Use \"Create Drill\" to assign it to selected students."
          );
        } else {
          toast.success("Drill saved successfully!");
        }
      }

      router.push("/tutor/drills");
    } catch (error: any) {
      toast.error(
        "Failed to save drill: " + (error.message || "Unknown error")
      );
    } finally {
      setSaving(false);
    }
  };

  const executeSubmit = async () => {
    try {
      setLoading(true);

      const assignedTo = Array.from(selectedUsers)
        .map((id) => id.toString())
        .filter(Boolean) as string[];

      let drillData: any = buildDrillPayload({
        assignedTo,
        isActive: true,
      });

      // Pre-generate TTS audio if enabled
      if (generateTTSAudio) {
        setIsGeneratingAudio(true);
        setAudioProgress("Extracting texts for audio generation...");

        try {
          // Extract texts for all supported drill types
          const textsToGenerate = extractTextsForDrillType(drillData, drillType);

          if (textsToGenerate.length > 0) {
            setAudioProgress(`Generating ${textsToGenerate.length} audio files...`);

            const audioResponse = await generateDrillAudio(
              textsToGenerate,
              drillType,
              drillId || undefined
            );

            if (audioResponse.success && audioResponse.data) {
              // Apply audio URLs to drill data
              drillData = applyAudioUrls(drillData, audioResponse.data.results);

              const { success, failed } = audioResponse.data.summary;
              if (failed > 0) {
                toast.warning(`Generated ${success}/${success + failed} audio files. Some failed.`);
              } else {
                toast.success(`Generated ${success} audio files successfully!`);
              }
            } else {
              toast.warning("Failed to generate audio, but drill will be saved without pre-generated audio.");
            }
          }
        } catch (audioError: any) {
          console.error("Audio generation error:", audioError);
          toast.warning("Audio generation failed, but drill will be saved without pre-generated audio.");
        } finally {
          setIsGeneratingAudio(false);
          setAudioProgress("");
        }
      }

      // If editing, use update API
      if (isEditMode && drillId) {
        await drillAPI.update(drillId, drillData);
        clearDraft();
        if (isAssignedDrill) {
          toast.success(
            `Drill updated and reassigned to ${selectedUsers.size} student${selectedUsers.size !== 1 ? "s" : ""}. All previous progress has been reset.`
          );
        } else {
          toast.success(
            `Drill assigned to ${selectedUsers.size} student${selectedUsers.size !== 1 ? "s" : ""}!`
          );
        }
        router.push("/tutor/drills");
      } else {
        await drillAPI.create(drillData);
        clearDraft();
        toast.success("Drill created successfully!");
        router.push("/tutor/drills");
      }
    } catch (error: any) {
      toast.error(
        "Failed to create drill: " + (error.message || "Unknown error")
      );
    } finally {
      setLoading(false);
      setIsGeneratingAudio(false);
      setAudioProgress("");
    }
  };

  const handleSubmit = async () => {
    if (!validateDrillContent()) return;

    if (selectedUsers.size === 0) {
      toast.error("Please select at least one user");
      return;
    }

    if (!journeyPart || !journeyTopic) {
      toast.error("Please select a learning journey part and topic");
      return;
    }

    if (!isValidPartTopicPair(journeyPart, journeyTopic)) {
      toast.error("Selected topic does not belong to the selected part");
      return;
    }

    if (isEditMode && isAssignedDrill) {
      setShowReassignConfirm(true);
      return;
    }

    await executeSubmit();
  };

  const handleCopyDrill = async () => {
    if (!validateDrillContent()) return;

    setCopying(true);
    try {
      let payload = buildDrillPayload({ assignedTo: [], isActive: false });
      if (isEditMode && drillData) {
        payload = mergeMediaFieldsFromSource(
          payload,
          drillData as Record<string, unknown>
        );
      }
      const response: any = await drillAPI.create(payload);
      const newDrillId =
        response?.data?.drill?._id ?? response?.drill?._id;
      if (!newDrillId) {
        throw new Error("New drill ID not returned");
      }
      clearDraft();
      setSelectedUsers(new Set());
      setCompletionDate(getDefaultCompletionDate());
      toast.success(
        "Drill copied. Select students and a completion date, then assign."
      );
      router.push(`/tutor/drills/create?drillId=${newDrillId}`);
    } catch (error: any) {
      toast.error(
        "Failed to copy drill: " + (error.message || "Unknown error")
      );
    } finally {
      setCopying(false);
    }
  };

  // Show loading state when fetching drill data in edit mode
  if (isEditMode && loadingDrill) {
    return (
      <div className="space-y-8 pb-20">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#418b43] mx-auto mb-4" />
            <p className="text-gray-500">Loading drill data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-6">
        <button
          onClick={() => router.back()}
          className="p-3 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? "Edit Drill" : "Create New Drill"}
          </h1>
          <p className="text-gray-500 text-sm">
            {isEditMode
              ? "Update drill details and assignments"
              : "Upload a PDF or fill in the form manually"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          {/* Upload Section */}
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Import Data
                </h3>
                <p className="text-sm text-gray-500">
                  Upload a file, paste from clipboard, or download a template to
                  get started quickly
                </p>
              </div>
              <TemplateDownload drillType={drillType} />
            </div>

            <div className="space-y-4 mt-6">
              {/* File Upload */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">
                  Upload Document
                </label>
                <FileUploadZone
                  onFileSelect={handleFileSelect}
                  disabled={isParsing}
                />
              </div>

              {/* Clipboard Paste */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">
                  Or Paste from Clipboard
                </label>
                <ClipboardPaste onParse={handleClipboardParse} />
              </div>
            </div>
          </div>

          {/* Dynamic Form Based on Drill Type */}
          {drillType === "vocabulary" && (
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  Vocabulary Items<span className="text-red-500">*</span>
                </h2>
                <button
                  onClick={addVocabularyItem}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-[#3d8c40] font-bold text-sm rounded-xl hover:bg-emerald-50 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </div>
              <div className="space-y-6">
                {vocabularyItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-6 bg-gray-50/50 rounded-2xl relative border border-gray-100"
                  >
                    <button
                      onClick={() => removeVocabularyItem(idx)}
                      className="absolute top-4 right-4 text-red-400 hover:text-red-600 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <h4 className="text-sm font-bold text-gray-900 mb-4">
                      Item {idx + 1}
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">
                          Vocabulary Word (optional)
                        </label>
                        <input
                          type="text"
                          value={item.word || ""}
                          onChange={(e) =>
                            updateVocabularyItem(idx, "word", e.target.value)
                          }
                          placeholder="e.g. restaurant"
                          className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">
                          Word Translation (optional)
                        </label>
                        <input
                          type="text"
                          value={item.wordTranslation || ""}
                          onChange={(e) =>
                            updateVocabularyItem(
                              idx,
                              "wordTranslation",
                              e.target.value
                            )
                          }
                          placeholder="e.g. 식당"
                          className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">
                          Practice Sentence
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={item.text}
                          onChange={(e) =>
                            updateVocabularyItem(idx, "text", e.target.value)
                          }
                          placeholder="e.g. I went to the restaurant yesterday"
                          className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">
                          Sentence Translation (optional)
                        </label>
                        <input
                          type="text"
                          value={item.translation || ""}
                          onChange={(e) =>
                            updateVocabularyItem(
                              idx,
                              "translation",
                              e.target.value
                            )
                          }
                          placeholder="e.g. 나는 어제 식당에 갔다"
                          className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {drillType === "pronunciation" && (
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  Pronunciation Items<span className="text-red-500">*</span>
                </h2>
                <button
                  type="button"
                  onClick={addPronunciationItem}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white border border-[#3d8c40] text-[#3d8c40] font-bold text-sm rounded-xl hover:bg-emerald-50 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </div>
              <div className="space-y-6">
                {pronunciationItems.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-6 bg-gray-50/50 rounded-2xl relative border border-gray-100"
                  >
                    <button
                      type="button"
                      onClick={() => removePronunciationItem(idx)}
                      className="absolute top-4 right-4 text-red-400 hover:text-red-600 transition-colors"
                      aria-label="Remove item"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <h4 className="text-sm font-bold text-gray-900 mb-4 pr-8">
                      Item {idx + 1}
                    </h4>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">
                          Sound
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={p.sound}
                          onChange={(e) =>
                            updatePronunciationItem(
                              idx,
                              "sound",
                              e.target.value
                            )
                          }
                          placeholder="e.g. /ʃ/ or sh"
                          className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">
                          Word
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={p.word}
                          onChange={(e) =>
                            updatePronunciationItem(
                              idx,
                              "word",
                              e.target.value
                            )
                          }
                          placeholder="Target word"
                          className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">
                        Sentence
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={p.sentence}
                        onChange={(e) =>
                          updatePronunciationItem(
                            idx,
                            "sentence",
                            e.target.value
                          )
                        }
                        placeholder="Practice sentence"
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {drillType === "roleplay" && (
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                  Context / Scenario<span className="text-red-500">*</span>
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g. You're at a restaurant ordering dinner"
                  rows={3}
                  className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                  Student Character Name<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={studentCharacterName}
                  onChange={(e) => setStudentCharacterName(e.target.value)}
                  placeholder="e.g. Customer, Patient, Tourist"
                  className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-gray-600">
                    AI Character Names<span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={addAiCharacter}
                    className="flex items-center gap-1 px-3 py-1 bg-gray-50 text-[#3d8c40] text-xs font-bold rounded-lg hover:bg-emerald-50"
                  >
                    <Plus className="w-3 h-3" /> Add Character
                  </button>
                </div>
                {aiCharacterNames.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        const updated = [...aiCharacterNames];
                        updated[idx] = e.target.value;
                        setAiCharacterNames(updated);
                      }}
                      placeholder={`e.g. ${idx === 0 ? "Waiter" : idx === 1 ? "Manager" : "Host"
                        }`}
                      className="flex-1 px-4 py-3 bg-white border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    {aiCharacterNames.length > 1 && (
                      <button
                        onClick={() => removeAiCharacter(idx)}
                        className="p-2 text-red-400 hover:text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                  Drill intro
                </label>
                <textarea
                  value={drillIntro}
                  onChange={(e) => setDrillIntro(e.target.value)}
                  placeholder="What learners see in the chat before they tap Let's Get Started…"
                  rows={5}
                  maxLength={5000}
                  className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-y min-h-[100px]"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Shown on the roleplay pre-start screen. If left empty, learners
                  see a short default message there instead.
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-gray-900">
                    Roleplay Scenes<span className="text-red-500">*</span>
                  </h3>
                  <button
                    onClick={addRoleplayScene}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-[#3d8c40] font-bold text-sm rounded-xl hover:bg-emerald-50"
                  >
                    <Plus className="w-4 h-4" /> Add Scene
                  </button>
                </div>
                <div className="space-y-4">
                  {roleplayScenes.map((scene, sceneIdx) => (
                    <div
                      key={sceneIdx}
                      className="p-6 bg-primary-50/30 rounded-2xl border border-primary-100"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <input
                          type="text"
                          value={scene.scene_name}
                          onChange={(e) => {
                            const scenes = [...roleplayScenes];
                            scenes[sceneIdx].scene_name = e.target.value;
                            setRoleplayScenes(scenes);
                          }}
                          placeholder="Scene name"
                          className="px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm font-bold"
                        />
                        {roleplayScenes.length > 1 && (
                          <button
                            onClick={() => removeRoleplayScene(sceneIdx)}
                            className="p-2 text-red-400 hover:text-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">
                          Scene Context (optional)
                        </label>
                        <input
                          type="text"
                          value={scene.context || ""}
                          onChange={(e) => {
                            const scenes = [...roleplayScenes];
                            scenes[sceneIdx].context = e.target.value;
                            setRoleplayScenes(scenes);
                          }}
                          placeholder="Scene-specific context"
                          className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold text-gray-600">
                            Dialogue
                          </label>
                          <button
                            onClick={() => addDialogueTurn(sceneIdx)}
                            className="flex items-center gap-1 px-2 py-1 bg-gray-50 text-xs font-bold rounded-lg hover:bg-gray-100"
                          >
                            <Plus className="w-3 h-3" /> Add Turn
                          </button>
                        </div>
                        <div className="space-y-3">
                          {scene.dialogue.map((turn, turnIdx) => (
                            <div
                              key={turnIdx}
                              className={`p-4 rounded-xl border ${turn.speaker === "student"
                                ? "bg-blue-50/30 border-blue-100"
                                : "bg-primary-50/30 border-primary-100"
                                }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <select
                                  value={turn.speaker}
                                  onChange={(e) => {
                                    const scenes = [...roleplayScenes];
                                    scenes[sceneIdx].dialogue[turnIdx].speaker =
                                      e.target.value;
                                    setRoleplayScenes(scenes);
                                  }}
                                  className="px-3 py-1 bg-white border border-gray-100 rounded-lg text-xs"
                                >
                                  <option value="student">
                                    {studentCharacterName || "Student"}
                                  </option>
                                  {aiCharacterNames.map((name, aiIdx) => (
                                    <option key={aiIdx} value={`ai_${aiIdx}`}>
                                      {name || `AI ${aiIdx + 1}`}
                                    </option>
                                  ))}
                                </select>
                                {scene.dialogue.length > 2 && (
                                  <button
                                    onClick={() =>
                                      removeDialogueTurn(sceneIdx, turnIdx)
                                    }
                                    className="p-1 text-red-400 hover:text-red-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              <input
                                type="text"
                                value={turn.text}
                                onChange={(e) => {
                                  const scenes = [...roleplayScenes];
                                  scenes[sceneIdx].dialogue[turnIdx].text =
                                    e.target.value;
                                  setRoleplayScenes(scenes);
                                }}
                                placeholder="English text"
                                className="w-full px-3 py-2 bg-white border border-gray-100 rounded-lg mb-2"
                              />
                              <input
                                type="text"
                                value={turn.translation || ""}
                                onChange={(e) => {
                                  const scenes = [...roleplayScenes];
                                  scenes[sceneIdx].dialogue[
                                    turnIdx
                                  ].translation = e.target.value;
                                  setRoleplayScenes(scenes);
                                }}
                                placeholder="Korean translation (optional)"
                                className="w-full px-3 py-2 bg-white border border-gray-100 rounded-lg"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {drillType === "matching" && (
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-bold text-gray-900">
                  Matching Pairs<span className="text-red-500">*</span>
                </h2>
                <button
                  onClick={addMatchingPair}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-[#3d8c40] font-bold text-sm rounded-xl hover:bg-emerald-50"
                >
                  <Plus className="w-4 h-4" /> Add Pair
                </button>
              </div>
              <div className="space-y-6">
                {matchingPairs.map((pair, idx) => (
                  <div
                    key={idx}
                    className="p-6 bg-gray-50/50 rounded-2xl relative border border-gray-100"
                  >
                    <button
                      onClick={() => removeMatchingPair(idx)}
                      className="absolute top-4 right-4 text-red-400 hover:text-red-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <h4 className="text-sm font-bold text-gray-900 mb-4">
                      Pair {idx + 1}
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1.5">
                            Left Side<span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={pair.left}
                            onChange={(e) =>
                              updateMatchingPair(idx, "left", e.target.value)
                            }
                            placeholder="e.g. Hello"
                            className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1.5">
                            Left Translation (optional)
                          </label>
                          <input
                            type="text"
                            value={pair.leftTranslation || ""}
                            onChange={(e) =>
                              updateMatchingPair(
                                idx,
                                "leftTranslation",
                                e.target.value
                              )
                            }
                            placeholder="e.g. 안녕하세요"
                            className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1.5">
                            Right Side<span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={pair.right}
                            onChange={(e) =>
                              updateMatchingPair(idx, "right", e.target.value)
                            }
                            placeholder="e.g. 안녕하세요"
                            className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1.5">
                            Right Translation (optional)
                          </label>
                          <input
                            type="text"
                            value={pair.rightTranslation || ""}
                            onChange={(e) =>
                              updateMatchingPair(
                                idx,
                                "rightTranslation",
                                e.target.value
                              )
                            }
                            placeholder="e.g. Korean greeting"
                            className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}


          {drillType === "grammar" && (
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-bold text-gray-900">
                  Grammar Patterns<span className="text-red-500">*</span>
                </h2>
                <button
                  onClick={addGrammarItem}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-[#3d8c40] font-bold text-sm rounded-xl hover:bg-emerald-50"
                >
                  <Plus className="w-4 h-4" /> Add Pattern
                </button>
              </div>
              <div className="space-y-6">
                {grammarItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-6 bg-gray-50/50 rounded-2xl relative border border-gray-100"
                  >
                    <button
                      onClick={() => removeGrammarItem(idx)}
                      className="absolute top-4 right-4 text-red-400 hover:text-red-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <h4 className="text-sm font-bold text-gray-900 mb-4">
                      Pattern {idx + 1}
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">
                          Grammar Pattern<span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={item.pattern}
                          onChange={(e) =>
                            updateGrammarItem(idx, "pattern", e.target.value)
                          }
                          placeholder="e.g. Used to + verb"
                          className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">
                          Example Sentence<span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={item.example || ""}
                          onChange={(e) =>
                            updateGrammarItem(idx, "example", e.target.value)
                          }
                          placeholder="e.g. I used to play basketball every day"
                          className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          This example will be shown to students as a guide for writing their sentences.
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">
                          Hint (optional)
                        </label>
                        <input
                          type="text"
                          value={item.hint || ""}
                          onChange={(e) =>
                            updateGrammarItem(idx, "hint", e.target.value)
                          }
                          placeholder="e.g. Describes past habits or states"
                          className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {drillType === "sentence_writing" && (
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-bold text-gray-900">
                  Words for Sentence Writing
                  <span className="text-red-500">*</span>
                </h2>
                <button
                  onClick={addSentenceWritingItem}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-[#3d8c40] font-bold text-sm rounded-xl hover:bg-emerald-50"
                >
                  <Plus className="w-4 h-4" /> Add Word
                </button>
              </div>
              <div className="space-y-6">
                {sentenceWritingItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-6 bg-gray-50/50 rounded-2xl relative border border-gray-100"
                  >
                    <button
                      onClick={() => removeSentenceWritingItem(idx)}
                      className="absolute top-4 right-4 text-red-400 hover:text-red-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <h4 className="text-sm font-bold text-gray-900 mb-4">
                      Word {idx + 1}
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">
                          Word / Expression
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={item.word}
                          onChange={(e) =>
                            updateSentenceWritingItem(
                              idx,
                              "word",
                              e.target.value
                            )
                          }
                          placeholder="e.g. Innovation"
                          className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">
                          Hint (optional)
                        </label>
                        <input
                          type="text"
                          value={item.hint || ""}
                          onChange={(e) =>
                            updateSentenceWritingItem(
                              idx,
                              "hint",
                              e.target.value
                            )
                          }
                          placeholder="e.g. Think about new ideas and improvements"
                          className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {drillType === "summary" && (
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-6">
                Article for Summary<span className="text-red-500">*</span>
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Article Title<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={articleTitle}
                    onChange={(e) => setArticleTitle(e.target.value)}
                    placeholder="e.g. Climate Change Effects on Ocean Life"
                    className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Article Content<span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={articleContent}
                    onChange={(e) => setArticleContent(e.target.value)}
                    placeholder="Paste the article text here..."
                    rows={12}
                    className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    Copy and paste the news article text for students to read
                    and summarize.
                  </p>
                </div>
              </div>
            </div>
          )}

          {drillType === "listening" && (
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-6">
                Listening Content<span className="text-red-500">*</span>
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Add content that students will listen to using text-to-speech (ElevenLabs).
                Markdown formatting is supported for better readability.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Content Title<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={listeningTitle}
                    onChange={(e) => setListeningTitle(e.target.value)}
                    placeholder="e.g. Daily News Update, Story Time, etc."
                    className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Content<span className="text-red-500">*</span>
                  </label>
                  <RichTextEditor
                    value={listeningContent}
                    onChange={setListeningContent}
                    placeholder="Enter or paste content here. Markdown formatting is supported and will be auto-formatted on paste..."
                    rows={15}
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    Students will be able to read along while listening to the content via text-to-speech.
                  </p>
                </div>
              </div>
            </div>
          )}

          {drillType === "fill_blank" && (
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">
                  Fill in the Blank Sentences<span className="text-red-500">*</span>
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setFillBlankItems([
                      ...fillBlankItems,
                      {
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
                    ]);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Sentence
                </button>
              </div>
              <div className="space-y-6">
                {fillBlankItems.map((item, itemIndex) => (
                  <div key={itemIndex} className="border border-gray-200 rounded-xl p-6 bg-gray-50">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">
                        Sentence {itemIndex + 1}
                      </h3>
                      {fillBlankItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setFillBlankItems(
                              fillBlankItems.filter((_, i) => i !== itemIndex)
                            );
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">
                          Sentence with Blanks<span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={item.sentence}
                          onChange={(e) => {
                            const updated = [...fillBlankItems];
                            updated[itemIndex].sentence = e.target.value;
                            setFillBlankItems(updated);
                          }}
                          placeholder='e.g., "I ___ to the store ___ buy milk." (Use ___ for blanks)'
                          className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Use "___" (three underscores) to mark where blanks should appear
                        </p>
                      </div>

                      {/* Blanks Section */}
                      <div className="pt-2">
                        <div className="flex items-center justify-between mb-3">
                          <label className="block text-xs font-bold text-gray-600">
                            Blanks in this Sentence<span className="text-red-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...fillBlankItems];
                              updated[itemIndex].blanks.push({
                                position: updated[itemIndex].blanks.length,
                                correctAnswer: "",
                                options: ["", ""],
                                hint: "",
                              });
                              setFillBlankItems(updated);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white text-xs rounded-lg hover:bg-emerald-600"
                          >
                            <Plus className="w-3 h-3" />
                            Add Blank
                          </button>
                        </div>

                        {item.blanks.map((blank, blankIndex) => (
                          <div
                            key={blankIndex}
                            className="p-4 mb-4 bg-white border border-gray-200 rounded-xl"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <h4 className="font-medium text-gray-700">
                                Blank {blankIndex + 1}
                              </h4>
                              {item.blanks.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...fillBlankItems];
                                    updated[itemIndex].blanks = updated[itemIndex].blanks.filter(
                                      (_, i) => i !== blankIndex
                                    );
                                    updated[itemIndex].blanks = updated[itemIndex].blanks.map(
                                      (b, i) => ({ ...b, position: i })
                                    );
                                    setFillBlankItems(updated);
                                  }}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                                  Correct Answer<span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={blank.correctAnswer}
                                  onChange={(e) => {
                                    const updated = [...fillBlankItems];
                                    updated[itemIndex].blanks[blankIndex].correctAnswer =
                                      e.target.value;
                                    // Ensure correct answer is in options
                                    const options =
                                      updated[itemIndex].blanks[blankIndex].options;
                                    if (
                                      !options.includes(e.target.value) &&
                                      e.target.value
                                    ) {
                                      updated[itemIndex].blanks[blankIndex].options = [
                                        e.target.value,
                                        ...options.filter((o) => o),
                                      ];
                                    }
                                    setFillBlankItems(updated);
                                  }}
                                  placeholder="e.g., went"
                                  className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                                  Options<span className="text-red-500">*</span> (must include
                                  correct answer, min 2)
                                </label>
                                {blank.options.map((option, optionIndex) => (
                                  <div key={optionIndex} className="flex gap-2 mb-2">
                                    <input
                                      type="text"
                                      value={option}
                                      onChange={(e) => {
                                        const updated = [...fillBlankItems];
                                        updated[itemIndex].blanks[blankIndex].options[
                                          optionIndex
                                        ] = e.target.value;
                                        setFillBlankItems(updated);
                                      }}
                                      placeholder={`Option ${optionIndex + 1}`}
                                      className="flex-1 px-4 py-3 bg-white border border-gray-100 rounded-xl"
                                    />
                                    {blank.options.length > 2 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = [...fillBlankItems];
                                          updated[itemIndex].blanks[blankIndex].options =
                                            updated[itemIndex].blanks[blankIndex].options.filter(
                                              (_, i) => i !== optionIndex
                                            );
                                          setFillBlankItems(updated);
                                        }}
                                        className="text-red-500 hover:text-red-700 px-2"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...fillBlankItems];
                                    updated[itemIndex].blanks[blankIndex].options.push("");
                                    setFillBlankItems(updated);
                                  }}
                                  className="mt-2 flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white text-xs rounded-lg hover:bg-emerald-600"
                                >
                                  <Plus className="w-3 h-3" />
                                  Add Option
                                </button>
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                                  Hint (Optional)
                                </label>
                                <input
                                  type="text"
                                  value={blank.hint || ""}
                                  onChange={(e) => {
                                    const updated = [...fillBlankItems];
                                    updated[itemIndex].blanks[blankIndex].hint = e.target.value;
                                    setFillBlankItems(updated);
                                  }}
                                  placeholder="e.g., Past tense of 'go'"
                                  className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Phrases Builder */}
          {drillType === "key_phrases" && (
            <div className="space-y-4">
              {keyPhraseItems.map((item, itemIndex) => (
                <div key={itemIndex} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-gray-700">Question {itemIndex + 1}</h3>
                    {keyPhraseItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setKeyPhraseItems(keyPhraseItems.filter((_, i) => i !== itemIndex))}
                        className="text-red-400 hover:text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">Respondent name (optional)</label>
                    <input
                      type="text"
                      value={item.respondentName || ""}
                      onChange={(e) => {
                        const updated = [...keyPhraseItems];
                        updated[itemIndex].respondentName = e.target.value;
                        setKeyPhraseItems(updated);
                      }}
                      placeholder="e.g. Waiter, Colleague, Interviewer"
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">Prompt (situation / question)<span className="text-red-500">*</span></label>
                    <textarea
                      rows={2}
                      value={item.prompt}
                      onChange={(e) => {
                        const updated = [...keyPhraseItems];
                        updated[itemIndex].prompt = e.target.value;
                        setKeyPhraseItems(updated);
                      }}
                      placeholder="e.g. A customer asks for the bill."
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">Options<span className="text-red-500">*</span> (min 2)</label>
                    <div className="space-y-2">
                      {item.options.map((opt, optIndex) => (
                        <div key={optIndex} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const updated = [...keyPhraseItems];
                              const wasCorrect = updated[itemIndex].correctAnswer === updated[itemIndex].options[optIndex];
                              updated[itemIndex].options[optIndex] = e.target.value;
                              if (wasCorrect) updated[itemIndex].correctAnswer = e.target.value;
                              setKeyPhraseItems(updated);
                            }}
                            placeholder={`Option ${optIndex + 1}`}
                            className="flex-1 px-4 py-2.5 bg-white border border-gray-100 rounded-xl"
                          />
                          {item.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...keyPhraseItems];
                                const removedOpt = updated[itemIndex].options[optIndex];
                                updated[itemIndex].options = updated[itemIndex].options.filter((_, i) => i !== optIndex);
                                if (updated[itemIndex].correctAnswer === removedOpt) updated[itemIndex].correctAnswer = "";
                                setKeyPhraseItems(updated);
                              }}
                              className="text-red-400 hover:text-red-600 px-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...keyPhraseItems];
                          updated[itemIndex].options.push("");
                          setKeyPhraseItems(updated);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white text-xs rounded-lg hover:bg-emerald-600"
                      >
                        <Plus className="w-3 h-3" />
                        Add Option
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">Correct Answer<span className="text-red-500">*</span></label>
                    <select
                      value={item.correctAnswer}
                      onChange={(e) => {
                        const updated = [...keyPhraseItems];
                        updated[itemIndex].correctAnswer = e.target.value;
                        setKeyPhraseItems(updated);
                      }}
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl appearance-none"
                    >
                      <option value="">— select correct answer —</option>
                      {item.options.filter(o => o.trim()).map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setKeyPhraseItems([...keyPhraseItems, { respondentName: "", prompt: "", options: ["", ""], correctAnswer: "" }])}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white text-sm rounded-xl hover:bg-emerald-600"
              >
                <Plus className="w-4 h-4" />
                Add Question
              </button>
            </div>
          )}
        </div>

        <div className="space-y-8">
          {/* Drill Settings */}
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-8">
              Drill Settings
            </h2>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Drill title<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={drillTitle}
                    onChange={(e) => setDrillTitle(e.target.value)}
                    placeholder="e.g. Daily practice-Restaurants"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Completion Date<span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={completionDate}
                      onChange={(e) => setCompletionDate(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Duration (days)
                  </label>
                  <input
                    type="number"
                    value={durationDays}
                    onChange={(e) =>
                      setDurationDays(parseInt(e.target.value) || 7)
                    }
                    min="1"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Drill type<span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={drillType}
                      onChange={(e) => setDrillType(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="vocabulary">Vocabulary</option>
                      <option value="pronunciation">Pronunciation</option>
                      <option value="roleplay">Roleplay</option>
                      <option value="matching">Matching</option>
                      <option value="grammar">Grammar</option>
                      <option value="sentence_writing">Sentence Writing</option>
                      <option value="summary">Summary</option>
                      <option value="listening">Listening</option>
                      <option value="fill_blank">Fill in the Blank</option>
                      <option value="key_phrases">Key Phrases</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Difficulty<span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <LearningJourneyPartTopicFields
                journeyPart={journeyPart}
                journeyTopic={journeyTopic}
                onPartChange={setJourneyPart}
                onTopicChange={setJourneyTopic}
                required={selectedUsers.size > 0}
              />

              {drillType !== "roleplay" && (
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Context (Optional)
                  </label>
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Additional context or notes"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none min-h-[100px]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                  Example Pronunciation URL (Optional)
                </label>
                <input
                  type="url"
                  value={audioExampleUrl}
                  onChange={(e) => setAudioExampleUrl(e.target.value)}
                  placeholder="https://example.com/audio.mp3"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Pre-generate TTS Audio Option */}
              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                <div className="flex items-start gap-3">
                  <div className="flex items-center h-6">
                    <input
                      type="checkbox"
                      id="generateTTS"
                      checked={generateTTSAudio}
                      onChange={(e) => setGenerateTTSAudio(e.target.checked)}
                      className="w-5 h-5 rounded text-green-600 focus:ring-green-500 accent-green-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="generateTTS" className="text-sm font-bold text-gray-900 cursor-pointer flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-green-600" />
                      Pre-generate Audio (Recommended)
                    </label>
                    <p className="text-xs text-gray-600 mt-1">
                      Generates TTS audio using ElevenLabs when saving. Audio is stored on Cloudinary for instant playback.
                      This reduces latency and API costs during student practice.
                    </p>
                    {isGeneratingAudio && (
                      <div className="flex items-center gap-2 mt-2 text-green-700">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs font-medium">{audioProgress}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* User Assignment */}
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold text-gray-900">
                User(s) Assignment<span className="text-red-500">*</span>
              </h2>
              <button
                onClick={toggleAllUsers}
                className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 text-gray-600 text-xs font-bold rounded-lg border border-gray-100 hover:bg-gray-100"
              >
                <Plus className="w-3 h-3" />{" "}
                {allFilteredSelected ? "Deselect all" : "Select all"}
              </button>
            </div>

            <div className="relative mb-6">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search students by name or email…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-100 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#418b43]/40 focus:outline-none focus:ring-2 focus:ring-[#418b43]/20"
              />
            </div>

            {loadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No users found
              </p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No students match your search.
              </p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                <div className="flex items-center gap-3 p-2">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAllUsers}
                    className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {studentSearch.trim()
                      ? `Select all shown (${filteredUsers.length})`
                      : "Select all Users"}
                  </span>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl space-y-4">
                  {filteredUsers.map((user) => {
                    const name =
                      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                      user.name || "Unknown";
                    const isSelected = selectedUsers.has(user._id.toString());
                    return (
                      <div
                        key={user._id}
                        className={`flex items-center gap-3 ${!isSelected ? "opacity-50" : ""
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleUser(user._id.toString())}
                          className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {name}
                          </p>
                          <p className="text-xs text-gray-400">{user.email}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-100 p-6 flex gap-4 z-10">
        <button
          onClick={handleSaveDrill}
          disabled={loading || saving || copying}
          className="px-8 py-3.5 bg-amber-400 text-amber-950 font-bold rounded-full hover:bg-amber-500 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : isEditMode ? (
            isAssignedDrill ? "Save Changes" : "Save Drill"
          ) : (
            "Save Drill"
          )}
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || saving || copying}
          className="px-8 py-3.5 bg-[#418b43] text-white font-bold rounded-full hover:bg-[#3a7c3b] transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {isEditMode ? "Updating..." : "Creating..."}
            </>
          ) : isEditMode && !isAssignedDrill ? (
            `Assign to ${selectedUsers.size} user${selectedUsers.size !== 1 ? "s" : ""}`
          ) : isEditMode ? (
            `Update Drill for ${selectedUsers.size} user${selectedUsers.size !== 1 ? "s" : ""}`
          ) : (
            `Create Drill for ${selectedUsers.size} user${selectedUsers.size !== 1 ? "s" : ""}`
          )}
        </button>
        <button
          onClick={handleCopyDrill}
          disabled={loading || saving || copying}
          className="px-8 py-3.5 bg-white border border-gray-200 text-gray-600 font-bold rounded-full hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {copying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Copying...
            </>
          ) : (
            "Copy Drill"
          )}
        </button>
        <button
          onClick={() => router.back()}
          disabled={loading || saving || copying}
          className="px-8 py-3.5 bg-white border border-gray-200 text-gray-600 font-bold rounded-full hover:bg-gray-50 transition-all disabled:opacity-50"
        >
          Cancel Drill
        </button>
      </div>

      {/* Reassignment confirmation */}
      {showReassignConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Update and reassign drill?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              This will reset all student progress for this drill — including
              assignments, attempts, and bookmarks — and create fresh assignments
              for the {selectedUsers.size} selected student
              {selectedUsers.size !== 1 ? "s" : ""}. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowReassignConfirm(false)}
                disabled={loading}
                className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 font-semibold rounded-full hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowReassignConfirm(false);
                  await executeSubmit();
                }}
                disabled={loading}
                className="px-5 py-2.5 bg-[#418b43] text-white font-semibold rounded-full hover:bg-[#3a7c3b] transition-all disabled:opacity-50"
              >
                Update Drill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content Preview Modal */}
      {showPreview && parsedContent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <ContentPreview
              parsedContent={parsedContent}
              onConfirm={handleApplyParsedContent}
              onCancel={() => {
                setShowPreview(false);
                setParsedContent(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default function CreateDrillPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-green-600" />
        </div>
      }
    >
      <CreateDrillPageContent />
    </Suspense>
  );
}
