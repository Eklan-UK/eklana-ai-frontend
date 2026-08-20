"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  QUICK_ACTION_CATALOG,
  QUICK_ACTIONS_VISIBLE_CAP,
  type QuickActionId,
} from "./quick-actions";

interface CustomiseQuickActionsModalProps {
  selectedIds: QuickActionId[];
  onClose: () => void;
  onSave: (ids: QuickActionId[]) => void;
}

export function CustomiseQuickActionsModal({
  selectedIds,
  onClose,
  onSave,
}: CustomiseQuickActionsModalProps) {
  const [draftIds, setDraftIds] = useState<QuickActionId[]>(selectedIds);

  const selected = new Set(draftIds);
  const atCap = draftIds.length >= QUICK_ACTIONS_VISIBLE_CAP;
  const selectedItems = draftIds
    .map((id) => QUICK_ACTION_CATALOG.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const toggle = (id: QuickActionId) => {
    if (selected.has(id)) {
      setDraftIds((prev) => prev.filter((item) => item !== id));
      return;
    }
    if (atCap) return;
    setDraftIds((prev) => [...prev, id]);
  };

  const move = (index: number, direction: -1 | 1) => {
    setDraftIds((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      if (!item) return prev;
      next.splice(target, 0, item);
      return next;
    });
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close customise dialog"
        className="fixed inset-0 z-[60] cursor-default bg-black/40"
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-1/2 z-[70] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-border dark:bg-card"
        role="dialog"
        aria-labelledby="customise-quick-actions-title"
        aria-modal="true"
      >
        <h2
          id="customise-quick-actions-title"
          className="text-lg font-bold text-gray-900 dark:text-foreground"
        >
          Customise Quick Actions
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-muted-foreground">
          Choose up to {QUICK_ACTIONS_VISIBLE_CAP} shortcuts and set their
          order.
        </p>

        {selectedItems.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
              Visible ({selectedItems.length}/{QUICK_ACTIONS_VISIBLE_CAP})
            </p>
            {selectedItems.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 dark:border-border"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800 dark:text-foreground">
                  {item.label}
                </span>
                <button
                  type="button"
                  aria-label={`Move ${item.label} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="rounded-md p-1 text-gray-500 hover:bg-gray-50 disabled:opacity-30 dark:hover:bg-muted"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${item.label} down`}
                  disabled={index === selectedItems.length - 1}
                  onClick={() => move(index, 1)}
                  className="rounded-md p-1 text-gray-500 hover:bg-gray-50 disabled:opacity-30 dark:hover:bg-muted"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 max-h-64 space-y-1 overflow-y-auto">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
            Catalog
          </p>
          {QUICK_ACTION_CATALOG.map((item) => {
            const checked = selected.has(item.id);
            const disabled = !checked && atCap;
            return (
              <label
                key={item.id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                  disabled
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:bg-gray-50 dark:hover:bg-muted"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(item.id)}
                  className="h-4 w-4 rounded border-gray-300 text-[#2a602c] focus:ring-[#2a602c]"
                />
                <span className="font-medium text-gray-800 dark:text-foreground">
                  {item.label}
                </span>
              </label>
            );
          })}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl py-2 text-sm font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(draftIds)}
            className="flex-1 rounded-xl bg-[#2a602c] py-2 text-sm font-bold text-white hover:bg-[#418b43]"
          >
            Save
          </button>
        </div>
      </div>
    </>
  );
}
