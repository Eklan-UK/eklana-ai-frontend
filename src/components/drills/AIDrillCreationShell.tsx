"use client";

import React from "react";
import { AIGenerationModal } from "@/components/drills/AIGenerationModal";
import { AIGeneratedPreview } from "@/components/drills/AIGeneratedPreview";
import { AIChatSidebar } from "@/components/drills/AIChatSidebar";
import type {
  AiStudentOption,
  AIGenerationFormFieldValue,
  AIGenerationFormScalarField,
  AIGenerationFormValues,
} from "@/components/drills/AIGenerationForm";

interface AIDrillCreationShellProps {
  isEditMode?: boolean;
  showAiFormModal: boolean;
  setShowAiFormModal: (open: boolean) => void;
  aiFormValues: AIGenerationFormValues;
  handleAiFormChange: (
    field: AIGenerationFormScalarField,
    value: AIGenerationFormFieldValue,
  ) => void;
  setAiStudentIds: (ids: string[]) => void;
  students: AiStudentOption[];
  loadingStudents?: boolean;
  isGeneratingDrill: boolean;
  handleAIGenerate: () => void;
  lockedStudentIds?: string[];
  showAiPreview: boolean;
  aiDrillType: string;
  aiGeneratedContent: Record<string, unknown> | null;
  handleUseAiDrill: () => void;
  showChatSidebar: boolean;
  setShowChatSidebar: (open: boolean) => void;
  setAiGeneratedContent: (content: Record<string, unknown>) => void;
  setShowAiPreview: (show: boolean) => void;
  /** Optional slot for inline preview placement (e.g. week page layout) */
  previewPlacement?: "inline" | "portal";
  renderInlinePreview?: boolean;
  children?: React.ReactNode;
}

export function AIDrillCreationShell({
  isEditMode = false,
  showAiFormModal,
  setShowAiFormModal,
  aiFormValues,
  handleAiFormChange,
  setAiStudentIds,
  students,
  loadingStudents = false,
  isGeneratingDrill,
  handleAIGenerate,
  lockedStudentIds,
  showAiPreview,
  aiDrillType,
  aiGeneratedContent,
  handleUseAiDrill,
  showChatSidebar,
  setShowChatSidebar,
  setAiGeneratedContent,
  setShowAiPreview,
  renderInlinePreview = false,
  children,
}: AIDrillCreationShellProps) {
  const preview =
    !isEditMode && showAiPreview && aiGeneratedContent ? (
      <AIGeneratedPreview
        drillType={aiDrillType}
        content={aiGeneratedContent}
        onUseDrill={handleUseAiDrill}
      />
    ) : null;

  return (
    <>
      {renderInlinePreview && preview}
      {children}

      {!isEditMode && (
        <AIGenerationModal
          open={showAiFormModal}
          onClose={() => setShowAiFormModal(false)}
          values={aiFormValues}
          onChange={handleAiFormChange}
          onStudentIdsChange={setAiStudentIds}
          students={students}
          loadingStudents={loadingStudents}
          isGenerating={isGeneratingDrill}
          onGenerate={handleAIGenerate}
          lockedStudentIds={lockedStudentIds}
        />
      )}

      {!isEditMode && !renderInlinePreview && preview}

      {!isEditMode && aiGeneratedContent && (
        <AIChatSidebar
          open={showChatSidebar}
          onClose={() => setShowChatSidebar(false)}
          drillType={aiDrillType}
          currentDrill={aiGeneratedContent}
          onDrillUpdated={(updated) => {
            setAiGeneratedContent(updated);
            setShowAiPreview(true);
          }}
        />
      )}
    </>
  );
}
