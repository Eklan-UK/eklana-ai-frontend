"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Minus,
  MinusCircle,
  Plus,
  XCircle,
} from "lucide-react";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { Header } from "@/components/layout/Header";
import { MarkdownText } from "@/components/ui/MarkdownText";
import { aiService } from "@/services/ai.service";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { learnerHasProAccess } from "@/utils/learner-subscription";
import {
  loadFreeTalkHistory,
  type FreeTalkHistoryEntryV1,
} from "@/lib/free-talk-history";

type FreeTalkHubTab = "ongoing" | "history";

function scenarioTypeLabel(scenarioType: string): string {
  const t = scenarioType.replace(/_/g, " ").trim();
  if (!t) return "ICU practice";
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}

function HistoryAccordionItem({
  entry,
  isOpen,
  onToggle,
  last,
}: {
  entry: FreeTalkHistoryEntryV1;
  isOpen: boolean;
  onToggle: () => void;
  last?: boolean;
}) {
  const g = entry.gradeResult;
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${
          isOpen
            ? "rounded-b-none border-b-0 border-border"
            : "border-border bg-card shadow-sm"
        }`}
      >
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-foreground leading-snug">{entry.scenarioTitle}</span>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {new Date(entry.completedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {g != null ? ` · ${g.overallScore}/100` : ""}
          </p>
        </div>
        {isOpen ? (
          <Minus className="mt-0.5 h-4 w-4 shrink-0 text-[#22c55e]" aria-hidden />
        ) : (
          <Plus className="mt-0.5 h-4 w-4 shrink-0 text-[#22c55e]" aria-hidden />
        )}
      </button>
      {isOpen && (
        <div className="space-y-4 rounded-b-lg border border-t-0 border-border bg-card px-3 pb-4 pt-2">
          {g && (
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Result</p>
              <p className="mt-1 font-nunito text-base font-bold text-foreground">{g.competencyLevel}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Score {g.overallScore}/100 · {g.rawScore} / {g.maxScore} pts
              </p>
              {g.behaviours.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-border pt-3">
                  {g.behaviours.map((b) => (
                    <li key={b.id} className="flex items-start gap-2 text-xs text-foreground">
                      {b.result === "full" ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      ) : b.result === "partial" ? (
                        <MinusCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" />
                      ) : (
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                      )}
                      <span className="leading-snug">{b.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {entry.feedbackText.trim().length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Feedback
              </p>
              <div className="text-sm leading-relaxed text-foreground">
                <MarkdownText>{entry.feedbackText}</MarkdownText>
              </div>
            </div>
          )}
        </div>
      )}
      {!last && !isOpen && <div className="h-1" />}
    </div>
  );
}

export default function FreeTalkHubPage() {
  const router = useRouter();
  const { data: me, isLoading: meLoading } = useUserCurrent();
  const pro = !meLoading && learnerHasProAccess(me?.user);
  const learnerId =
    me?.user != null && (me.user._id != null || me.user.id != null)
      ? String(me.user._id ?? me.user.id)
      : "";

  const [activeTab, setActiveTab] = useState<FreeTalkHubTab>("ongoing");
  const [scenariosLoading, setScenariosLoading] = useState(true);
  const [scenariosError, setScenariosError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<{ id: string; title: string; scenarioType: string }[]>([]);
  const [history, setHistory] = useState<FreeTalkHistoryEntryV1[]>([]);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);

  useEffect(() => {
    if (!meLoading && me?.user != null && !learnerHasProAccess(me.user)) {
      router.replace("/account/settings/subscriptions");
    }
  }, [meLoading, me, router]);

  const refreshHistory = useCallback(() => {
    if (!learnerId) {
      setHistory([]);
      return;
    }
    setHistory(loadFreeTalkHistory(learnerId));
  }, [learnerId]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    if (!pro || meLoading) return;
    const ac = new AbortController();
    setScenariosLoading(true);
    setScenariosError(null);
    aiService
      .fetchFreeTalkScenarioSummaries(ac.signal)
      .then((list) => {
        setSummaries(list);
        setScenariosError(null);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === "AbortError") return;
        const msg = e instanceof Error ? e.message : "Failed to load scenarios.";
        setScenariosError(msg);
        setSummaries([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setScenariosLoading(false);
      });
    return () => ac.abort();
  }, [pro, meLoading]);

  const stats = useMemo(
    () => ({
      ongoing: summaries.length,
      history: history.length,
    }),
    [summaries.length, history.length]
  );

  const tabLabels: Record<FreeTalkHubTab, string> = {
    ongoing: "Ongoing",
    history: "History",
  };

  return (
    <div className="min-h-screen bg-background pb-[max(5.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="h-6" />
      <Header title="Eklan Free Talk" showBack backHref="/account/practice" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3">Scenarios</h2>

          <div className="bg-card rounded-2xl border border-border shadow-sm p-1 mb-4 flex gap-1">
            {(["ongoing", "history"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-2 sm:px-4 py-3 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  activeTab === tab
                    ? "bg-[#22c55e] text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <span>{tabLabels[tab]}</span>
                {stats[tab] > 0 && (
                  <span
                    className={`ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 rounded-full text-xs ${
                      activeTab === tab ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {stats[tab]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeTab === "ongoing" && (
            <>
              {scenariosLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#22c55e]" />
                </div>
              ) : scenariosError || summaries.length === 0 ? (
                <Card className="p-8 text-center">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No scenarios available</h3>
                  <p className="text-muted-foreground text-sm">
                    {scenariosError ||
                      "No free talk scenarios are configured yet. Check back after your instructor adds them."}
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {summaries.map((s) => (
                    <Link
                      key={s.id}
                      href={`/account/practice/free-talk/session?scenarioId=${encodeURIComponent(s.id)}`}
                      className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-200 to-teal-300 flex items-center justify-center shrink-0 shadow-inner">
                        <MessageSquare className="w-7 h-7 text-emerald-800" aria-hidden />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">
                          {s.title}
                        </h3>
                        <p className="text-xs mt-0.5 font-medium text-emerald-700 dark:text-emerald-400">
                          • {scenarioTypeLabel(s.scenarioType)}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden />
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "history" && (
            <>
              {!learnerId ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground text-sm">Sign in to see your practice history.</p>
                </Card>
              ) : history.length === 0 ? (
                <Card className="p-8 text-center">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No history yet</h3>
                  <p className="text-muted-foreground text-sm">
                    When you finish a scenario, your feedback and scores appear here. History is saved on this
                    device for your account.
                  </p>
                </Card>
              ) : (
                <div className="flex flex-col gap-1">
                  {history.map((entry, i) => (
                    <HistoryAccordionItem
                      key={entry.id}
                      entry={entry}
                      isOpen={openHistoryId === entry.id}
                      onToggle={() =>
                        setOpenHistoryId((cur) => (cur === entry.id ? null : entry.id))
                      }
                      last={i === history.length - 1}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
