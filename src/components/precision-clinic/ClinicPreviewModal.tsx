"use client";

import { Loader2, X } from "lucide-react";
import { usePrecisionClinicDetail } from "@/hooks/usePrecisionClinic";
import {
  ClinicDifficultyBadge,
  ClinicTypeBadge,
} from "./ClinicBadges";
import { ClinicContentPreview } from "./ClinicContentPreview";

type ClinicPreviewModalProps = {
  drillId: string;
  drillTitle?: string;
  onClose: () => void;
};

/**
 * Admin read-only preview of a Precision Clinic drill (new document shape).
 * Does not depend on Drill schema / DrillPracticeInterface.
 */
export function ClinicPreviewModal({
  drillId,
  drillTitle,
  onClose,
}: ClinicPreviewModalProps) {
  const { data: drill, isLoading, error } = usePrecisionClinicDetail(drillId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-border sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-muted-foreground">
              Preview
            </p>
            <h3 className="truncate text-sm font-bold text-gray-900 dark:text-foreground">
              {drillTitle || drill?.title || "Clinic Drill"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-muted"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-5 sm:px-6">
          {isLoading ? (
            <div className="flex h-full items-center justify-center py-20">
              <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="px-6 py-16 text-center text-sm text-red-600">
              {error instanceof Error ? error.message : "Failed to load drill"}
            </div>
          ) : drill ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <ClinicTypeBadge type={String(drill.type ?? "")} />
                <ClinicDifficultyBadge
                  difficulty={String(drill.difficulty ?? "")}
                />
              </div>
              {drill.context ? (
                <p className="text-sm text-gray-600 dark:text-muted-foreground">
                  {drill.context}
                </p>
              ) : null}
              <ClinicContentPreview drill={drill} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
