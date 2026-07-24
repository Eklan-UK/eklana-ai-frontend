"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { drillAPI } from "@/lib/api";
import { DrillFormBody } from "@/components/drills/DrillFormBody";
import {
  getDefaultCompletionDate,
  type DrillDraft,
} from "@/components/drills/drill-draft.types";
import {
  buildBulkAssignPayload,
  buildDrillPayloadFromDraft,
  getDrillTypeLabel,
  getMissingCompletionDateLabels,
  validateDrillDraft,
} from "@/components/drills/drill-form-utils";
import { clearPendingBulkAiDrillApply } from "@/hooks/useAIDrillCreationWorkflow";
import { invalidateStudentWeeks } from "@/hooks/useStudentWeeks";

export interface BulkDrillWizardProps {
  variant: "admin" | "tutor";
  initialDrafts: DrillDraft[];
  returnTo: string;
  users: Array<{
    _id: { toString(): string };
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
  }>;
  loadingUsers?: boolean;
  onCancel?: () => void;
  /** Drill-builder week context — places assignedAt in that week when set. */
  weekNumber?: number;
}

export function BulkDrillWizard({
  variant,
  initialDrafts,
  returnTo,
  users,
  loadingUsers = false,
  onCancel,
  weekNumber,
}: BulkDrillWizardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<DrillDraft[]>(initialDrafts);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [savingCurrent, setSavingCurrent] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const prevDraftCountRef = useRef<number | null>(null);

  const currentDraft = drafts[currentIndex];
  const total = drafts.length;
  const allHaveCompletionDate = drafts.every((d) => Boolean(d.completionDate));
  const missingLabels = getMissingCompletionDateLabels(drafts);

  // Keep the pointer valid after a draft is removed (e.g. saved or created individually).
  useEffect(() => {
    setCurrentIndex((prev) => Math.min(prev, Math.max(0, drafts.length - 1)));
  }, [drafts.length]);

  // Navigate away after the last draft is removed (e.g. individual Save) — must not
  // call router.push inside a setState updater.
  useEffect(() => {
    const prev = prevDraftCountRef.current;
    prevDraftCountRef.current = drafts.length;

    if (prev !== null && prev > 0 && drafts.length === 0) {
      clearPendingBulkAiDrillApply();
      router.push(returnTo);
    }
  }, [drafts.length, returnTo, router]);

  const patchCurrentDraft = useCallback(
    (update: DrillDraft | ((prev: DrillDraft) => DrillDraft)) => {
      setDrafts((prev) => {
        const current = prev[currentIndex];
        const next = typeof update === "function" ? update(current) : update;
        return prev.map((d, i) => (i === currentIndex ? next : d));
      });
    },
    [currentIndex],
  );

  const handleUpload = async () => {
    if (!allHaveCompletionDate) {
      toast.error(
        missingLabels.length > 0
          ? `Set completion dates for: ${missingLabels.join(", ")}`
          : "Please set a completion date for each drill",
      );
      return;
    }

    for (const draft of drafts) {
      if (!validateDrillDraft(draft, { requireUsers: true })) {
        const idx = drafts.indexOf(draft);
        if (idx >= 0) setCurrentIndex(idx);
        return;
      }
    }

    setUploading(true);
    try {
      const res = await fetch("/api/v1/drills/bulk-create-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          drills: buildBulkAssignPayload(drafts, { weekNumber }),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message || "Failed to create drills");
        return;
      }

      clearPendingBulkAiDrillApply();
      const created = json.data?.created ?? drafts.length;
      const studentIds = [...new Set(drafts.flatMap((d) => d.selectedUsers))];
      await invalidateStudentWeeks(queryClient, studentIds);
      toast.success(
        created === 1
          ? "Drill created and assigned"
          : `${created} drills created and assigned`,
      );
      router.push(returnTo);
    } catch {
      toast.error("Failed to create drills");
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    router.push(returnTo);
  };

  const removeDraftAt = useCallback((index: number) => {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSaveCurrentDraft = async () => {
    if (!validateDrillDraft(currentDraft)) return;
    setSavingCurrent(true);
    try {
      await drillAPI.create(
        buildDrillPayloadFromDraft(currentDraft, {
          assignedTo: currentDraft.selectedUsers,
          isActive: false,
          weekNumber,
        }),
      );
      if (currentDraft.selectedUsers.length > 0) {
        await invalidateStudentWeeks(queryClient, currentDraft.selectedUsers);
        toast.success(
          "Drill saved with pending assignment for selected students.",
        );
      } else {
        toast.success("Drill saved successfully!");
      }
      removeDraftAt(currentIndex);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to save drill: " + message);
    } finally {
      setSavingCurrent(false);
    }
  };

  const handleCopyCurrentDraft = () => {
    if (!validateDrillDraft(currentDraft)) return;
    const copy: DrillDraft = {
      ...currentDraft,
      selectedUsers: [],
      completionDate: getDefaultCompletionDate(),
    };
    setDrafts((prev) => {
      const next = [...prev];
      next.splice(currentIndex + 1, 0, copy);
      return next;
    });
    setCurrentIndex(currentIndex + 1);
    toast.success(
      "Drill copied. Select students and a completion date, then upload.",
    );
  };

  if (!currentDraft) return null;

  return (
    <div className="space-y-8 pb-28">
      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={handleCancel}
          className="p-3 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Review AI-Generated Drills
          </h1>
          <p className="text-gray-500 text-sm">
            Set a completion date for each drill, then upload all at once.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-6 py-4">
        <div>
          <p className="text-sm font-bold text-emerald-900">
            {getDrillTypeLabel(currentDraft.drillType)}
          </p>
          <p className="text-xs text-emerald-700">
            Drill {currentIndex + 1} of {total}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>
          <button
            type="button"
            onClick={() =>
              setCurrentIndex((i) => Math.min(total - 1, i + 1))
            }
            disabled={currentIndex >= total - 1}
            className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <DrillFormBody
        draft={currentDraft}
        onDraftChange={patchCurrentDraft}
        users={users}
        loadingUsers={loadingUsers}
        variant={variant}
        drillTypeLocked
        studentSearch={studentSearch}
        onStudentSearchChange={setStudentSearch}
        layout="full"
      />

      <div className="fixed bottom-0 left-64 right-0 z-10 flex flex-wrap items-center gap-4 border-t border-gray-100 bg-white p-6">
        <button
          type="button"
          onClick={handleSaveCurrentDraft}
          disabled={uploading || savingCurrent}
          className="flex items-center gap-2 px-8 py-3.5 bg-amber-400 text-amber-950 font-bold rounded-full hover:bg-amber-500 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {savingCurrent ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Drill"
          )}
        </button>
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || savingCurrent}
          className={`flex items-center gap-2 rounded-full px-8 py-3.5 font-bold text-white shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
            allHaveCompletionDate
              ? "bg-[#418b43] shadow-emerald-500/20 hover:bg-[#3a7c3b]"
              : "bg-gray-300 shadow-none hover:bg-gray-300"
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading…
            </>
          ) : (
            `Upload ${total} drill${total !== 1 ? "s" : ""}`
          )}
        </button>
        <button
          type="button"
          onClick={handleCopyCurrentDraft}
          disabled={uploading || savingCurrent}
          className="px-8 py-3.5 bg-white border border-gray-200 text-gray-600 font-bold rounded-full hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Copy Drill
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={uploading || savingCurrent}
          className="px-8 py-3.5 bg-white border border-gray-200 text-gray-600 font-bold rounded-full hover:bg-gray-50 transition-all disabled:opacity-50"
        >
          Cancel
        </button>
        {!allHaveCompletionDate && (
          <p className="self-center text-sm text-amber-700">
            Missing completion date: {missingLabels.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
