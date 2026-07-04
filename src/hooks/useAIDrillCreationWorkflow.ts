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
import { composeStudentContextString } from "@/lib/ai-drill-builder/week-utils";
import type { LearningJourneyPartId } from "@/domain/learning-journey/learning-journey.catalog";
import {
  getPartLabel,
  getTopicById,
} from "@/domain/learning-journey/learning-journey.catalog";
import { normalizeAiGeneratedToParsedContent } from "@/utils/ai-drill-content";
import type { ParsedContent } from "@/services/document-parser.service";

export const AI_DRILL_BULK_PENDING_STORAGE_KEY =
  "eklana-ai-drill-bulk-pending";

export interface AIGeneratedResult {
  drillType: string;
  content: Record<string, unknown>;
}

export interface AIDrillBulkPendingItem {
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
  /**
   * Called after "Use These Drills" stores the bulk-pending payload to sessionStorage.
   * The caller decides how to surface the wizard — navigate to the builder page, or
   * update local state to render it inline (when already on the builder page).
   */
  onBulkReady?: (pending: AIDrillBulkPendingItem[]) => void;
}

export function useAIDrillCreationWorkflow({
  students,
  initialContext,
  lockedStudentIds,
  onBulkReady,
}: UseAIDrillCreationWorkflowOptions) {
  const [aiStudentIds, setAiStudentIds] = useState<string[]>([]);
  const [aiDrillTypes, setAiDrillTypes] = useState<string[]>([]);
  const [aiDifficulty, setAiDifficulty] = useState("intermediate");
  const [aiJourneyPart, setAiJourneyPart] = useState<LearningJourneyPartId | "">("");
  const [aiJourneyTopic, setAiJourneyTopic] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingDrill, setIsGeneratingDrill] = useState(false);
  const [aiGeneratedResults, setAiGeneratedResults] = useState<
    AIGeneratedResult[] | null
  >(null);
  const [showAiPreview, setShowAiPreview] = useState(false);
  const [showChatSidebar, setShowChatSidebar] = useState(false);
  const [showAiFormModal, setShowAiFormModal] = useState(false);

  const contextStudentId = initialContext?.studentId;
  const contextProficiency = initialContext?.studentContext?.proficiencyLevel;
  const lockedStudentIdsKey = lockedStudentIds?.join(",") ?? "";

  // Deliberately depend on primitive fields (not the whole `initialContext` object,
  // which is often a fresh reference per render from callers) to avoid recomputing
  // on every render.
  const composedContext = useMemo(() => {
    if (!initialContext?.studentContext) return "";
    return composeStudentContextString(initialContext.studentContext);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const aiFormValues: AIGenerationFormValues = useMemo(
    () => ({
      studentIds: aiStudentIds,
      drillTypes: aiDrillTypes,
      difficulty: aiDifficulty,
      journeyPart: aiJourneyPart,
      journeyTopic: aiJourneyTopic,
      context: aiContext,
      prompt: aiPrompt,
    }),
    [
      aiStudentIds,
      aiDrillTypes,
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
    if (aiDrillTypes.length === 0) {
      toast.error("Please select at least one drill type");
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
          drillTypes: aiDrillTypes,
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
      const results: AIGeneratedResult[] = Array.isArray(json.data)
        ? json.data
        : [];
      setAiGeneratedResults(results);
      setShowAiPreview(true);
      setShowChatSidebar(true);
      setShowAiFormModal(false);
      toast.success(
        results.length > 1
          ? `${results.length} drills generated successfully`
          : "Drill generated successfully",
      );
    } catch {
      toast.error("AI generation failed");
    } finally {
      setIsGeneratingDrill(false);
    }
  }, [
    aiStudentIds,
    aiDrillTypes,
    aiJourneyPart,
    aiJourneyTopic,
    aiContext,
    aiPrompt,
    aiDifficulty,
  ]);

  const updateAiGeneratedResult = useCallback(
    (drillType: string, updatedContent: Record<string, unknown>) => {
      setAiGeneratedResults((prev) =>
        prev
          ? prev.map((r) =>
              r.drillType === drillType ? { ...r, content: updatedContent } : r,
            )
          : prev,
      );
    },
    [],
  );

  const handleUseTheseDrills = useCallback(() => {
    if (!aiGeneratedResults || aiGeneratedResults.length === 0) return;

    if (aiGeneratedResults.some((r) => r.drillType === "definition")) {
      toast.warning(
        "Definition drills are not yet supported in the manual builder.",
      );
    }

    const pendingItems: AIDrillBulkPendingItem[] = aiGeneratedResults.map(
      ({ drillType, content }) => ({
        parsed: normalizeAiGeneratedToParsedContent(drillType, content),
        drillType,
        difficulty: aiDifficulty,
        studentIds: aiStudentIds,
        journeyPart: aiJourneyPart,
        journeyTopic: aiJourneyTopic,
        completionDate: undefined,
      }),
    );

    storePendingBulkAiDrillApply(pendingItems);
    onBulkReady?.(pendingItems);

    setShowAiPreview(false);
    setShowChatSidebar(false);
  }, [
    aiGeneratedResults,
    aiDifficulty,
    aiStudentIds,
    aiJourneyPart,
    aiJourneyTopic,
    onBulkReady,
  ]);

  return {
    students,
    aiFormValues,
    handleAiFormChange,
    setAiStudentIds,
    setAiDrillTypes,
    isGeneratingDrill,
    aiGeneratedResults,
    setAiGeneratedResults,
    updateAiGeneratedResult,
    showAiPreview,
    setShowAiPreview,
    showChatSidebar,
    setShowChatSidebar,
    showAiFormModal,
    setShowAiFormModal,
    handleAIGenerate,
    handleUseTheseDrills,
    lockedStudentIds: effectiveLockedIds,
  };
}

export function readPendingBulkAiDrillApply(): AIDrillBulkPendingItem[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(AI_DRILL_BULK_PENDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AIDrillBulkPendingItem[]) : null;
  } catch {
    return null;
  }
}

export function storePendingBulkAiDrillApply(
  pending: AIDrillBulkPendingItem[],
): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    AI_DRILL_BULK_PENDING_STORAGE_KEY,
    JSON.stringify(pending),
  );
}

export function clearPendingBulkAiDrillApply(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(AI_DRILL_BULK_PENDING_STORAGE_KEY);
}
