"use client";

import { CheckCircle, Loader2, RotateCcw } from "lucide-react";

export type RoleplayAnalysisOverlayState = "processing" | "pass" | "fail";

const COPY: Record<
  RoleplayAnalysisOverlayState,
  { title: string; subtitle?: string }
> = {
  processing: { title: "Processing…" },
  pass: {
    title: "Nice work!",
    subtitle: "Line passed — continuing…",
  },
  fail: {
    title: "Let's try that again",
    subtitle: "That wasn't quite clear enough.",
  },
};

interface RoleplayAnalysisOverlayProps {
  state: RoleplayAnalysisOverlayState;
}

export function RoleplayAnalysisOverlay({ state }: RoleplayAnalysisOverlayProps) {
  const copy = COPY[state];

  const cardClass =
    state === "pass"
      ? "border-emerald-500/35 bg-emerald-50/85 dark:border-emerald-400/25 dark:bg-emerald-950/75"
      : state === "fail"
        ? "border-red-500/35 bg-red-50/85 dark:border-red-400/25 dark:bg-red-950/75"
        : "border-border/60 bg-card/85";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy={state === "processing"}
      aria-label={copy.title}
    >
      <div
        className={`w-[280px] max-w-full rounded-2xl border px-6 py-8 text-center shadow-lg backdrop-blur-sm ${cardClass}`}
      >
        <div className="mb-4 flex justify-center">
          {state === "processing" && (
            <Loader2 className="h-10 w-10 animate-spin text-emerald-600 dark:text-emerald-400" />
          )}
          {state === "pass" && (
            <CheckCircle className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          )}
          {state === "fail" && (
            <RotateCcw className="h-10 w-10 text-red-600 dark:text-red-400" />
          )}
        </div>
        <p className="text-lg font-semibold text-foreground">{copy.title}</p>
        {copy.subtitle ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{copy.subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
