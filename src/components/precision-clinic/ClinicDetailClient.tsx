"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Archive,
  ArrowLeft,
  Copy,
  Edit,
  Loader2,
  Trash2,
  Users,
} from "lucide-react";
import {
  useArchivePrecisionClinic,
  useDeletePrecisionClinic,
  useDuplicatePrecisionClinic,
  usePrecisionClinicDetail,
} from "@/hooks/usePrecisionClinic";
import { Button } from "@/components/ui/Button";
import {
  ClinicDifficultyBadge,
  ClinicStatusBadge,
  ClinicTypeBadge,
} from "./ClinicBadges";
import { ClinicAssignModal } from "./ClinicAssignModal";
import { ClinicContentPreview } from "./ClinicContentPreview";
import {
  countClinicPracticeItems,
  creatorDisplayName,
  formatRelativeTime,
  getClinicUpdatedAt,
} from "./clinic-drill-utils";

type ClinicDetailClientProps = {
  drillId: string;
};

export function ClinicDetailClient({ drillId }: ClinicDetailClientProps) {
  const router = useRouter();
  const { data: drill, isLoading, error, isError } =
    usePrecisionClinicDetail(drillId);
  const deleteMutation = useDeletePrecisionClinic();
  const duplicateMutation = useDuplicatePrecisionClinic();
  const archiveMutation = useArchivePrecisionClinic();
  const [showAssign, setShowAssign] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isError || !drill) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-foreground">
          Drill not found
        </h2>
        <p className="text-sm text-gray-500 dark:text-muted-foreground">
          {error instanceof Error
            ? error.message
            : "This clinic drill could not be loaded."}
        </p>
        <Link href="/admin/precision-clinic">
          <Button variant="primary">Back to Precision Clinic</Button>
        </Link>
      </div>
    );
  }

  const itemCount = countClinicPracticeItems(drill);
  const assignedCount = Array.isArray(drill.assignedLearnerIds)
    ? drill.assignedLearnerIds.length
    : 0;
  const updatedAt = getClinicUpdatedAt(drill);
  const editHref = `/admin/precision-clinic/create?id=${drillId}`;

  const handleDuplicate = () => {
    duplicateMutation.mutate(drillId, {
      onSuccess: (created) => {
        const newId = created?._id ? String(created._id) : null;
        if (newId) router.push(`/admin/precision-clinic/${newId}`);
      },
    });
  };

  const handleArchive = () => {
    archiveMutation.mutate(drillId);
  };

  const handleDelete = () => {
    deleteMutation.mutate(drillId, {
      onSuccess: () => {
        setConfirmDelete(false);
        router.push("/admin/precision-clinic");
      },
    });
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-3">
          <Link
            href="/admin/precision-clinic"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-800 dark:text-muted-foreground dark:hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Precision Clinic
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">
              {drill.title}
            </h1>
            {drill.context ? (
              <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-muted-foreground">
                {drill.context}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ClinicTypeBadge type={String(drill.type ?? "")} />
            <ClinicDifficultyBadge difficulty={String(drill.difficulty ?? "")} />
            <ClinicStatusBadge drill={drill} />
            {drill.isArchived ? (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-muted dark:text-muted-foreground">
                Archived
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={editHref}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Link>
          <button
            type="button"
            onClick={() => setShowAssign(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted"
          >
            <Users className="h-4 w-4" />
            Assign
          </button>
          <button
            type="button"
            onClick={handleDuplicate}
            disabled={duplicateMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted"
          >
            <Copy className="h-4 w-4" />
            {duplicateMutation.isPending ? "Duplicating…" : "Duplicate"}
          </button>
          <button
            type="button"
            onClick={handleArchive}
            disabled={archiveMutation.isPending || drill.isArchived}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted"
          >
            <Archive className="h-4 w-4" />
            {drill.isArchived
              ? "Archived"
              : archiveMutation.isPending
                ? "Archiving…"
                : "Archive"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:bg-card dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Practice items", value: String(itemCount) },
          { label: "Assigned learners", value: String(assignedCount) },
          {
            label: "Duration",
            value: drill.durationDays ? `${drill.durationDays}d` : "—",
          },
          {
            label: "Updated",
            value: `${formatRelativeTime(updatedAt)} · ${creatorDisplayName(drill)}`,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-border dark:bg-card"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-foreground">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {(drill.completionDate || drill.preGenerateAudio || drill.ttsVoiceKey) && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm dark:border-border dark:bg-card">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-muted-foreground">
            Settings
          </h3>
          <dl className="grid gap-2 sm:grid-cols-3">
            {drill.completionDate ? (
              <div>
                <dt className="text-xs text-gray-500">Completion date</dt>
                <dd className="text-gray-900 dark:text-foreground">
                  {new Date(drill.completionDate).toLocaleDateString()}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs text-gray-500">Pre-generate audio</dt>
              <dd className="text-gray-900 dark:text-foreground">
                {drill.preGenerateAudio ? "Yes" : "No"}
              </dd>
            </div>
            {drill.ttsVoiceKey ? (
              <div>
                <dt className="text-xs text-gray-500">Voice</dt>
                <dd className="text-gray-900 dark:text-foreground">
                  {String(drill.ttsVoiceKey)}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-foreground">
          Content
        </h2>
        <ClinicContentPreview drill={drill} />
      </div>

      {showAssign ? (
        <ClinicAssignModal
          drillId={drillId}
          drillTitle={String(drill.title ?? "")}
          onClose={() => setShowAssign(false)}
        />
      ) : null}

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 dark:border-border dark:bg-card">
            <h3 className="text-lg font-bold text-gray-900 dark:text-foreground">
              Delete Drill
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-muted-foreground">
              Are you sure you want to delete &quot;{drill.title}&quot;? This
              action cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-border dark:text-foreground dark:hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
