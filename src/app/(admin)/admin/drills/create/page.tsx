"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  FileText,
  Plus,
  X,
  Calendar as CalendarIcon,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { drillAPI } from "@/lib/api";
import { adminService } from "@/services/admin.service";
import { toast } from "sonner";
import { useDrillById } from "@/hooks/useAdmin";
import { FileUploadZone } from "@/components/drills/FileUploadZone";
import { ContentPreview } from "@/components/drills/ContentPreview";
import { TemplateDownload } from "@/components/drills/TemplateDownload";
import { ClipboardPaste } from "@/components/drills/ClipboardPaste";
import { ParsedContent } from "@/services/document-parser.service";

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

interface MatchingPair {
  left: string;
  right: string;
  leftTranslation?: string;
  rightTranslation?: string;
}

interface DefinitionItem {
  word: string;
  hint?: string;
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

const DrillBuilder: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const drillId = searchParams.get("drillId") || searchParams.get("id");
  const isEditMode = !!drillId;

  // Vocabulary
  const [vocabularyItems, setVocabularyItems] = useState<VocabularyItem[]>([
    { word: "", wordTranslation: "", text: "", translation: "" },
  ]);

  // Roleplay
  const [studentCharacterName, setStudentCharacterName] = useState("");
  const [aiCharacterNames, setAiCharacterNames] = useState<string[]>([""]);
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

  // Definition
  const [definitionItems, setDefinitionItems] = useState<DefinitionItem[]>([
    { word: "", hint: "" },
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

  // Common fields
  const [drillTitle, setDrillTitle] = useState("");
  const [drillType, setDrillType] = useState("vocabulary");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [completionDate, setCompletionDate] = useState("");
  const [durationDays, setDurationDays] = useState(7);
  const [context, setContext] = useState("");
  const [audioExampleUrl, setAudioExampleUrl] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [parsedContent, setParsedContent] = useState<ParsedContent | null>(
    null
  );
  const [showPreview, setShowPreview] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  // Load drill data in edit mode
  const { data: drillData, isLoading: loadingDrill } = useDrillById(
    drillId || ""
  );

  useEffect(() => {
    // Set default completion date to 7 days from now
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    setCompletionDate(defaultDate.toISOString().split("T")[0]);

    // Fetch users with role 'user'
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const response = await adminService.getLearners({
          limit: 100,
          role: "user",
        });
        setUsers(response.users);
      } catch (error: any) {
        toast.error("Failed to load users: " + error.message);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

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

      // Set assigned users
      if (drill.assigned_to && Array.isArray(drill.assigned_to)) {
        const assignedEmails = new Set(drill.assigned_to);
        const assignedUserIds = new Set<string>();
        users.forEach((user: any) => {
          if (user.email && assignedEmails.has(user.email)) {
            assignedUserIds.add(user._id);
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
      } else if (drill.type === "roleplay") {
        setStudentCharacterName(drill.student_character_name || "");
        setAiCharacterNames(
          drill.ai_character_names && drill.ai_character_names.length > 0
            ? drill.ai_character_names
            : drill.ai_character_name
            ? [drill.ai_character_name]
            : [""]
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
      } else if (drill.type === "definition" && drill.definition_items) {
        setDefinitionItems(
          drill.definition_items.length > 0
            ? drill.definition_items.map((di: any) => ({
                word: di.word || "",
                hint: di.hint || "",
              }))
            : [{ word: "", hint: "" }]
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

  // Roleplay helpers
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
    if (aiCharacterNames.length < 3) {
      setAiCharacterNames([...aiCharacterNames, ""]);
    }
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

  // Definition helpers
  const addDefinitionItem = () => {
    setDefinitionItems([...definitionItems, { word: "", hint: "" }]);
  };

  const removeDefinitionItem = (index: number) => {
    setDefinitionItems(definitionItems.filter((_, i) => i !== index));
  };

  const updateDefinitionItem = (
    index: number,
    field: keyof DefinitionItem,
    value: string
  ) => {
    const updated = [...definitionItems];
    updated[index] = { ...updated[index], [field]: value };
    setDefinitionItems(updated);
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
    const updated = new Set(selectedUsers);
    if (updated.has(userId)) {
      updated.delete(userId);
    } else {
      updated.add(userId);
    }
    setSelectedUsers(updated);
  };

  const toggleAllUsers = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map((u) => u._id)));
    }
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
      case "definition":
        setDefinitionItems(items.length > 0 ? items : [{ word: "", hint: "" }]);
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
    }

    setShowPreview(false);
    setParsedContent(null);
    toast.success("Form populated with parsed data");
  };

  const handleSubmit = async () => {
    // Validation
    if (!drillTitle.trim()) {
      toast.error("Please enter a drill title");
      return;
    }

    if (!completionDate) {
      toast.error("Please select a completion date");
      return;
    }

    // Validate based on drill type
    if (drillType === "vocabulary") {
      if (
        vocabularyItems.length === 0 ||
        vocabularyItems.some((v) => !v.text.trim())
      ) {
        toast.error("Please add at least one vocabulary item with a sentence");
        return;
      }
    } else if (drillType === "roleplay") {
      if (!context.trim()) {
        toast.error("Please provide a context/scenario for the roleplay");
        return;
      }
      if (!studentCharacterName.trim()) {
        toast.error("Please provide a student character name");
        return;
      }
      if (aiCharacterNames.some((name) => !name.trim())) {
        toast.error("Please provide all AI character names");
        return;
      }
      if (
        roleplayScenes.length === 0 ||
        roleplayScenes.some(
          (s) => s.dialogue.length < 2 || s.dialogue.some((d) => !d.text.trim())
        )
      ) {
        toast.error("Please add at least one scene with complete dialogue");
        return;
      }
    } else if (drillType === "matching") {
      if (
        matchingPairs.length === 0 ||
        matchingPairs.some((p) => !p.left.trim() || !p.right.trim())
      ) {
        toast.error(
          "Please add at least one matching pair with both sides filled"
        );
        return;
      }
    } else if (drillType === "definition") {
      if (
        definitionItems.length === 0 ||
        definitionItems.some((d) => !d.word.trim())
      ) {
        toast.error("Please add at least one word for definition");
        return;
      }
    } else if (drillType === "grammar") {
      if (
        grammarItems.length === 0 ||
        grammarItems.some((g) => !g.pattern.trim())
      ) {
        toast.error("Please add at least one grammar pattern");
        return;
      }
    } else if (drillType === "sentence_writing") {
      if (
        sentenceWritingItems.length === 0 ||
        sentenceWritingItems.some((s) => !s.word.trim())
      ) {
        toast.error("Please add at least one word for sentence writing");
        return;
      }
    } else if (drillType === "summary") {
      if (!articleTitle.trim() || !articleContent.trim()) {
        toast.error("Please provide both article title and content");
        return;
      }
    }

    if (selectedUsers.size === 0) {
      toast.error("Please select at least one user");
      return;
    }

    try {
      setLoading(true);

      // Get user IDs for assignment (not emails)
      const assignedTo = Array.from(selectedUsers)
        .map((id) => id.toString())
        .filter(Boolean) as string[];

      // Build drill data based on type
      const drillData: any = {
        title: drillTitle,
        type: drillType,
        difficulty: difficulty.toLowerCase(),
        date: new Date(completionDate).toISOString(),
        duration_days: durationDays,
        assigned_to: assignedTo, // Now contains user IDs, not emails
        context: context || undefined,
        audio_example_url: audioExampleUrl || undefined,
      };

      // Add type-specific data BEFORE updating
      if (drillType === "vocabulary") {
        drillData.target_sentences = vocabularyItems
          .filter((v) => v.text.trim())
          .map((v) => ({
            word: v.word?.trim() || undefined,
            wordTranslation: v.wordTranslation?.trim() || undefined,
            text: v.text.trim(),
            translation: v.translation?.trim() || undefined,
          }));
      } else if (drillType === "roleplay") {
        drillData.student_character_name = studentCharacterName.trim();
        drillData.ai_character_names = aiCharacterNames.filter((name) =>
          name.trim()
        );
        drillData.roleplay_scenes = roleplayScenes.map((scene) => ({
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
        drillData.matching_pairs = matchingPairs
          .filter((p) => p.left.trim() && p.right.trim())
          .map((p) => ({
            left: p.left.trim(),
            right: p.right.trim(),
            leftTranslation: p.leftTranslation?.trim() || undefined,
            rightTranslation: p.rightTranslation?.trim() || undefined,
          }));
      } else if (drillType === "definition") {
        drillData.definition_items = definitionItems
          .filter((d) => d.word.trim())
          .map((d) => ({
            word: d.word.trim(),
            hint: d.hint?.trim() || undefined,
          }));
      } else if (drillType === "grammar") {
        drillData.grammar_items = grammarItems
          .filter((g) => g.pattern.trim())
          .map((g) => ({
            pattern: g.pattern.trim(),
            hint: g.hint?.trim() || undefined,
            example: g.example?.trim() || undefined,
          }));
      } else if (drillType === "sentence_writing") {
        drillData.sentence_writing_items = sentenceWritingItems
          .filter((s) => s.word.trim())
          .map((s) => ({
            word: s.word.trim(),
            hint: s.hint?.trim() || undefined,
          }));
      } else if (drillType === "summary") {
        drillData.article_title = articleTitle.trim();
        drillData.article_content = articleContent.trim();
      }

      // If editing, use update API
      if (isEditMode && drillId) {
        await drillAPI.update(drillId, drillData);
        toast.success("Drill updated successfully!");
        router.push("/admin/drill");
      } else {
        await drillAPI.create(drillData);
        toast.success("Drill created successfully!");
        router.push("/admin/drills/assignment");
      }
    } catch (error: any) {
      toast.error(
        "Failed to create drill: " + (error.message || "Unknown error")
      );
    } finally {
      setLoading(false);
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
                  {aiCharacterNames.length < 3 && (
                    <button
                      onClick={addAiCharacter}
                      className="flex items-center gap-1 px-3 py-1 bg-gray-50 text-[#3d8c40] text-xs font-bold rounded-lg hover:bg-emerald-50"
                    >
                      <Plus className="w-3 h-3" /> Add Character
                    </button>
                  )}
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
                      placeholder={`e.g. ${
                        idx === 0 ? "Waiter" : idx === 1 ? "Manager" : "Host"
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
                      className="p-6 bg-purple-50/30 rounded-2xl border border-purple-100"
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
                              className={`p-4 rounded-xl border ${
                                turn.speaker === "student"
                                  ? "bg-blue-50/30 border-blue-100"
                                  : "bg-purple-50/30 border-purple-100"
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

          {drillType === "definition" && (
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-bold text-gray-900">
                  Definition Items<span className="text-red-500">*</span>
                </h2>
                <button
                  onClick={addDefinitionItem}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-[#3d8c40] font-bold text-sm rounded-xl hover:bg-emerald-50"
                >
                  <Plus className="w-4 h-4" /> Add Word
                </button>
              </div>
              <div className="space-y-6">
                {definitionItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-6 bg-gray-50/50 rounded-2xl relative border border-gray-100"
                  >
                    <button
                      onClick={() => removeDefinitionItem(idx)}
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
                            updateDefinitionItem(idx, "word", e.target.value)
                          }
                          placeholder="e.g. Abundant"
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
                            updateDefinitionItem(idx, "hint", e.target.value)
                          }
                          placeholder="e.g. Think of 'a lot of something'"
                          className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                        />
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
                          Example Sentence (optional)
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
                      <option value="roleplay">Roleplay</option>
                      <option value="matching">Matching</option>
                      <option value="definition">Definition</option>
                      <option value="grammar">Grammar</option>
                      <option value="sentence_writing">Sentence Writing</option>
                      <option value="summary">Summary</option>
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
                {selectedUsers.size === users.length
                  ? "Deselect all"
                  : "Select all"}
              </button>
            </div>

            {loadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No users found
              </p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                <div className="flex items-center gap-3 p-2">
                  <input
                    type="checkbox"
                    checked={
                      selectedUsers.size === users.length && users.length > 0
                    }
                    onChange={toggleAllUsers}
                    className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Select all Users
                  </span>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl space-y-4">
                  {users.map((user) => {
                    const name =
                      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                      "Unknown";
                    const isSelected = selectedUsers.has(user._id);
                    return (
                      <div
                        key={user._id}
                        className={`flex items-center gap-3 ${
                          !isSelected ? "opacity-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleUser(user._id)}
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
          onClick={handleSubmit}
          disabled={loading}
          className="px-8 py-3.5 bg-[#418b43] text-white font-bold rounded-full hover:bg-[#3a7c3b] transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {isEditMode ? "Updating..." : "Creating..."}
            </>
          ) : isEditMode ? (
            `Update Drill for ${selectedUsers.size} user${
              selectedUsers.size !== 1 ? "s" : ""
            }`
          ) : (
            `Create Drill for ${selectedUsers.size} user${
              selectedUsers.size !== 1 ? "s" : ""
            }`
          )}
        </button>
        <button
          onClick={() => router.back()}
          disabled={loading}
          className="px-8 py-3.5 bg-white border border-gray-200 text-gray-600 font-bold rounded-full hover:bg-gray-50 transition-all disabled:opacity-50"
        >
          Cancel Drill
        </button>
      </div>

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

export default DrillBuilder;
