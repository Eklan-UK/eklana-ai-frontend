"use client";

import { Filter, Search, X } from "lucide-react";
import {
  CLINIC_DIFFICULTY_FILTER_OPTIONS,
  CLINIC_STATUS_FILTER_OPTIONS,
  CLINIC_TYPE_FILTER_OPTIONS,
} from "./clinic-drill-utils";

export type ClinicListFilters = {
  q: string;
  type: string;
  status: string;
  difficulty: string;
};

type ClinicFiltersBarProps = {
  searchDraft: string;
  onSearchDraftChange: (value: string) => void;
  filters: ClinicListFilters;
  onFilterChange: (partial: Partial<ClinicListFilters>) => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  onClear: () => void;
  hasActiveFilters: boolean;
};

const selectClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#418b43] dark:border-border dark:bg-card dark:text-foreground";

export function ClinicFiltersBar({
  searchDraft,
  onSearchDraftChange,
  filters,
  onFilterChange,
  showAdvanced,
  onToggleAdvanced,
  onClear,
  hasActiveFilters,
}: ClinicFiltersBarProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-border dark:bg-card sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchDraft}
            onChange={(e) => onSearchDraftChange(e.target.value)}
            placeholder="Search by title or keyword…"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#418b43] dark:border-border dark:bg-background dark:text-foreground"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:w-auto lg:min-w-[28rem]">
          <select
            value={filters.type}
            onChange={(e) => onFilterChange({ type: e.target.value })}
            className={selectClass}
            aria-label="Filter by type"
          >
            {CLINIC_TYPE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ status: e.target.value })}
            className={selectClass}
            aria-label="Filter by status"
          >
            {CLINIC_STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={filters.difficulty}
            onChange={(e) => onFilterChange({ difficulty: e.target.value })}
            className={selectClass}
            aria-label="Filter by difficulty"
          >
            {CLINIC_DIFFICULTY_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onToggleAdvanced}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
            showAdvanced || hasActiveFilters
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:bg-muted"
          }`}
          aria-expanded={showAdvanced}
          title="Advanced filters"
        >
          <Filter className="h-4 w-4" />
          <span className="lg:sr-only xl:not-sr-only">Filters</span>
        </button>
      </div>

      {showAdvanced && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-border">
          <p className="text-sm text-gray-500 dark:text-muted-foreground">
            Use the dropdowns above to narrow by type, publish status, or difficulty.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground"
            >
              <X className="h-4 w-4" />
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
