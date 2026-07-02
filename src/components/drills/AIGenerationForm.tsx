"use client";

import React, { useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { LearningJourneyPartTopicFields } from "@/components/admin/LearningJourneyPartTopicFields";
import type { LearningJourneyPartId } from "@/domain/learning-journey/learning-journey.catalog";
import { AI_DRILL_TYPES, AI_DIFFICULTIES } from "@/constants/ai-drill";

export interface AiStudentOption {
  id: string;
  label: string;
  email?: string;
}

export interface AIGenerationFormValues {
  studentIds: string[];
  drillType: string;
  difficulty: string;
  journeyPart: LearningJourneyPartId | "";
  journeyTopic: string;
  context: string;
  prompt: string;
}

export type AIGenerationFormScalarField = Exclude<
  keyof AIGenerationFormValues,
  "studentIds"
>;

export type AIGenerationFormFieldValue =
  AIGenerationFormValues[AIGenerationFormScalarField];

interface AIGenerationFormProps {
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
  disabled?: boolean;
  /** page = standalone card; modal = fields only (used inside AIGenerationModal) */
  variant?: "page" | "modal";
  /** When set, student multi-select is locked to these IDs */
  lockedStudentIds?: string[];
}

const selectClass =
  "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

function AiStudentMultiSelect({
  students,
  selectedIds,
  onChange,
  loading,
  disabled,
}: {
  students: AiStudentOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return students;
    return students.filter(
      (s) =>
        s.label.toLowerCase().includes(query) ||
        s.email?.toLowerCase().includes(query),
    );
  }, [students, search]);

  const allFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedSet.has(s.id));

  const toggleStudent = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(Array.from(next));
  };

  const toggleAllFiltered = () => {
    const next = new Set(selectedIds);
    if (allFilteredSelected) {
      filteredStudents.forEach((s) => next.delete(s.id));
    } else {
      filteredStudents.forEach((s) => next.add(s.id));
    }
    onChange(Array.from(next));
  };

  const selectedStudents = students.filter((s) => selectedSet.has(s.id));

  return (
    <div className="space-y-3">
      {selectedStudents.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedStudents.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 text-xs font-medium rounded-lg border border-emerald-200"
            >
              {s.label}
              <button
                type="button"
                onClick={() => toggleStudent(s.id)}
                disabled={disabled}
                className="text-emerald-600 hover:text-emerald-900 disabled:opacity-50"
                aria-label={`Remove ${s.label}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={loading || disabled}
          placeholder="Search students by name or email…"
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 text-center py-4">Loading students…</p>
      ) : students.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No students found</p>
      ) : filteredStudents.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          No students match your search.
        </p>
      ) : (
        <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/50">
          <label className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white sticky top-0 cursor-pointer">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleAllFiltered}
              disabled={disabled}
              className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
            />
            <span className="text-xs font-medium text-gray-600">
              {search.trim()
                ? `Select all shown (${filteredStudents.length})`
                : "Select all students"}
            </span>
          </label>
          <div className="divide-y divide-gray-100">
            {filteredStudents.map((student) => {
              const isSelected = selectedSet.has(student.id);
              return (
                <label
                  key={student.id}
                  className={`flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-white ${
                    !isSelected ? "opacity-70" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleStudent(student.id)}
                    disabled={disabled}
                    className="w-4 h-4 mt-0.5 rounded text-emerald-600 accent-emerald-600 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {student.label}
                    </p>
                    {student.email && (
                      <p className="text-xs text-gray-400 truncate">
                        {student.email}
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        {selectedIds.length === 0
          ? "Select at least one student"
          : `${selectedIds.length} student${selectedIds.length !== 1 ? "s" : ""} selected`}
      </p>
    </div>
  );
}

export const AIGenerationForm: React.FC<AIGenerationFormProps> = ({
  values,
  onChange,
  onStudentIdsChange,
  students,
  loadingStudents = false,
  isGenerating = false,
  onGenerate,
  disabled = false,
  variant = "page",
  lockedStudentIds,
}) => {
  const isStudentLocked = !!lockedStudentIds?.length;
  const effectiveStudentIds = isStudentLocked
    ? lockedStudentIds!
    : values.studentIds;

  const fields = (
    <div className="space-y-4">
      <div>
        <Label className="block text-xs font-bold text-gray-600 mb-1.5">
          Students <span className="text-red-500">*</span>
        </Label>
        {isStudentLocked ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5">
            <div className="flex flex-wrap gap-2">
              {students
                .filter((s) => lockedStudentIds!.includes(s.id))
                .map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-800 text-xs font-medium rounded-lg border border-emerald-200"
                  >
                    {s.label}
                  </span>
                ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Student is locked for this week&apos;s drill creation.
            </p>
          </div>
        ) : (
          <AiStudentMultiSelect
            students={students}
            selectedIds={effectiveStudentIds}
            onChange={onStudentIdsChange}
            loading={loadingStudents}
            disabled={disabled || isGenerating}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="block text-xs font-bold text-gray-600 mb-1.5">
            Drill Type <span className="text-red-500">*</span>
          </Label>
          <select
            value={values.drillType}
            onChange={(e) => onChange("drillType", e.target.value)}
            disabled={disabled}
            className={selectClass}
          >
            {AI_DRILL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="block text-xs font-bold text-gray-600 mb-1.5">
            Difficulty <span className="text-red-500">*</span>
          </Label>
          <select
            value={values.difficulty}
            onChange={(e) => onChange("difficulty", e.target.value)}
            disabled={disabled}
            className={selectClass}
          >
            {AI_DIFFICULTIES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <LearningJourneyPartTopicFields
        journeyPart={values.journeyPart}
        journeyTopic={values.journeyTopic}
        onPartChange={(part) => {
          onChange("journeyPart", part);
          onChange("journeyTopic", "");
        }}
        onTopicChange={(topic) => onChange("journeyTopic", topic)}
        required
      />

      <div>
        <Label className="block text-xs font-bold text-gray-600 mb-1.5">
          Context / Scenario <span className="text-red-500">*</span>
        </Label>
        <Textarea
          value={values.context}
          onChange={(e) => onChange("context", e.target.value.slice(0, 1000))}
          rows={3}
          maxLength={1000}
          disabled={disabled}
          placeholder="e.g. ICU nurse at Mount Sinai giving handover to incoming nurse"
          className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        <p className="text-xs text-gray-400 mt-1 text-right">
          {values.context.length}/1000
        </p>
      </div>

      <div>
        <Label className="block text-xs font-bold text-gray-600 mb-1.5">
          Prompt <span className="text-red-500">*</span>
        </Label>
        <Textarea
          value={values.prompt}
          onChange={(e) => onChange("prompt", e.target.value.slice(0, 2000))}
          rows={4}
          maxLength={2000}
          disabled={disabled}
          placeholder="Paste your curriculum prompt here"
          className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        <p className="text-xs text-gray-400 mt-1 text-right">
          {values.prompt.length}/2000
        </p>
      </div>

      <button
        type="button"
        onClick={onGenerate}
        disabled={isGenerating || disabled}
        className="w-full py-2.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating…
          </>
        ) : (
          "Generate with AI"
        )}
      </button>
    </div>
  );

  if (variant === "modal") {
    return fields;
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
      <h3 className="text-lg font-bold text-gray-900 mb-1">
        Generate Drill with AI
      </h3>
      <p className="text-sm text-gray-500 mb-6">
        Fill in the details below and AI will generate drill content for review.
      </p>
      {fields}
    </div>
  );
};
