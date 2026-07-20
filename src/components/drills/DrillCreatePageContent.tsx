"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { appendReturnTo, sanitizeReturnTo } from "@/lib/drill-list-filters";
import { drillAPI } from "@/lib/api";
import { adminService } from "@/services/admin.service";
import { toast } from "sonner";
import { useDrillById } from "@/hooks/useAdmin";
import { useDrill } from "@/hooks/useDrills";
import { useTutorStudents } from "@/hooks/useTutor";
import { FileUploadZone } from "@/components/drills/FileUploadZone";
import { ContentPreview } from "@/components/drills/ContentPreview";
import { TemplateDownload } from "@/components/drills/TemplateDownload";
import { ClipboardPaste } from "@/components/drills/ClipboardPaste";
import { AIDrillCreationShell } from "@/components/drills/AIDrillCreationShell";
import { DrillFormBody } from "@/components/drills/DrillFormBody";
import { BulkDrillWizard } from "@/components/drills/BulkDrillWizard";
import {
  applyParsedContentToDraft,
  buildDrillPayloadFromDraft,
  draftFromBulkPendingItem,
  validateDrillDraft,
} from "@/components/drills/drill-form-utils";
import {
  drillRecordToDraft,
  getDrillCreateDefaultReturn,
  getDrillCreateDraftKey,
  getDrillCreatePath,
  getDrillPostCreatePath,
  type DrillCreateVariant,
} from "@/components/drills/drill-create-config";
import {
  getDefaultCompletionDate,
  getDefaultDrillDraft,
  type DrillDraft,
} from "@/components/drills/drill-draft.types";
import {
  clearPendingBulkAiDrillApply,
  readPendingBulkAiDrillApply,
  useAIDrillCreationWorkflow,
} from "@/hooks/useAIDrillCreationWorkflow";
import { invalidateStudentWeeks } from "@/hooks/useStudentWeeks";
import { useQueryClient } from "@tanstack/react-query";
import type { ParsedContent } from "@/services/document-parser.service";
import {
  generateDrillAudio,
  extractTextsForDrillType,
  applyAudioUrls,
} from "@/services/drill-audio.service";
import { resolveAccentVoiceId } from "@/services/tts-accent-voices";
import { mergeMediaFieldsFromSource } from "@/utils/drill";

type DrillAssignmentApiResult = {
  assignmentsRequested?: number;
  assignmentsCreated?: number;
  newAssignmentsCreated?: number;
  failedLearnerIds?: string[];
};

function getAssignmentCounts(
  apiData: DrillAssignmentApiResult | undefined,
  fallbackRequested: number,
) {
  return {
    requested: apiData?.assignmentsRequested ?? fallbackRequested,
    created:
      apiData?.assignmentsCreated ?? apiData?.newAssignmentsCreated ?? 0,
    failedLearnerIds: apiData?.failedLearnerIds ?? [],
  };
}

function toastAssignmentResult(
  counts: ReturnType<typeof getAssignmentCounts>,
  options: { isReassign?: boolean } = {},
) {
  const { requested, created, failedLearnerIds } = counts;
  if (created >= requested) {
    if (options.isReassign) {
      toast.success(
        `Drill updated and reassigned to ${created} student${created !== 1 ? "s" : ""}. All previous progress has been reset.`,
      );
    } else if (requested > 0) {
      toast.success(
        `Drill assigned to ${created} student${created !== 1 ? "s" : ""}!`,
      );
    } else {
      toast.success("Drill created successfully!");
    }
    return;
  }
  if (created > 0) {
    toast.warning(
      `Only ${created} of ${requested} students were assigned.${failedLearnerIds.length > 0 ? ` ${failedLearnerIds.length} failed.` : ""}`,
    );
    return;
  }
  toast.error(
    `Failed to assign drill to any of the ${requested} selected students.${failedLearnerIds.length > 0 ? ` ${failedLearnerIds.length} failed.` : ""}`,
  );
}

export interface DrillCreatePageContentProps {
  variant: DrillCreateVariant;
}

export function DrillCreatePageContent({ variant }: DrillCreatePageContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const draftKey = getDrillCreateDraftKey(variant);
  const createPath = getDrillCreatePath(variant);

  const drillId = searchParams.get("drillId") || searchParams.get("id");
  const preselectedStudentId = searchParams.get("student") || "";
  const preselectedWeek = searchParams.get("week") || "";
  const returnToParam = searchParams.get("returnTo");
  const isEditMode = !!drillId;

  const drillListReturnPath = useMemo(
    () => sanitizeReturnTo(returnToParam) ?? getDrillCreateDefaultReturn(variant),
    [returnToParam, variant],
  );

  const [draft, setDraft] = useState<DrillDraft>(() => getDefaultDrillDraft());
  const [studentSearch, setStudentSearch] = useState("");
  const [adminUsers, setAdminUsers] = useState<
    Array<{ _id: { toString(): string }; firstName?: string; lastName?: string; name?: string; email?: string }>
  >([]);
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(variant === "admin");

  const { data: tutorStudentsData, isLoading: loadingTutorUsers } =
    useTutorStudents({ limit: 1000 }, { enabled: variant === "tutor" });

  const tutorStudents = tutorStudentsData?.students;
  const users = useMemo(
    () => (variant === "admin" ? adminUsers : (tutorStudents ?? [])),
    [variant, adminUsers, tutorStudents],
  );
  const loadingUsers =
    variant === "admin" ? loadingAdminUsers : loadingTutorUsers;

  const lastUploadedFile = useRef<File | null>(null);
  const onApplyParsedRef = useRef<(content: ParsedContent) => void>(() => {});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [parsedContent, setParsedContent] = useState<ParsedContent | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState("");
  const [showReassignConfirm, setShowReassignConfirm] = useState(false);

  const [bulkDrafts, setBulkDrafts] = useState<DrillDraft[] | null>(null);
  const [bulkReturnTo, setBulkReturnTo] = useState("");

  const patchDraft = useCallback((partial: Partial<DrillDraft>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  const applyDraft = useCallback((next: DrillDraft) => {
    setDraft(next);
  }, []);

  const saveDraft = useCallback(() => {
    if (isEditMode) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch (e) {
      console.warn("Failed to save drill draft:", e);
    }
  }, [isEditMode, draftKey, draft]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(draftKey);
  }, [draftKey]);

  const adminDrillQuery = useDrillById(
    variant === "admin" && drillId ? drillId : "",
  );
  const tutorDrillQuery = useDrill(
    variant === "tutor" && drillId ? drillId : "",
  );
  const drillData =
    variant === "admin" ? adminDrillQuery.data : tutorDrillQuery.data;
  const loadingDrill =
    variant === "admin" ? adminDrillQuery.isLoading : tutorDrillQuery.isLoading;

  const totalAssignments = drillData?.totalAssignments ?? 0;
  const isAssignedDrill = isEditMode && totalAssignments > 0;

  useEffect(() => {
    if (variant !== "admin") return;
    const fetchUsers = async () => {
      try {
        setLoadingAdminUsers(true);
        const response = await adminService.getLearners({ limit: 1000 });
        setAdminUsers(response.data?.learners ?? []);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error("Failed to load users: " + message);
      } finally {
        setLoadingAdminUsers(false);
      }
    };
    void fetchUsers();
  }, [variant]);

  useEffect(() => {
    if (isEditMode) return;
    const pending = readPendingBulkAiDrillApply();
    if (!pending?.length) return;
    setBulkDrafts(pending.map(draftFromBulkPendingItem));
    setBulkReturnTo(
      sanitizeReturnTo(returnToParam) ??
        getDrillCreateDefaultReturn(variant),
    );
    clearPendingBulkAiDrillApply();
  }, [isEditMode, returnToParam, variant]);

  useEffect(() => {
    if (isEditMode) return;
    const savedDraft = localStorage.getItem(draftKey);
    if (readPendingBulkAiDrillApply()?.length) return;

    if (savedDraft) {
      try {
        const parsedDraft = JSON.parse(savedDraft) as DrillDraft;
        if (parsedDraft && typeof parsedDraft === "object") {
          applyDraft(parsedDraft);
          toast.success("Draft restored", {
            action: {
              label: "Discard",
              onClick: () => {
                clearDraft();
                applyDraft(getDefaultDrillDraft());
                toast.info("Draft discarded");
              },
            },
          });
          return;
        }
      } catch (e) {
        console.warn("Failed to parse saved drill draft:", e);
        clearDraft();
      }
    }
    patchDraft({ completionDate: getDefaultCompletionDate() });
  }, [isEditMode, draftKey, applyDraft, clearDraft, patchDraft]);

  useEffect(() => {
    if (isEditMode) return;
    const timeoutId = setTimeout(saveDraft, 1000);
    return () => clearTimeout(timeoutId);
  }, [isEditMode, saveDraft, draft]);

  useEffect(() => {
    if (isEditMode) return;
    const handleBeforeUnload = () => saveDraft();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isEditMode, saveDraft]);

  useEffect(() => {
    if (isEditMode && drillData && users.length >= 0) {
      applyDraft(
        drillRecordToDraft(drillData as Record<string, unknown>, users),
      );
    }
  }, [isEditMode, drillData, users, applyDraft]);

  // Apply preselection once users have finished loading so that even if a saved draft was
  // restored (potentially with different selectedUsers), this effect re-fires when loadingUsers
  // transitions to false and correctly seeds the preselected student.
  useEffect(() => {
    if (!preselectedStudentId || isEditMode || bulkDrafts || loadingUsers) return;
    patchDraft({ selectedUsers: [preselectedStudentId] });
  }, [preselectedStudentId, isEditMode, bulkDrafts, loadingUsers, patchDraft]);

  const initialAiContext = useMemo(() => {
    if (!preselectedStudentId) return undefined;
    const weekNum = preselectedWeek ? parseInt(preselectedWeek, 10) : undefined;
    return {
      studentId: preselectedStudentId,
      weekNumber: Number.isFinite(weekNum) ? weekNum : undefined,
    };
  }, [preselectedStudentId, preselectedWeek]);

  const aiStudentOptions = useMemo(
    () =>
      users.map((user) => {
        const name =
          `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
          user.name ||
          user.email ||
          "Unknown";
        return { id: user._id.toString(), label: name, email: user.email };
      }),
    [users],
  );

  const handleApplyParsedContent = useCallback(
    (content?: ParsedContent) => {
      const pc = content ?? parsedContent;
      if (!pc) return;
      setDraft((prev) => applyParsedContentToDraft(prev, pc));
      setShowPreview(false);
      setParsedContent(null);
      toast.success("Form populated with parsed data");
    },
    [parsedContent],
  );

  onApplyParsedRef.current = handleApplyParsedContent;

  const activateBulkWizard = useCallback(
    (items: DrillDraft[]) => {
      setBulkDrafts(items);
      setBulkReturnTo(
        sanitizeReturnTo(returnToParam) ?? getDrillCreateDefaultReturn(variant),
      );
    },
    [returnToParam, variant],
  );

  const aiWorkflow = useAIDrillCreationWorkflow({
    students: aiStudentOptions,
    initialContext: initialAiContext,
    onBulkReady: (items) => {
      activateBulkWizard(items.map(draftFromBulkPendingItem));
    },
  });

  const handleFileSelect = async (file: File) => {
    lastUploadedFile.current = file;
    try {
      setIsParsing(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("drillType", draft.drillType);

      const response = await fetch("/api/v1/drills/parse-document", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to parse document");
      }

      const result = await response.json();
      setParsedContent(result.data);
      setShowPreview(true);
      toast.success("Document parsed successfully");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to parse document: " + message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleClipboardParse = (parsed: ParsedContent) => {
    setParsedContent(parsed);
    setShowPreview(true);
  };

  const handleDrillTypeChange = () => {
    if (lastUploadedFile.current) {
      void handleFileSelect(lastUploadedFile.current);
    }
  };

  const executeSubmit = async () => {
    try {
      setLoading(true);
      const assignedTo = draft.selectedUsers.filter(Boolean);

      let drillPayload: Record<string, unknown> = buildDrillPayloadFromDraft(
        draft,
        { assignedTo, isActive: true },
      );

      if (draft.generateTTSAudio) {
        setIsGeneratingAudio(true);
        setAudioProgress("Extracting texts for audio generation...");
        try {
          const textsToGenerate = extractTextsForDrillType(
            drillPayload,
            draft.drillType,
          );
          if (textsToGenerate.length > 0) {
            setAudioProgress(`Generating ${textsToGenerate.length} audio files...`);
            // Regenerate whenever TTS is checked (including accent/voice key changes on update).
            const audioResponse = await generateDrillAudio(
              textsToGenerate,
              draft.drillType,
              drillId || undefined,
              resolveAccentVoiceId(draft.ttsVoiceKey),
            );
            if (audioResponse.success && audioResponse.data) {
              drillPayload = applyAudioUrls(
                drillPayload,
                audioResponse.data.results,
              );
              const { success, failed } = audioResponse.data.summary;
              if (failed > 0) {
                toast.warning(
                  `Generated ${success}/${success + failed} audio files. Some failed.`,
                );
              } else {
                toast.success(`Generated ${success} audio files successfully!`);
              }
            } else {
              toast.warning(
                "Failed to generate audio, but drill will be saved without pre-generated audio.",
              );
            }
          }
        } catch (audioError) {
          console.error("Audio generation error:", audioError);
          toast.warning(
            "Audio generation failed, but drill will be saved without pre-generated audio.",
          );
        } finally {
          setIsGeneratingAudio(false);
          setAudioProgress("");
        }
      }

      if (isEditMode && drillId) {
        const response = (await drillAPI.update(
          drillId,
          drillPayload,
        )) as { data?: DrillAssignmentApiResult };
        clearDraft();
        toastAssignmentResult(
          getAssignmentCounts(response?.data, assignedTo.length),
          { isReassign: isAssignedDrill },
        );
        router.push(drillListReturnPath);
      } else {
        const response = (await drillAPI.create(drillPayload)) as {
          data?: DrillAssignmentApiResult;
        };
        clearDraft();
        toastAssignmentResult(
          getAssignmentCounts(response?.data, assignedTo.length),
        );
        await invalidateStudentWeeks(queryClient, assignedTo);
        router.push(
          returnToParam ? drillListReturnPath : getDrillPostCreatePath(variant),
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to create drill: " + message);
    } finally {
      setLoading(false);
      setIsGeneratingAudio(false);
      setAudioProgress("");
    }
  };

  const handleSaveDrill = async () => {
    if (!validateDrillDraft(draft)) return;
    try {
      setSaving(true);
      const payload = buildDrillPayloadFromDraft(
        draft,
        isAssignedDrill
          ? { omitAssignment: true }
          : { assignedTo: draft.selectedUsers, isActive: false },
      );

      if (isEditMode && drillId) {
        await drillAPI.update(drillId, payload);
        clearDraft();
        toast.success("Drill saved successfully!");
      } else {
        await drillAPI.create(payload);
        clearDraft();
        if (draft.selectedUsers.length > 0) {
          await invalidateStudentWeeks(queryClient, draft.selectedUsers);
          toast.success(
            "Drill saved with pending assignment for selected students.",
          );
        } else {
          toast.success("Drill saved successfully!");
        }
      }
      router.push(drillListReturnPath);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to save drill: " + message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateDrillDraft(draft)) return;
    if (draft.selectedUsers.length === 0) {
      toast.error("Please select at least one user");
      return;
    }
    if (isEditMode && isAssignedDrill) {
      setShowReassignConfirm(true);
      return;
    }
    await executeSubmit();
  };

  const handleCopyDrill = async () => {
    if (!validateDrillDraft(draft)) return;
    setCopying(true);
    try {
      let payload = buildDrillPayloadFromDraft(draft, {
        assignedTo: [],
        isActive: false,
      });
      if (isEditMode && drillData) {
        payload = mergeMediaFieldsFromSource(
          payload,
          drillData as Record<string, unknown>,
        );
      }
      const response: {
        data?: { drill?: { _id?: string } };
        drill?: { _id?: string };
      } = await drillAPI.create(payload);
      const newDrillId = response?.data?.drill?._id ?? response?.drill?._id;
      if (!newDrillId) throw new Error("New drill ID not returned");
      clearDraft();
      patchDraft({
        selectedUsers: [],
        completionDate: getDefaultCompletionDate(),
      });
      toast.success(
        "Drill copied. Select students and a completion date, then assign.",
      );
      const copyUrl = returnToParam
        ? appendReturnTo(`${createPath}?drillId=${newDrillId}`, returnToParam)
        : `${createPath}?drillId=${newDrillId}`;
      router.push(copyUrl);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to copy drill: " + message);
    } finally {
      setCopying(false);
    }
  };

  if (!isEditMode && bulkDrafts && bulkDrafts.length > 0) {
    return (
      <BulkDrillWizard
        variant={variant}
        initialDrafts={bulkDrafts}
        returnTo={bulkReturnTo}
        users={users}
        loadingUsers={loadingUsers}
      />
    );
  }

  if (isEditMode && loadingDrill) {
    return (
      <div className="space-y-8 pb-20">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#418b43] mx-auto mb-4" />
            <p className="text-gray-500">Loading drill data...</p>
          </div>
        </div>
      </div>
    );
  }

  const importSection = (
    <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Import Data</h3>
          <p className="text-sm text-gray-500">
            Upload a file, paste from clipboard, or download a template to get
            started quickly
          </p>
        </div>
        <TemplateDownload drillType={draft.drillType} />
      </div>
      <div className="space-y-4 mt-6">
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-2">
            Upload Document
          </label>
          <FileUploadZone onFileSelect={handleFileSelect} disabled={isParsing} />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-2">
            Or Paste from Clipboard
          </label>
          <ClipboardPaste onParse={handleClipboardParse} />
        </div>
      </div>
    </div>
  );

  const generateAiButton = !isEditMode ? (
    <button
      type="button"
      onClick={() => aiWorkflow.setShowAiFormModal(true)}
      className="hidden xl:block w-full py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
    >
      Generate with AI
    </button>
  ) : null;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-3 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? "Edit Drill" : "Create New Drill"}
          </h1>
          <p className="text-gray-500 text-sm">
            {isEditMode
              ? "Update drill details and assignments"
              : "Upload a PDF or fill in the form manually"}
          </p>
        </div>
      </div>

      {!isEditMode && (
        <button
          type="button"
          onClick={() => aiWorkflow.setShowAiFormModal(true)}
          className="w-full py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm xl:hidden"
        >
          Generate with AI
        </button>
      )}

      <DrillFormBody
        draft={draft}
        onDraftChange={setDraft}
        users={users}
        loadingUsers={loadingUsers}
        variant={variant}
        studentSearch={studentSearch}
        onStudentSearchChange={setStudentSearch}
        isGeneratingAudio={isGeneratingAudio}
        audioProgress={audioProgress}
        leadingContent={importSection}
        sidebarLeadingContent={generateAiButton}
        onDrillTypeChange={handleDrillTypeChange}
      />

      <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-100 p-6 flex gap-4 z-10">
        <button
          type="button"
          onClick={handleSaveDrill}
          disabled={loading || saving || copying}
          className="px-8 py-3.5 bg-amber-400 text-amber-950 font-bold rounded-full hover:bg-amber-500 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : isEditMode ? (
            isAssignedDrill ? "Save Changes" : "Save Drill"
          ) : (
            "Save Drill"
          )}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || saving || copying}
          className="px-8 py-3.5 bg-[#418b43] text-white font-bold rounded-full hover:bg-[#3a7c3b] transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {isEditMode ? "Updating..." : "Creating..."}
            </>
          ) : isEditMode && !isAssignedDrill ? (
            `Assign to ${draft.selectedUsers.length} user${draft.selectedUsers.length !== 1 ? "s" : ""}`
          ) : isEditMode ? (
            `Update Drill for ${draft.selectedUsers.length} user${draft.selectedUsers.length !== 1 ? "s" : ""}`
          ) : (
            `Create Drill for ${draft.selectedUsers.length} user${draft.selectedUsers.length !== 1 ? "s" : ""}`
          )}
        </button>
        <button
          type="button"
          onClick={handleCopyDrill}
          disabled={loading || saving || copying}
          className="px-8 py-3.5 bg-white border border-gray-200 text-gray-600 font-bold rounded-full hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {copying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Copying...
            </>
          ) : (
            "Copy Drill"
          )}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={loading || saving || copying}
          className="px-8 py-3.5 bg-white border border-gray-200 text-gray-600 font-bold rounded-full hover:bg-gray-50 transition-all disabled:opacity-50"
        >
          Cancel Drill
        </button>
      </div>

      {showReassignConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Update and reassign drill?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              This will reset all student progress for this drill — including
              assignments, attempts, and bookmarks — and create fresh assignments
              for the {draft.selectedUsers.length} selected student
              {draft.selectedUsers.length !== 1 ? "s" : ""}. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowReassignConfirm(false)}
                disabled={loading}
                className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 font-semibold rounded-full hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowReassignConfirm(false);
                  await executeSubmit();
                }}
                disabled={loading}
                className="px-5 py-2.5 bg-[#418b43] text-white font-semibold rounded-full hover:bg-[#3a7c3b] transition-all disabled:opacity-50"
              >
                Update Drill
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreview && parsedContent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <ContentPreview
              parsedContent={parsedContent}
              onConfirm={handleApplyParsedContent}
              onCancel={() => {
                setShowPreview(false);
                setParsedContent(null);
              }}
            />
          </div>
        </div>
      )}

      {!isEditMode && (
        <AIDrillCreationShell
          isEditMode={isEditMode}
          showAiFormModal={aiWorkflow.showAiFormModal}
          setShowAiFormModal={aiWorkflow.setShowAiFormModal}
          aiFormValues={aiWorkflow.aiFormValues}
          handleAiFormChange={aiWorkflow.handleAiFormChange}
          setAiStudentIds={aiWorkflow.setAiStudentIds}
          setAiDrillTypes={aiWorkflow.setAiDrillTypes}
          students={aiStudentOptions}
          loadingStudents={loadingUsers}
          isGeneratingDrill={aiWorkflow.isGeneratingDrill}
          handleAIGenerate={aiWorkflow.handleAIGenerate}
          lockedStudentIds={
            preselectedStudentId ? [preselectedStudentId] : undefined
          }
          builderVariant={variant}
          showAiPreview={aiWorkflow.showAiPreview}
          aiGeneratedResults={aiWorkflow.aiGeneratedResults}
          handleUseTheseDrills={aiWorkflow.handleUseTheseDrills}
          showChatSidebar={aiWorkflow.showChatSidebar}
          setShowChatSidebar={aiWorkflow.setShowChatSidebar}
          updateAiGeneratedResult={aiWorkflow.updateAiGeneratedResult}
          setShowAiPreview={aiWorkflow.setShowAiPreview}
        />
      )}
    </div>
  );
}
