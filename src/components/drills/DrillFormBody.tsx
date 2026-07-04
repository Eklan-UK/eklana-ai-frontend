"use client";

import React, { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import {
  Plus,
  X,
  Calendar as CalendarIcon,
  ChevronDown,
  Loader2,
  Volume2,
  Search,
} from "lucide-react";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { LearningJourneyPartTopicFields } from "@/components/admin/LearningJourneyPartTopicFields";
import type {
  DrillDraft,
  VocabularyItem,
  PronunciationItem,
  MatchingPair,
  GrammarItem,
  SentenceWritingItem,
  RoleplayScene,
  KeyPhraseItem,
} from "@/components/drills/drill-draft.types";

export interface DrillFormBodyProps {
  draft: DrillDraft;
  /** Accepts a full new draft OR a functional updater — mirrors React's setState signature so
   *  multiple synchronous patchDraft calls compose correctly rather than last-write-wins. */
  onDraftChange: Dispatch<SetStateAction<DrillDraft>>;
  users: Array<{ _id: { toString(): string }; firstName?: string; lastName?: string; name?: string; email?: string }>;
  loadingUsers?: boolean;
  variant: "tutor" | "admin";
  drillTypeLocked?: boolean;
  studentSearch: string;
  onStudentSearchChange: (value: string) => void;
  isGeneratingAudio?: boolean;
  audioProgress?: string;
  layout?: "full" | "content-only";
  leadingContent?: React.ReactNode;
  sidebarLeadingContent?: React.ReactNode;
  onDrillTypeChange?: (newType: string) => void;
}

export function DrillFormBody({
  draft,
  onDraftChange,
  users,
  loadingUsers = false,
  drillTypeLocked = false,
  studentSearch,
  onStudentSearchChange,
  isGeneratingAudio = false,
  audioProgress = "",
  layout = "full",
  leadingContent,
  sidebarLeadingContent,
  onDrillTypeChange,
}: DrillFormBodyProps) {
  // Use the functional-update form so multiple synchronous patchDraft calls (e.g. from
  // LearningJourneyPartTopicFields firing onPartChange then onTopicChange in the same handler)
  // compose against the running prev state rather than all spreading the same stale snapshot.
  const patchDraft = useCallback(
    (partial: Partial<DrillDraft>) =>
      onDraftChange((prev) => ({ ...prev, ...partial })),
    [onDraftChange],
  );

  const addVocabularyItem = () => {
    patchDraft({
      vocabularyItems: [
        ...draft.vocabularyItems,
        { word: "", wordTranslation: "", text: "", translation: "" },
      ],
    });
  };

  const removeVocabularyItem = (index: number) => {
    patchDraft({
      vocabularyItems: draft.vocabularyItems.filter((_, i) => i !== index),
    });
  };

  const updateVocabularyItem = (
    index: number,
    field: keyof VocabularyItem,
    value: string,
  ) => {
    const updated = [...draft.vocabularyItems];
    updated[index] = { ...updated[index], [field]: value };
    patchDraft({ vocabularyItems: updated });
  };

  const addPronunciationItem = () => {
    patchDraft({
      pronunciationItems: [
        ...draft.pronunciationItems,
        { sound: "", word: "", sentence: "" },
      ],
    });
  };

  const removePronunciationItem = (index: number) => {
    if (draft.pronunciationItems.length <= 1) {
      patchDraft({ pronunciationItems: [{ sound: "", word: "", sentence: "" }] });
      return;
    }
    patchDraft({
      pronunciationItems: draft.pronunciationItems.filter((_, i) => i !== index),
    });
  };

  const updatePronunciationItem = (
    index: number,
    field: keyof PronunciationItem,
    value: string,
  ) => {
    const updated = [...draft.pronunciationItems];
    updated[index] = { ...updated[index], [field]: value };
    patchDraft({ pronunciationItems: updated });
  };

  const addRoleplayScene = () => {
    patchDraft({
      roleplayScenes: [
        ...draft.roleplayScenes,
        {
          scene_name: `Scene ${draft.roleplayScenes.length + 1}`,
          context: "",
          dialogue: [
            { speaker: "ai_0", text: "", translation: "" },
            { speaker: "student", text: "", translation: "" },
          ],
        },
      ],
    });
  };

  const removeRoleplayScene = (index: number) => {
    patchDraft({
      roleplayScenes: draft.roleplayScenes.filter((_, i) => i !== index),
    });
  };

  const addAiCharacter = () => {
    patchDraft({ aiCharacterNames: [...draft.aiCharacterNames, ""] });
  };

  const removeAiCharacter = (index: number) => {
    if (draft.aiCharacterNames.length > 1) {
      patchDraft({
        aiCharacterNames: draft.aiCharacterNames.filter((_, i) => i !== index),
      });
    }
  };

  const addDialogueTurn = (sceneIndex: number) => {
    const scenes = [...draft.roleplayScenes];
    const dialogue = scenes[sceneIndex].dialogue || [];
    const lastTurn = dialogue[dialogue.length - 1];
    const nextSpeaker = lastTurn?.speaker === "student" ? "ai_0" : "student";
    scenes[sceneIndex] = {
      ...scenes[sceneIndex],
      dialogue: [...dialogue, { speaker: nextSpeaker, text: "", translation: "" }],
    };
    patchDraft({ roleplayScenes: scenes });
  };

  const removeDialogueTurn = (sceneIndex: number, turnIndex: number) => {
    const scenes = [...draft.roleplayScenes];
    if (scenes[sceneIndex].dialogue.length > 2) {
      scenes[sceneIndex] = {
        ...scenes[sceneIndex],
        dialogue: scenes[sceneIndex].dialogue.filter((_, i) => i !== turnIndex),
      };
      patchDraft({ roleplayScenes: scenes });
    }
  };

  const updateRoleplayScene = (sceneIndex: number, partial: Partial<RoleplayScene>) => {
    const scenes = [...draft.roleplayScenes];
    scenes[sceneIndex] = { ...scenes[sceneIndex], ...partial };
    patchDraft({ roleplayScenes: scenes });
  };

  const updateDialogueTurn = (
    sceneIndex: number,
    turnIndex: number,
    partial: Partial<RoleplayScene["dialogue"][0]>,
  ) => {
    const scenes = [...draft.roleplayScenes];
    const dialogue = [...scenes[sceneIndex].dialogue];
    dialogue[turnIndex] = { ...dialogue[turnIndex], ...partial };
    scenes[sceneIndex] = { ...scenes[sceneIndex], dialogue };
    patchDraft({ roleplayScenes: scenes });
  };

  const addMatchingPair = () => {
    patchDraft({
      matchingPairs: [
        ...draft.matchingPairs,
        { left: "", right: "", leftTranslation: "", rightTranslation: "" },
      ],
    });
  };

  const removeMatchingPair = (index: number) => {
    patchDraft({
      matchingPairs: draft.matchingPairs.filter((_, i) => i !== index),
    });
  };

  const updateMatchingPair = (
    index: number,
    field: keyof MatchingPair,
    value: string,
  ) => {
    const updated = [...draft.matchingPairs];
    updated[index] = { ...updated[index], [field]: value };
    patchDraft({ matchingPairs: updated });
  };

  const addGrammarItem = () => {
    patchDraft({
      grammarItems: [...draft.grammarItems, { pattern: "", hint: "", example: "" }],
    });
  };

  const removeGrammarItem = (index: number) => {
    patchDraft({
      grammarItems: draft.grammarItems.filter((_, i) => i !== index),
    });
  };

  const updateGrammarItem = (
    index: number,
    field: keyof GrammarItem,
    value: string,
  ) => {
    const updated = [...draft.grammarItems];
    updated[index] = { ...updated[index], [field]: value };
    patchDraft({ grammarItems: updated });
  };

  const addSentenceWritingItem = () => {
    patchDraft({
      sentenceWritingItems: [...draft.sentenceWritingItems, { word: "", hint: "" }],
    });
  };

  const removeSentenceWritingItem = (index: number) => {
    patchDraft({
      sentenceWritingItems: draft.sentenceWritingItems.filter((_, i) => i !== index),
    });
  };

  const updateSentenceWritingItem = (
    index: number,
    field: keyof SentenceWritingItem,
    value: string,
  ) => {
    const updated = [...draft.sentenceWritingItems];
    updated[index] = { ...updated[index], [field]: value };
    patchDraft({ sentenceWritingItems: updated });
  };

  const addFillBlankItem = () => {
    patchDraft({
      fillBlankItems: [
        ...draft.fillBlankItems,
        {
          sentence: "",
          blanks: [{ position: 0, correctAnswer: "", options: ["", ""], hint: "" }],
          translation: "",
        },
      ],
    });
  };

  const removeFillBlankItem = (itemIndex: number) => {
    patchDraft({
      fillBlankItems: draft.fillBlankItems.filter((_, i) => i !== itemIndex),
    });
  };

  const updateFillBlankSentence = (itemIndex: number, sentence: string) => {
    const updated = [...draft.fillBlankItems];
    updated[itemIndex] = { ...updated[itemIndex], sentence };
    patchDraft({ fillBlankItems: updated });
  };

  const addFillBlankBlank = (itemIndex: number) => {
    const updated = [...draft.fillBlankItems];
    const blanks = [...updated[itemIndex].blanks];
    blanks.push({
      position: blanks.length,
      correctAnswer: "",
      options: ["", ""],
      hint: "",
    });
    updated[itemIndex] = { ...updated[itemIndex], blanks };
    patchDraft({ fillBlankItems: updated });
  };

  const removeFillBlankBlank = (itemIndex: number, blankIndex: number) => {
    const updated = [...draft.fillBlankItems];
    let blanks = updated[itemIndex].blanks.filter((_, i) => i !== blankIndex);
    blanks = blanks.map((b, i) => ({ ...b, position: i }));
    updated[itemIndex] = { ...updated[itemIndex], blanks };
    patchDraft({ fillBlankItems: updated });
  };

  const updateFillBlankCorrectAnswer = (
    itemIndex: number,
    blankIndex: number,
    correctAnswer: string,
  ) => {
    const updated = [...draft.fillBlankItems];
    const blank = { ...updated[itemIndex].blanks[blankIndex], correctAnswer };
    const options = [...blank.options];
    if (!options.includes(correctAnswer) && correctAnswer) {
      blank.options = [correctAnswer, ...options.filter((o) => o)];
    }
    const blanks = [...updated[itemIndex].blanks];
    blanks[blankIndex] = blank;
    updated[itemIndex] = { ...updated[itemIndex], blanks };
    patchDraft({ fillBlankItems: updated });
  };

  const updateFillBlankOption = (
    itemIndex: number,
    blankIndex: number,
    optionIndex: number,
    value: string,
  ) => {
    const updated = [...draft.fillBlankItems];
    const blanks = [...updated[itemIndex].blanks];
    const options = [...blanks[blankIndex].options];
    options[optionIndex] = value;
    blanks[blankIndex] = { ...blanks[blankIndex], options };
    updated[itemIndex] = { ...updated[itemIndex], blanks };
    patchDraft({ fillBlankItems: updated });
  };

  const addFillBlankOption = (itemIndex: number, blankIndex: number) => {
    const updated = [...draft.fillBlankItems];
    const blanks = [...updated[itemIndex].blanks];
    const options = [...blanks[blankIndex].options, ""];
    blanks[blankIndex] = { ...blanks[blankIndex], options };
    updated[itemIndex] = { ...updated[itemIndex], blanks };
    patchDraft({ fillBlankItems: updated });
  };

  const removeFillBlankOption = (
    itemIndex: number,
    blankIndex: number,
    optionIndex: number,
  ) => {
    const updated = [...draft.fillBlankItems];
    const blanks = [...updated[itemIndex].blanks];
    const options = blanks[blankIndex].options.filter((_, i) => i !== optionIndex);
    blanks[blankIndex] = { ...blanks[blankIndex], options };
    updated[itemIndex] = { ...updated[itemIndex], blanks };
    patchDraft({ fillBlankItems: updated });
  };

  const updateFillBlankHint = (
    itemIndex: number,
    blankIndex: number,
    hint: string,
  ) => {
    const updated = [...draft.fillBlankItems];
    const blanks = [...updated[itemIndex].blanks];
    blanks[blankIndex] = { ...blanks[blankIndex], hint };
    updated[itemIndex] = { ...updated[itemIndex], blanks };
    patchDraft({ fillBlankItems: updated });
  };

  const addKeyPhraseItem = () => {
    patchDraft({
      keyPhraseItems: [
        ...draft.keyPhraseItems,
        { respondentName: "", prompt: "", options: ["", ""], correctAnswer: "" },
      ],
    });
  };

  const removeKeyPhraseItem = (itemIndex: number) => {
    patchDraft({
      keyPhraseItems: draft.keyPhraseItems.filter((_, i) => i !== itemIndex),
    });
  };

  const updateKeyPhraseField = (
    itemIndex: number,
    field: keyof KeyPhraseItem,
    value: string,
  ) => {
    const updated = [...draft.keyPhraseItems];
    updated[itemIndex] = { ...updated[itemIndex], [field]: value };
    patchDraft({ keyPhraseItems: updated });
  };

  const updateKeyPhraseOption = (
    itemIndex: number,
    optIndex: number,
    value: string,
  ) => {
    const updated = [...draft.keyPhraseItems];
    const wasCorrect =
      updated[itemIndex].correctAnswer === updated[itemIndex].options[optIndex];
    const options = [...updated[itemIndex].options];
    options[optIndex] = value;
    updated[itemIndex] = { ...updated[itemIndex], options };
    if (wasCorrect) updated[itemIndex].correctAnswer = value;
    patchDraft({ keyPhraseItems: updated });
  };

  const removeKeyPhraseOption = (itemIndex: number, optIndex: number) => {
    const updated = [...draft.keyPhraseItems];
    const removedOpt = updated[itemIndex].options[optIndex];
    const options = updated[itemIndex].options.filter((_, i) => i !== optIndex);
    updated[itemIndex] = { ...updated[itemIndex], options };
    if (updated[itemIndex].correctAnswer === removedOpt) {
      updated[itemIndex].correctAnswer = "";
    }
    patchDraft({ keyPhraseItems: updated });
  };

  const addKeyPhraseOption = (itemIndex: number) => {
    const updated = [...draft.keyPhraseItems];
    updated[itemIndex] = {
      ...updated[itemIndex],
      options: [...updated[itemIndex].options, ""],
    };
    patchDraft({ keyPhraseItems: updated });
  };

  const toggleUser = (userId: string) => {
    const id = userId.toString();
    const selected = draft.selectedUsers;
    if (selected.includes(id)) {
      patchDraft({ selectedUsers: selected.filter((u) => u !== id) });
    } else {
      patchDraft({ selectedUsers: [...selected, id] });
    }
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
    filteredUsers.every((user) => draft.selectedUsers.includes(user._id.toString()));

  const toggleAllUsers = () => {
    const targetIds = filteredUsers.map((u) => u._id.toString());
    if (allFilteredSelected) {
      patchDraft({
        selectedUsers: draft.selectedUsers.filter((id) => !targetIds.includes(id)),
      });
      return;
    }
    const merged = new Set([...draft.selectedUsers, ...targetIds]);
    patchDraft({ selectedUsers: Array.from(merged) });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      <div className="xl:col-span-2 space-y-8">
          {leadingContent}
          {draft.drillType === "vocabulary" && (
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
                {draft.vocabularyItems.map((item, idx) => (
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

          {draft.drillType === "pronunciation" && (
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
                {draft.pronunciationItems.map((p, idx) => (
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

          {draft.drillType === "roleplay" && (
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                  Context / Scenario<span className="text-red-500">*</span>
                </label>
                <textarea
                  value={draft.context}
                  onChange={(e) => patchDraft({ context: e.target.value })}
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
                  value={draft.studentCharacterName}
                  onChange={(e) => patchDraft({ studentCharacterName: e.target.value })}
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
                {draft.aiCharacterNames.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        patchDraft({ aiCharacterNames: draft.aiCharacterNames.map((n, i) => (i === idx ? e.target.value : n)) })
                      }}
                      placeholder={`e.g. ${idx === 0 ? "Waiter" : idx === 1 ? "Manager" : "Host"
                        }`}
                      className="flex-1 px-4 py-3 bg-white border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    {draft.aiCharacterNames.length > 1 && (
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
                  value={draft.drillIntro}
                  onChange={(e) => patchDraft({ drillIntro: e.target.value })}
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
                  {draft.roleplayScenes.map((scene, sceneIdx) => (
                    <div
                      key={sceneIdx}
                      className="p-6 bg-primary-50/30 rounded-2xl border border-primary-100"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <input
                          type="text"
                          value={scene.scene_name}
                          onChange={(e) => {
                            updateRoleplayScene(sceneIdx, { scene_name: e.target.value })
                          }}
                          placeholder="Scene name"
                          className="px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm font-bold"
                        />
                        {draft.roleplayScenes.length > 1 && (
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
                            updateRoleplayScene(sceneIdx, { context: e.target.value })
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
                                    updateDialogueTurn(sceneIdx, turnIdx, { speaker: e.target.value })
                                  }}
                                  className="px-3 py-1 bg-white border border-gray-100 rounded-lg text-xs"
                                >
                                  <option value="student">
                                    {draft.studentCharacterName || "Student"}
                                  </option>
                                  {draft.aiCharacterNames.map((name, aiIdx) => (
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
                                  updateDialogueTurn(sceneIdx, turnIdx, { text: e.target.value })
                                }}
                                placeholder="English text"
                                className="w-full px-3 py-2 bg-white border border-gray-100 rounded-lg mb-2"
                              />
                              <input
                                type="text"
                                value={turn.translation || ""}
                                onChange={(e) => {
                                  updateDialogueTurn(sceneIdx, turnIdx, { translation: e.target.value })
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

          {draft.drillType === "matching" && (
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
                {draft.matchingPairs.map((pair, idx) => (
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


          {draft.drillType === "grammar" && (
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
                {draft.grammarItems.map((item, idx) => (
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

          {draft.drillType === "sentence_writing" && (
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
                {draft.sentenceWritingItems.map((item, idx) => (
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

          {draft.drillType === "summary" && (
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
                    value={draft.articleTitle}
                    onChange={(e) => patchDraft({ articleTitle: e.target.value })}
                    placeholder="e.g. Climate Change Effects on Ocean Life"
                    className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Article Content<span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={draft.articleContent}
                    onChange={(e) => patchDraft({ articleContent: e.target.value })}
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

          {draft.drillType === "listening" && (
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
                    value={draft.listeningTitle}
                    onChange={(e) => patchDraft({ listeningTitle: e.target.value })}
                    placeholder="e.g. Daily News Update, Story Time, etc."
                    className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Content<span className="text-red-500">*</span>
                  </label>
                  <RichTextEditor
                    value={draft.listeningContent}
                    onChange={(v) => patchDraft({ listeningContent: v })}
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

          {draft.drillType === "fill_blank" && (
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">
                  Fill in the Blank Sentences<span className="text-red-500">*</span>
                </h2>
                <button
                  type="button"
                  onClick={addFillBlankItem}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Sentence
                </button>
              </div>
              <div className="space-y-6">
                {draft.fillBlankItems.map((item, itemIndex) => (
                  <div key={itemIndex} className="border border-gray-200 rounded-xl p-6 bg-gray-50">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">
                        Sentence {itemIndex + 1}
                      </h3>
                      {draft.fillBlankItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFillBlankItem(itemIndex)}
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
                            updateFillBlankSentence(itemIndex, e.target.value)
                          }}
                          placeholder='e.g., "I ___ to the store ___ buy milk." (Use ___ for blanks)'
                          className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Use &quot;___&quot; (three underscores) to mark where blanks should appear
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
                            onClick={() => addFillBlankBlank(itemIndex)}
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
                                  onClick={() => removeFillBlankBlank(itemIndex, blankIndex)}
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
                                  onChange={(e) => updateFillBlankCorrectAnswer(itemIndex, blankIndex, e.target.value)}
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
                                      onChange={(e) =>
                                        updateFillBlankOption(
                                          itemIndex,
                                          blankIndex,
                                          optionIndex,
                                          e.target.value,
                                        )
                                      }
                                      placeholder={`Option ${optionIndex + 1}`}
                                      className="flex-1 px-4 py-3 bg-white border border-gray-100 rounded-xl"
                                    />
                                    {blank.options.length > 2 && (
                                      <button
                                        type="button"
                                        onClick={() => removeFillBlankOption(itemIndex, blankIndex, optionIndex)}
                                        className="text-red-500 hover:text-red-700 px-2"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => addFillBlankOption(itemIndex, blankIndex)}
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
                                  onChange={(e) => updateFillBlankHint(itemIndex, blankIndex, e.target.value)}
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
          {draft.drillType === "key_phrases" && (
            <div className="space-y-4">
              {draft.keyPhraseItems.map((item, itemIndex) => (
                <div key={itemIndex} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-gray-700">Question {itemIndex + 1}</h3>
                    {draft.keyPhraseItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeKeyPhraseItem(itemIndex)}
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
                      onChange={(e) => updateKeyPhraseField(itemIndex, "respondentName", e.target.value)}
                      placeholder="e.g. Waiter, Colleague, Interviewer"
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">Prompt (situation / question)<span className="text-red-500">*</span></label>
                    <textarea
                      rows={2}
                      value={item.prompt}
                      onChange={(e) => updateKeyPhraseField(itemIndex, "prompt", e.target.value)}
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
                            onChange={(e) => updateKeyPhraseOption(itemIndex, optIndex, e.target.value)}
                            placeholder={`Option ${optIndex + 1}`}
                            className="flex-1 px-4 py-2.5 bg-white border border-gray-100 rounded-xl"
                          />
                          {item.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeKeyPhraseOption(itemIndex, optIndex)}
                              className="text-red-400 hover:text-red-600 px-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addKeyPhraseOption(itemIndex)}
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
                      onChange={(e) => updateKeyPhraseField(itemIndex, "correctAnswer", e.target.value)}
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
                onClick={addKeyPhraseItem}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white text-sm rounded-xl hover:bg-emerald-600"
              >
                <Plus className="w-4 h-4" />
                Add Question
              </button>
            </div>
          )}
      </div>

      <div className="space-y-8">
          {sidebarLeadingContent}
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-8">
              Drill Settings
            </h2>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Drill title (optional)
                  </label>
                  <input
                    type="text"
                    value={draft.drillTitle}
                    onChange={(e) => patchDraft({ drillTitle: e.target.value })}
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
                      value={draft.completionDate}
                      onChange={(e) => patchDraft({ completionDate: e.target.value })}
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
                    value={draft.durationDays}
                    onChange={(e) =>
                      patchDraft({ durationDays: parseInt(e.target.value, 10) || 7 })
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
                      value={draft.drillType}
                      disabled={drillTypeLocked}
                      onChange={(e) => {
                        const newType = e.target.value;
                        patchDraft({ drillType: newType });
                        onDrillTypeChange?.(newType);
                      }}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
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
                      value={draft.difficulty}
                      onChange={(e) => patchDraft({ difficulty: e.target.value })}
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
                journeyPart={draft.journeyPart}
                journeyTopic={draft.journeyTopic}
                onPartChange={(v) => patchDraft({ journeyPart: v })}
                onTopicChange={(v) => patchDraft({ journeyTopic: v })}
                required
              />

              {draft.drillType !== "roleplay" && (
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Context (Optional)
                  </label>
                  <textarea
                    value={draft.context}
                    onChange={(e) => patchDraft({ context: e.target.value })}
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
                  value={draft.audioExampleUrl}
                  onChange={(e) => patchDraft({ audioExampleUrl: e.target.value })}
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
                      checked={draft.generateTTSAudio}
                      onChange={(e) => patchDraft({ generateTTSAudio: e.target.checked })}
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
        {layout !== "content-only" && (
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
                onChange={(e) => onStudentSearchChange(e.target.value)}
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
                    const isSelected = draft.selectedUsers.includes(user._id.toString());
                    return (
                      <div
                        key={user._id.toString()}
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
        )}
      </div>
    </div>
  );
}
