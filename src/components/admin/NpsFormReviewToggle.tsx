"use client";

import type { NpsFormSettings } from "@/domain/admin/nps-form.types";

interface NpsFormReviewToggleProps {
  npsEnabled: boolean;
  onNpsEnabledChange: (enabled: boolean) => void;
  npsFormConfig: NpsFormSettings | null | undefined;
  isLoading?: boolean;
}

export function NpsFormReviewToggle({
  npsEnabled,
  onNpsEnabledChange,
  npsFormConfig,
  isLoading = false,
}: NpsFormReviewToggleProps) {
  const hasActiveForm = Boolean(
    npsFormConfig?.isActive && npsFormConfig?.url?.trim(),
  );

  return (
    <div className="rounded-xl bg-slate-100/80 px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800">Add NPS form</p>
          {hasActiveForm && npsFormConfig?.name ? (
            <p className="mt-0.5 truncate text-xs text-gray-500">
              Form: {npsFormConfig.name}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={npsEnabled}
          aria-label="Add NPS form"
          disabled={isLoading || !hasActiveForm}
          onClick={() => onNpsEnabledChange(!npsEnabled)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3d8c40] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${
            npsEnabled && hasActiveForm ? "bg-[#2d6a32]" : "bg-gray-200"
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
              npsEnabled && hasActiveForm
                ? "left-0.5 translate-x-5"
                : "left-0.5 translate-x-0"
            }`}
          />
        </button>
      </div>
      {!isLoading && !hasActiveForm ? (
        <p className="mt-2 text-xs text-amber-800" role="status">
          No active NPS form is configured. Add one in Admin Settings before
          enabling this option.
        </p>
      ) : null}
    </div>
  );
}
