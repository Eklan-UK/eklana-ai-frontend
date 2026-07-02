"use client";

import React from "react";
import { X } from "lucide-react";
import {
  AIGenerationForm,
  type AiStudentOption,
  type AIGenerationFormValues,
  type AIGenerationFormScalarField,
  type AIGenerationFormFieldValue,
} from "@/components/drills/AIGenerationForm";

interface AIGenerationModalProps {
  open: boolean;
  onClose: () => void;
  values: AIGenerationFormValues;
  onChange: (
    field: AIGenerationFormScalarField,
    value: AIGenerationFormFieldValue,
  ) => void;
  onStudentIdsChange: (studentIds: string[]) => void;
  students: AiStudentOption[];
  loadingStudents?: boolean;
  isGenerating?: boolean;
  onGenerate: () => void;
  lockedStudentIds?: string[];
}

export const AIGenerationModal: React.FC<AIGenerationModalProps> = ({
  open,
  onClose,
  values,
  onChange,
  onStudentIdsChange,
  students,
  loadingStudents = false,
  isGenerating = false,
  onGenerate,
  lockedStudentIds,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Generate Drill with AI
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              AI will create drill content for you to review before applying.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <AIGenerationForm
            variant="modal"
            values={values}
            onChange={onChange}
            onStudentIdsChange={onStudentIdsChange}
            students={students}
            loadingStudents={loadingStudents}
            isGenerating={isGenerating}
            onGenerate={onGenerate}
            lockedStudentIds={lockedStudentIds}
          />
        </div>
      </div>
    </div>
  );
};
