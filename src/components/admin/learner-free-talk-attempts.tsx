"use client";

import { Loader2, Download } from "lucide-react";
import { useLearnerFreeTalkAttempts } from "@/hooks/useAdmin";
import { MarkdownText } from "@/components/ui/MarkdownText";

type AttemptRow = NonNullable<
  ReturnType<typeof useLearnerFreeTalkAttempts>["data"]
>["attempts"][number];

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function LearnerFreeTalkAttemptsSection({
  learnerId,
  learnerName,
}: {
  learnerId: string;
  learnerName: string;
}) {
  const { data, isLoading, error } = useLearnerFreeTalkAttempts(learnerId);
  const attempts = data?.attempts ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" aria-hidden />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-600">
        Could not load Eklan Simulation Room attempts for this learner.
      </p>
    );
  }

  if (attempts.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No Eklan Simulation Room sessions recorded for {learnerName} yet.
      </p>
    );
  }

  return (
    <div className="max-h-[min(28rem,70vh)] overflow-y-auto overscroll-contain pr-1 space-y-4">
      {attempts.map((row: AttemptRow) => (
        <div
          key={row.id}
          className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 space-y-3 shrink-0"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 leading-snug">{row.scenarioTitle}</p>
              <p className="text-xs text-gray-500 mt-1">
                {formatWhen(row.completedAt)}
                {row.gradeResult &&
                typeof row.gradeResult === "object" &&
                row.gradeResult !== null &&
                "overallScore" in row.gradeResult ? (
                  <span>
                    {" "}
                    · Score {(row.gradeResult as { overallScore: number }).overallScore}/100
                  </span>
                ) : null}
                {row.usedVoice ? " · Voice response" : ""}
              </p>
            </div>
          </div>

          {row.audioUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <audio controls className="h-9 max-w-full flex-1 min-w-[200px]" src={row.audioUrl} />
              <a
                href={row.audioUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Download
              </a>
            </div>
          ) : null}

          {row.feedbackText?.trim() ? (
            <div>
              <p className="text-xs font-bold text-black dark:text-[#e8ebe9] uppercase mb-1">Feedback</p>
              <div className="text-sm leading-relaxed text-black dark:text-[#e8ebe9]">
                <MarkdownText>{row.feedbackText}</MarkdownText>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
