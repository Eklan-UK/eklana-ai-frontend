"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Briefcase, X, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface ScenarioListItem {
  scenarioId: string;
  workplaceSetting: string;
  maxDurationMinutes: number;
  topic: string | null;
  latestSession: { sessionId: string; status: "in_progress" | "completed" | "abandoned" } | null;
}

// Shape matches GradeResult in [sessionId]/page.tsx — same
// /grade response persisted as session.overallGradeResult and returned
// in full (no trimming) by GET .../attempts.
interface MispronouncedWord {
  word: string;
  score: number;
  turnNumber: number;
}

interface GrammarError {
  studentTurnNumber: number;
  quotedText: string;
  errorType: "context_error" | "phrasing_error";
  correctedVersion: string;
  explanation: string;
}

// Sub-fields are optional, not just their arrays defaulted — a session graded
// before a given sub-grading pass existed (or whose pass failed in a way that
// didn't hit the documented { errors: [] }-style fallback) can have the field
// missing entirely rather than present-but-empty. Every read of these must
// tolerate that, not just assume at least an empty array/object.
interface AttemptGradeResult {
  pronunciation?: { gradedTurnCount: number; failedTurnCount: number; mispronouncedWords?: MispronouncedWord[] };
  grammar?: { errors?: GrammarError[] };
  competency?: { competencyScores?: unknown[]; overallSummary?: string };
  gradedAt: string;
}

interface AttemptListItem {
  sessionId: string;
  status: "in_progress" | "completed" | "abandoned";
  attemptedAt: string;
  overallGradeResult: AttemptGradeResult | null;
}

export default function SimulationRoomPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [startingScenarioId, setStartingScenarioId] = useState<string | null>(null);

  const [attemptsScenario, setAttemptsScenario] = useState<ScenarioListItem | null>(null);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attempts, setAttempts] = useState<AttemptListItem[]>([]);
  const [selectedAttemptIndex, setSelectedAttemptIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/v1/simulation/scenarios", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load scenarios");
        const json = await res.json();
        if (cancelled) return;
        setScenarios(json.data?.scenarios ?? []);
      } catch {
        if (!cancelled) toast.error("Failed to load simulation scenarios.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleStart = useCallback(
    async (scenarioId: string) => {
      setStartingScenarioId(scenarioId);
      try {
        const res = await fetch("/api/v1/simulation/sessions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenarioId }),
        });
        if (!res.ok) throw new Error("Failed to start session");
        const json = await res.json();
        const sessionId = json.data?.sessionId;
        if (!sessionId) throw new Error("No session ID returned");
        router.push(`/account/practice/simulation/${sessionId}`);
      } catch {
        toast.error("Failed to start simulation session.");
        setStartingScenarioId(null);
      }
    },
    [router],
  );

  const handleShowAttempts = useCallback(async (scenario: ScenarioListItem) => {
    setAttemptsScenario(scenario);
    setAttemptsLoading(true);
    setAttempts([]);
    try {
      const res = await fetch(`/api/v1/simulation/scenarios/${scenario.scenarioId}/attempts`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load attempts");
      const json = await res.json();
      setAttempts(json.data?.attempts ?? []);
    } catch {
      toast.error("Failed to load past attempts.");
      setAttemptsScenario(null);
    } finally {
      setAttemptsLoading(false);
    }
  }, []);

  const closeAttempts = useCallback(() => {
    setAttemptsScenario(null);
    setAttempts([]);
    setSelectedAttemptIndex(null);
  }, []);

  const selectedAttempt =
    selectedAttemptIndex !== null ? attempts[selectedAttemptIndex] ?? null : null;
  const selectedGrade = selectedAttempt?.overallGradeResult ?? null;
  const selectedMispronouncedWords = selectedGrade?.pronunciation?.mispronouncedWords ?? [];
  const selectedGrammarErrors = selectedGrade?.grammar?.errors ?? [];
  const selectedOverallSummary = selectedGrade?.competency?.overallSummary || "No summary available.";

  return (
    <div className="min-h-screen bg-background pb-[max(5.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="h-6" />
      <Header title="Simulation Room" showBack backHref="/account/practice" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3">Scenarios</h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#22c55e]" />
            </div>
          ) : scenarios.length === 0 ? (
            <Card className="p-8 text-center">
              <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No scenarios assigned yet</h3>
              <p className="text-muted-foreground text-sm">
                Check back after your instructor assigns a Simulation Room scenario.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {scenarios.map((s) => {
                const status = s.latestSession?.status ?? null;
                const isStarting = startingScenarioId === s.scenarioId;

                return (
                  <div
                    key={s.scenarioId}
                    className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3 shadow-sm"
                  >
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-200 to-teal-300 flex items-center justify-center shrink-0 shadow-inner">
                      <Briefcase className="w-7 h-7 text-emerald-800" aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">
                        {s.topic ?? "Untitled scenario"}
                      </h3>
                      <p className="text-xs mt-0.5 text-muted-foreground line-clamp-1">
                        {s.workplaceSetting}
                      </p>
                      <p className="text-xs mt-0.5 font-medium text-emerald-700 dark:text-emerald-400">
                        {s.maxDurationMinutes} min
                      </p>
                      {s.latestSession && (
                        <button
                          type="button"
                          onClick={() => handleShowAttempts(s)}
                          className="text-xs mt-1 font-medium text-primary hover:underline"
                        >
                          Show attempts
                        </button>
                      )}
                    </div>
                    {status === "completed" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        disabled={isStarting}
                        onClick={() => handleStart(s.scenarioId)}
                      >
                        {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Try Again"}
                      </Button>
                    ) : status === "in_progress" ? (
                      <Button
                        size="sm"
                        className="shrink-0"
                        onClick={() =>
                          router.push(`/account/practice/simulation/${s.latestSession!.sessionId}`)
                        }
                      >
                        Continue
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="shrink-0"
                        disabled={isStarting}
                        onClick={() => handleStart(s.scenarioId)}
                      >
                        {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <BottomNav />

      {attemptsScenario && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center"
          onClick={closeAttempts}
        >
          <div
            className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-t-2xl bg-card p-6 md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex items-start gap-2">
                {selectedAttempt && (
                  <button
                    type="button"
                    onClick={() => setSelectedAttemptIndex(null)}
                    aria-label="Back to attempts list"
                    className="rounded-full p-1.5 -ml-1.5 text-muted-foreground hover:bg-muted shrink-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {selectedAttempt ? `Attempt ${selectedAttemptIndex! + 1} Detail` : "Past Attempts"}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {attemptsScenario.topic ?? "Untitled scenario"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAttempts}
                aria-label="Close"
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedAttempt ? (
              selectedGrade && (
                <div className="mt-4 w-full space-y-4 rounded-2xl border border-border bg-muted/40 p-4 text-left">
                  <div>
                    <p className="font-nunito text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Summary
                    </p>
                    <p className="font-nunito text-sm text-foreground">{selectedOverallSummary}</p>
                  </div>

                  <div>
                    <p className="font-nunito text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Mispronounced words
                    </p>
                    {selectedMispronouncedWords.length === 0 ? (
                      <p className="font-nunito text-sm text-muted-foreground">
                        No mispronounced words detected.
                      </p>
                    ) : (
                      <ul className="mt-1 flex flex-wrap gap-2">
                        {selectedMispronouncedWords.map((w, idx) => (
                          <li
                            key={idx}
                            className="rounded-full bg-muted px-3 py-1 font-nunito text-sm text-foreground"
                          >
                            {w.word}{" "}
                            <span className="text-xs text-muted-foreground">
                              ({Math.round(w.score)})
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="font-nunito text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Misused words / grammar
                    </p>
                    {selectedGrammarErrors.length === 0 ? (
                      <p className="font-nunito text-sm text-muted-foreground">
                        No grammar issues detected.
                      </p>
                    ) : (
                      <ul className="mt-1 space-y-2">
                        {selectedGrammarErrors.map((err, idx) => (
                          <li key={idx} className="font-nunito text-sm text-foreground">
                            <span className="text-muted-foreground line-through">{err.quotedText}</span>{" "}
                            → <span className="font-medium">{err.correctedVersion}</span>
                            <p className="text-xs text-muted-foreground">{err.explanation}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )
            ) : attemptsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-[#22c55e]" />
              </div>
            ) : attempts.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No attempts recorded yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {attempts.map((attempt, idx) => {
                  const isGraded = Boolean(attempt.overallGradeResult);
                  return (
                    <div
                      key={attempt.sessionId}
                      role={isGraded ? "button" : undefined}
                      tabIndex={isGraded ? 0 : undefined}
                      onClick={isGraded ? () => setSelectedAttemptIndex(idx) : undefined}
                      onKeyDown={
                        isGraded
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedAttemptIndex(idx);
                              }
                            }
                          : undefined
                      }
                      className={`rounded-xl border border-border bg-muted/40 p-3 ${
                        isGraded ? "cursor-pointer transition-colors hover:bg-muted/70" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">Attempt {idx + 1}</p>
                        <span
                          className={`text-xs font-medium capitalize ${
                            attempt.status === "completed"
                              ? "text-emerald-700 dark:text-emerald-400"
                              : attempt.status === "in_progress"
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {attempt.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5 text-muted-foreground">
                        {new Date(attempt.attemptedAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      {attempt.overallGradeResult ? (
                        <div className="mt-2 space-y-1 border-t border-border pt-2">
                          <p className="text-xs text-foreground line-clamp-2">
                            {attempt.overallGradeResult.competency?.overallSummary || "No summary available."}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(attempt.overallGradeResult.pronunciation?.mispronouncedWords ?? []).length} mispronounced
                            words · {(attempt.overallGradeResult.grammar?.errors ?? []).length} grammar issues
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs mt-2 text-muted-foreground italic">Not graded</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <Button className="mt-5" fullWidth onClick={selectedAttempt ? () => setSelectedAttemptIndex(null) : closeAttempts}>
              {selectedAttempt ? "Back to list" : "Close"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
