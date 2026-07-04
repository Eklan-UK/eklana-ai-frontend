"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { StudentContextData, UpsertStudentContextInput } from "@/lib/api";
import { useUpsertStudentContext } from "@/hooks/useStudentContext";

const PROFICIENCY_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

interface StudentContextFormProps {
  studentId: string;
  initialData?: StudentContextData | null;
  onSaved: (data: StudentContextData) => void;
  onCancel?: () => void;
  isEdit?: boolean;
}

export function StudentContextForm({
  studentId,
  initialData,
  onSaved,
  onCancel,
  isEdit = false,
}: StudentContextFormProps) {
  const [nativeLanguage, setNativeLanguage] = useState(
    initialData?.nativeLanguage ?? "",
  );
  const [professionalRole, setProfessionalRole] = useState(
    initialData?.professionalRole ?? "",
  );
  const [hospitalUnit, setHospitalUnit] = useState(
    initialData?.hospitalUnit ?? "",
  );
  const [country, setCountry] = useState(initialData?.country ?? "");
  const [proficiencyLevel, setProficiencyLevel] = useState<
    "beginner" | "intermediate" | "advanced"
  >(initialData?.proficiencyLevel ?? "intermediate");
  const [goals, setGoals] = useState(initialData?.goals ?? "");
  const [simulationWeaknesses, setSimulationWeaknesses] = useState(
    initialData?.simulationWeaknesses ?? "",
  );

  const upsertMutation = useUpsertStudentContext(studentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: UpsertStudentContextInput = {
      nativeLanguage: nativeLanguage.trim(),
      professionalRole: professionalRole.trim(),
      hospitalUnit: hospitalUnit.trim(),
      country: country.trim(),
      proficiencyLevel,
      goals: goals.trim(),
      simulationWeaknesses: simulationWeaknesses.trim() || undefined,
    };

    try {
      const response = await upsertMutation.mutateAsync(payload);
      if (response.data) {
        toast.success(
          isEdit ? "Context updated successfully" : "Student context saved",
        );
        onSaved(response.data);
      }
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ?? "Failed to save student context";
      toast.error(message);
    }
  };

  const inputClass =
    "w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm";

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm max-w-2xl">
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        {isEdit ? "Edit Student Context" : "Set Up Student Context"}
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        This information helps the AI personalize drills for this student. It
        only needs to be completed once.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">
              Native Language <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nativeLanguage}
              onChange={(e) => setNativeLanguage(e.target.value)}
              placeholder="e.g. Korean"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">
              Professional Role <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={professionalRole}
              onChange={(e) => setProfessionalRole(e.target.value)}
              placeholder="e.g. ICU Nurse"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">
              Hospital Unit <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={hospitalUnit}
              onChange={(e) => setHospitalUnit(e.target.value)}
              placeholder="e.g. Rapid Response Unit"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">
              Country <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. United States"
              required
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">
            Proficiency Level <span className="text-red-500">*</span>
          </label>
          <select
            value={proficiencyLevel}
            onChange={(e) =>
              setProficiencyLevel(
                e.target.value as "beginner" | "intermediate" | "advanced",
              )
            }
            required
            className={inputClass}
          >
            {PROFICIENCY_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">
            Goals <span className="text-red-500">*</span>
          </label>
          <textarea
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="What does the student want to improve?"
            required
            rows={3}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">
            Simulation Weaknesses{" "}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={simulationWeaknesses}
            onChange={(e) => setSimulationWeaknesses(e.target.value)}
            placeholder="Weaknesses identified from simulation test"
            rows={3}
            className={inputClass}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={upsertMutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {upsertMutation.isPending && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            {isEdit ? "Save Changes" : "Save & Continue"}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2.5 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
