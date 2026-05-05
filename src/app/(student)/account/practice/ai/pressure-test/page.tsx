"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Header } from "@/components/layout/Header";
import { useLearnerDrills } from "@/hooks/useDrills";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Clock,
  Lock,
  Trophy,
  Zap,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface PTSession {
  sessionId: string;
  date: string;
  level: number;
  levelBefore: number;
  levelAfter: number;
  levelChanged: boolean;
  scores: { responseSpeed: number; accuracy: number; pronunciation: number; confidence: number };
  progressToNextLevel: number;
  strengths: string[];
  weaknesses: string[];
  nextSteps: string[];
}

interface PTHistory {
  currentLevel: number;
  totalSessions: number;
  averages: { responseSpeed: number; accuracy: number; pronunciation: number; confidence: number } | null;
  sessions: PTSession[];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScenarioCard({
  title,
  isUnlocked,
  onClick,
}: {
  title: string;
  isUnlocked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isUnlocked}
      className={`w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-4 hover:shadow-md hover:border-emerald-500/40 transition-all text-left ${
        !isUnlocked ? "opacity-60 cursor-not-allowed hover:shadow-none hover:border-border" : ""
      }`}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
        <Image src="/images/thumbnail.png" alt="Eklan" width={50} height={50} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-base font-bold font-nunito text-foreground truncate">{title}</p>
          <span className="text-xs font-satoshi text-blue-500 flex-shrink-0">• Scenario</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs font-satoshi">5–7 minutes</span>
        </div>
      </div>

      <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-full bg-muted">
        {isUnlocked ? (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Lock className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
    </button>
  );
}

function ScoreChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center px-3 py-1.5 rounded-xl bg-card border border-border">
      <span className={`text-base font-bold ${color}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>
    </div>
  );
}

function SessionHistoryRow({ session }: { session: PTSession }) {
  const [open, setOpen] = useState(false);

  const date = new Date(session.date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className="w-9 h-9 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-violet-700 dark:text-violet-300">L{session.levelAfter}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{date}</p>
          <p className="text-xs text-muted-foreground">
            {session.scores.responseSpeed.toFixed(1)}s · {session.scores.accuracy}% accuracy · {session.scores.pronunciation}% pronunciation
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {session.levelChanged && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              session.levelAfter > session.levelBefore
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-amber-500/15 text-amber-800 dark:text-amber-200"
            }`}>
              {session.levelAfter > session.levelBefore ? "↑ Level Up" : "↓ Level Down"}
            </span>
          )}
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
          {/* Progress bar */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-muted-foreground">Progress to Level {session.levelAfter + 1}</span>
              <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">{Math.round(session.progressToNextLevel)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-500 transition-all"
                style={{ width: `${Math.min(100, session.progressToNextLevel)}%` }}
              />
            </div>
          </div>

          {/* Scores */}
          <div className="grid grid-cols-4 gap-2">
            <ScoreChip label="Speed" value={`${session.scores.responseSpeed.toFixed(1)}s`} color="text-blue-600" />
            <ScoreChip label="Accuracy" value={`${session.scores.accuracy}%`} color="text-emerald-600" />
            <ScoreChip label="Pronunciation" value={`${session.scores.pronunciation}%`} color="text-orange-500" />
            <ScoreChip label="Confidence" value={`${session.scores.confidence}%`} color="text-violet-600" />
          </div>

          {/* Strengths */}
          {session.strengths.length > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1.5">What went well</p>
              <ul className="space-y-1">
                {session.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <CircleCheck className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-foreground">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next steps */}
          {session.nextSteps.length > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/25 rounded-xl p-3">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1.5">Next steps</p>
              <ul className="space-y-1">
                {session.nextSteps.map((n, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-foreground">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

/** True for plain drill documents (excludes `null`, Arrays, and Date, which have typeof "object" in JS). */
function isPlainDrillObject(d: unknown): d is Record<string, unknown> {
  if (d == null || typeof d !== "object") return false;
  if (Array.isArray(d) || d instanceof Date) return false;
  return true;
}

function isPressureTestScenarioDrill(drill: unknown): boolean {
  if (!isPlainDrillObject(drill)) return false;
  const t = String(drill.type ?? "")
    .trim()
    .toLowerCase();
  if (t === "roleplay" || t === "scenario" || t === "role_play") return true;
  if (Array.isArray(drill.roleplay_scenes) && drill.roleplay_scenes.length > 0) return true;
  return false;
}

export default function PressureTestSelectionPage() {
  const { data: drillsData, isLoading } = useLearnerDrills();
  const [history, setHistory] = useState<PTHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"practice" | "history">("practice");

  // Read ?tab= from the URL after mount (avoids useSearchParams SSR issues)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "history") setActiveTab("history");
    }
  }, []);

  useEffect(() => {
    fetch("/api/v1/pressure-test/sessions?limit=10", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.code === "Success") setHistory(d.data);
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  const scenarioAssignments = (drillsData ?? [])
    .filter((a: any) => {
      const drill = a?.drill;
      return drill && isPressureTestScenarioDrill(drill);
    })
    .map((a: any) => {
      const drill = a.drill;
      const drillId = drill._id || a.drillId;
      return {
        assignmentId: a.assignmentId || drillId,
        drillId,
        title: drill.title,
        status: a.status || "pending",
      };
    })
    .filter((a: any) => !!a.drillId);

  const sorted = [...scenarioAssignments].sort((a, b) => {
    return (a.status === "completed" ? 0 : 1) - (b.status === "completed" ? 0 : 1);
  });
  const visible = sorted.slice(0, 3);

  const hasHistory = (history?.totalSessions ?? 0) > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="h-6" />
      <Header title="Eklan Pressure Test" showBack />

      <div className="max-w-md mx-auto px-5 pb-12 md:max-w-2xl md:px-8">

        {/* Level badge — show once student has history */}
        {hasHistory && history && (
          <div className="flex items-center justify-between bg-card border border-border rounded-2xl px-4 py-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-sm">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Your Level</p>
                <p className="text-base font-bold text-foreground">Level {history.currentLevel}</p>
              </div>
            </div>
            {history.averages && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Zap className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-semibold text-foreground">{history.averages.responseSpeed.toFixed(1)}s</span>
                <span>avg speed</span>
              </div>
            )}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border mb-5">
          {(["practice", "history"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "history" ? `History${hasHistory ? ` (${history!.totalSessions})` : ""}` : "Practice"}
            </button>
          ))}
        </div>

        {/* ── Practice tab ── */}
        {activeTab === "practice" && (
          <div>
            <h1 className="text-sm text-muted-foreground mb-1">What would you like to practice today?</h1>
            <div className="mb-8 mt-4">
              <h2 className="text-sm font-bold font-nunito text-foreground mb-3">
                Based on Your Drills
              </h2>

              {isLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="bg-card border border-border rounded-2xl p-4 h-20 animate-pulse" />
                  ))}
                </div>
              ) : visible.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-5 text-center">
                  <p className="text-sm font-satoshi text-muted-foreground">
                    {Array.isArray(drillsData) && drillsData.length > 0
                      ? "You have assigned drills, but none are roleplay-style scenarios. The pressure test only lists roleplay drills (or drills with a roleplay scene). Complete a roleplay assignment or ask your tutor to assign one."
                      : "Complete a scenario drill to unlock the pressure test."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visible.map((item: any) => (
                    <ScenarioCard
                      key={item.assignmentId}
                      title={item.title}
                      isUnlocked={item.status === "completed"}
                      onClick={() => {
                        const run =
                          typeof crypto !== "undefined" && "randomUUID" in crypto
                            ? crypto.randomUUID()
                            : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                        // Full navigation so the chat route always cold-loads (no stale client state / bfcache from SPA).
                        if (typeof window !== "undefined") {
                          const url = `/account/practice/ai/pressure-test/chat?drillId=${encodeURIComponent(item.drillId)}&run=${encodeURIComponent(run)}`;
                          window.location.assign(url);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── History tab ── */}
        {activeTab === "history" && (
          <div>
            {historyLoading ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="bg-card border border-border rounded-2xl p-4 h-16 animate-pulse" />
                ))}
              </div>
            ) : !hasHistory ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center">
                <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No sessions yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Complete your first pressure test to see your history here.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("practice")}
                  className="mt-4 px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-semibold"
                >
                  Start a session
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {history!.sessions.map((s) => (
                  <SessionHistoryRow key={s.sessionId} session={s} />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
