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
import type { AIGeneratedResult } from "@/hooks/useAIDrillCreationWorkflow";

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
  setAiDrillTypes: (types: string[]) => void;
  students: AiStudentOption[];
  loadingStudents?: boolean;
  isGeneratingDrill: boolean;
  handleAIGenerate: () => void;
  lockedStudentIds?: string[];
  builderVariant?: "tutor" | "admin";
  showAiPreview: boolean;
  aiGeneratedResults: AIGeneratedResult[] | null;
  handleUseTheseDrills: () => void;
  showChatSidebar: boolean;
  setShowChatSidebar: (open: boolean) => void;
  updateAiGeneratedResult: (
    drillType: string,
    updatedContent: Record<string, unknown>,
  ) => void;
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
  setAiDrillTypes,
  students,
  loadingStudents = false,
  isGeneratingDrill,
  handleAIGenerate,
  lockedStudentIds,
  builderVariant = "tutor",
  showAiPreview,
  aiGeneratedResults,
  handleUseTheseDrills,
  showChatSidebar,
  setShowChatSidebar,
  updateAiGeneratedResult,
  setShowAiPreview,
  renderInlinePreview = false,
  children,
}: AIDrillCreationShellProps) {
  const preview =
    !isEditMode && showAiPreview && aiGeneratedResults && aiGeneratedResults.length > 0 ? (
      <AIGeneratedPreview
        results={aiGeneratedResults}
        onUseDrills={handleUseTheseDrills}
        onEditSettings={() => setShowAiFormModal(true)}
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
          onDrillTypesChange={setAiDrillTypes}
          students={students}
          loadingStudents={loadingStudents}
          isGenerating={isGeneratingDrill}
          onGenerate={handleAIGenerate}
          lockedStudentIds={lockedStudentIds}
          builderVariant={builderVariant}
        />
      )}

      {!isEditMode && !renderInlinePreview && preview}

      {!isEditMode && aiGeneratedResults && aiGeneratedResults.length > 0 && (
        <AIChatSidebar
          open={showChatSidebar}
          onClose={() => setShowChatSidebar(false)}
          results={aiGeneratedResults}
          onDrillUpdated={(drillType, updated) => {
            updateAiGeneratedResult(drillType, updated);
            setShowAiPreview(true);
          }}
        />
      )}
    </>
  );
}
