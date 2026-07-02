"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  AIGenerationFormFieldValue,
  AIGenerationFormScalarField,
  AIGenerationFormValues,
  AiStudentOption,
} from "@/components/drills/AIGenerationForm";
import type { StudentContextData } from "@/lib/api";
import {
  composeStudentContextString,
  getWeekCompletionDate,
} from "@/lib/ai-user-builder/week-utils";
import type { LearningJourneyPartId } from "@/domain/learning-journey/learning-journey.catalog";
import {
  getPartLabel,
  getTopicById,
} from "@/domain/learning-journey/learning-journey.catalog";
import { normalizeAiGeneratedToParsedContent } from "@/utils/ai-drill-content";
import type { ParsedContent } from "@/services/document-parser.service";

export const AI_DRILL_PENDING_STORAGE_KEY = "eklana-ai-drill-pending";

export interface AIDrillPendingApply {
  parsed: ParsedContent;
  drillType: string;
  difficulty: string;
  studentIds: string[];
  journeyPart: LearningJourneyPartId | "";
  journeyTopic: string;
  completionDate?: string;
}

export interface AIDrillInitialContext {
  studentId?: string;
  weekNumber?: number;
  studentContext?: StudentContextData | null;
  anchorDate?: string | Date | null;
}

export interface UseAIDrillCreationWorkflowOptions {
  students: AiStudentOption[];
  initialContext?: AIDrillInitialContext;
  lockedStudentIds?: string[];
  onApplyParsedContent: (content: ParsedContent) => void;
  onUseDrillExtras?: (meta: {
    drillType: string;
    difficulty: string;
    studentIds: string[];
    journeyPart: LearningJourneyPartId | "";
    journeyTopic: string;
    completionDate?: string;
  }) => void;
  /** When set, navigates to builder instead of applying inline */
  onNavigateToBuilder?: (pending: AIDrillPendingApply) => void;
}

export function useAIDrillCreationWorkflow({
  students,
  initialContext,
  lockedStudentIds,
  onApplyParsedContent,
  onUseDrillExtras,
  onNavigateToBuilder,
}: UseAIDrillCreationWorkflowOptions) {
  const [aiStudentIds, setAiStudentIds] = useState<string[]>([]);
  const [aiDrillType, setAiDrillType] = useState("vocabulary");
  const [aiDifficulty, setAiDifficulty] = useState("intermediate");
  const [aiJourneyPart, setAiJourneyPart] = useState<LearningJourneyPartId | "">("");
  const [aiJourneyTopic, setAiJourneyTopic] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingDrill, setIsGeneratingDrill] = useState(false);
  const [aiGeneratedContent, setAiGeneratedContent] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [showAiPreview, setShowAiPreview] = useState(false);
  const [showChatSidebar, setShowChatSidebar] = useState(false);
  const [showAiFormModal, setShowAiFormModal] = useState(false);

  const contextStudentId = initialContext?.studentId;
  const contextProficiency = initialContext?.studentContext?.proficiencyLevel;
  const lockedStudentIdsKey = lockedStudentIds?.join(",") ?? "";

  const composedContext = useMemo(() => {
    if (!initialContext?.studentContext) return "";
    return composeStudentContextString(initialContext.studentContext);
  }, [
    initialContext?.studentContext?.professionalRole,
    initialContext?.studentContext?.hospitalUnit,
    initialContext?.studentContext?.country,
  ]);

  const effectiveLockedIds = useMemo(() => {
    if (lockedStudentIdsKey) {
      return lockedStudentIdsKey.split(",");
    }
    if (contextStudentId) {
      return [contextStudentId];
    }
    return undefined;
  }, [lockedStudentIdsKey, contextStudentId]);

  const initialSeedKey = useMemo(
    () =>
      [
        contextStudentId ?? "",
        contextProficiency ?? "",
        composedContext,
        lockedStudentIdsKey,
      ].join("|"),
    [contextStudentId, contextProficiency, composedContext, lockedStudentIdsKey],
  );

  const lastSeededKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialContext) return;
    if (lastSeededKeyRef.current === initialSeedKey) return;
    lastSeededKeyRef.current = initialSeedKey;

    if (effectiveLockedIds?.length) {
      setAiStudentIds((prev) => {
        if (
          prev.length === effectiveLockedIds.length &&
          prev.every((id, index) => id === effectiveLockedIds[index])
        ) {
          return prev;
        }
        return effectiveLockedIds;
      });
    } else if (contextStudentId) {
      setAiStudentIds((prev) =>
        prev.length === 1 && prev[0] === contextStudentId
          ? prev
          : [contextStudentId],
      );
    }

    if (contextProficiency) {
      setAiDifficulty((prev) =>
        prev === contextProficiency ? prev : contextProficiency,
      );
    }

    if (composedContext) {
      setAiContext((prev) =>
        prev === composedContext ? prev : composedContext,
      );
    }
  }, [
    initialContext,
    initialSeedKey,
    effectiveLockedIds,
    contextStudentId,
    contextProficiency,
    composedContext,
  ]);

  const completionDate = useMemo(() => {
    if (!initialContext?.weekNumber) return undefined;
    return getWeekCompletionDate(
      initialContext.weekNumber,
      initialContext.anchorDate,
    );
  }, [initialContext?.weekNumber, initialContext?.anchorDate]);

  const aiFormValues: AIGenerationFormValues = useMemo(
    () => ({
      studentIds: aiStudentIds,
      drillType: aiDrillType,
      difficulty: aiDifficulty,
      journeyPart: aiJourneyPart,
      journeyTopic: aiJourneyTopic,
      context: aiContext,
      prompt: aiPrompt,
    }),
    [
      aiStudentIds,
      aiDrillType,
      aiDifficulty,
      aiJourneyPart,
      aiJourneyTopic,
      aiContext,
      aiPrompt,
    ],
  );

  const handleAiFormChange = useCallback(
    (field: AIGenerationFormScalarField, value: AIGenerationFormFieldValue) => {
      switch (field) {
        case "drillType":
          setAiDrillType(value as string);
          break;
        case "difficulty":
          setAiDifficulty(value as string);
          break;
        case "journeyPart":
          setAiJourneyPart(value as LearningJourneyPartId | "");
          break;
        case "journeyTopic":
          setAiJourneyTopic(value as string);
          break;
        case "context":
          setAiContext(value as string);
          break;
        case "prompt":
          setAiPrompt(value as string);
          break;
      }
    },
    [],
  );

  const handleAIGenerate = useCallback(async () => {
    if (aiStudentIds.length === 0) {
      toast.error("Please select at least one student");
      return;
    }
    if (!aiJourneyPart) {
      toast.error("Please select a mission");
      return;
    }
    if (!aiJourneyTopic) {
      toast.error("Please select a topic");
      return;
    }
    if (!aiContext.trim()) {
      toast.error("Please enter a context/scenario");
      return;
    }
    if (!aiPrompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }
    try {
      setIsGeneratingDrill(true);
      const res = await fetch("/api/v1/drills/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          drillType: aiDrillType,
          difficulty: aiDifficulty,
          context: aiContext,
          prompt: aiPrompt,
          part: getPartLabel(aiJourneyPart),
          topic: getTopicById(aiJourneyTopic)?.title ?? "",
          studentId: aiStudentIds[0],
          studentIds: aiStudentIds,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message || "AI generation failed");
        return;
      }
      setAiGeneratedContent(json.data);
      setShowAiPreview(true);
      setShowChatSidebar(true);
      setShowAiFormModal(false);
      toast.success("Drill generated successfully");
    } catch {
      toast.error("AI generation failed");
    } finally {
      setIsGeneratingDrill(false);
    }
  }, [
    aiStudentIds,
    aiJourneyPart,
    aiJourneyTopic,
    aiContext,
    aiPrompt,
    aiDrillType,
    aiDifficulty,
  ]);

  const handleUseAiDrill = useCallback(() => {
    if (!aiGeneratedContent) return;

    if (aiDrillType === "definition") {
      toast.warning(
        "Definition drills are not yet supported in the manual builder.",
      );
    }

    const parsed = normalizeAiGeneratedToParsedContent(
      aiDrillType,
      aiGeneratedContent,
    );

    const meta = {
      drillType: aiDrillType,
      difficulty: aiDifficulty,
      studentIds: aiStudentIds,
      journeyPart: aiJourneyPart,
      journeyTopic: aiJourneyTopic,
      completionDate,
    };

    if (onNavigateToBuilder) {
      onNavigateToBuilder({ parsed, ...meta });
      setShowAiPreview(false);
      setShowChatSidebar(false);
      return;
    }

    onApplyParsedContent(parsed);
    onUseDrillExtras?.(meta);

    setShowAiPreview(false);
    setShowChatSidebar(false);
  }, [
    aiGeneratedContent,
    aiDrillType,
    aiDifficulty,
    aiStudentIds,
    aiJourneyPart,
    aiJourneyTopic,
    completionDate,
    onApplyParsedContent,
    onUseDrillExtras,
    onNavigateToBuilder,
  ]);

  return {
    students,
    aiFormValues,
    handleAiFormChange,
    setAiStudentIds,
    isGeneratingDrill,
    aiGeneratedContent,
    setAiGeneratedContent,
    showAiPreview,
    setShowAiPreview,
    showChatSidebar,
    setShowChatSidebar,
    showAiFormModal,
    setShowAiFormModal,
    aiDrillType,
    handleAIGenerate,
    handleUseAiDrill,
    lockedStudentIds: effectiveLockedIds,
    completionDate,
  };
}

export function readPendingAiDrillApply(): AIDrillPendingApply | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(AI_DRILL_PENDING_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AIDrillPendingApply;
  } catch {
    return null;
  }
}

export function storePendingAiDrillApply(pending: AIDrillPendingApply): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(AI_DRILL_PENDING_STORAGE_KEY, JSON.stringify(pending));
}

export function clearPendingAiDrillApply(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(AI_DRILL_PENDING_STORAGE_KEY);
}
