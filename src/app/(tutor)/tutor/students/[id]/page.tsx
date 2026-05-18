"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Clock,
  FileCheck,
  Loader2,
  Mail,
  Pencil,
  Target,
  Trophy,
  Volume2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { tutorAPI } from "@/lib/api";
import { toast } from "sonner";
import { DrillSubmissionsComponent } from "@/components/admin/drill-submissions";

// ── Pressure Test types ────────────────────────────────────────────────────

interface PTScores {
  responseSpeed: number;
  accuracy: number;
  pronunciation: number;
  confidence: number;
}

interface PTTurnFeedback {
  turnNumber: number;
  feedback: string;
  rating: "strong" | "adequate" | "needs_work";
}

interface PTTurn {
  turnNumber: number;
  aiPrompt: string;
  studentResponseText: string;
  latencyMs: number;
  latencySeconds: number;
}

interface PTSession {
  sessionId: string;
  date: string;
  drillId: string | null;
  level: number;
  levelBefore: number;
  levelAfter: number;
  levelChanged: boolean;
  scores: PTScores;
  progressToNextLevel: number;
  strengths: string[];
  weaknesses: string[];
  nextSteps: string[];
  turnFeedback: PTTurnFeedback[];
}

interface PTOverview {
  student: { id: string; name: string; email: string };
  currentLevel: number;
  totalSessions: number;
  /** Fast vs slow (2s rule) from stored session turns; null if no per-turn data yet. */
  pressure2s: { fast: number; slow: number; total: number } | null;
  averages: PTScores | null;
  trends: Record<string, string> | null;
  sessions: PTSession[];
  pagination: { total: number; limit: number; offset: number };
}

interface PTSessionDetail extends PTSession {
  turns: PTTurn[];
}

// ── Pressure Test sub-components ──────────────────────────────────────────

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function TrendBadge({ trend }: { trend?: string }) {
  if (!trend) return null;
  const map: Record<string, { label: string; cls: string }> = {
    improving: { label: "↑ Improving", cls: "bg-emerald-100 text-emerald-700" },
    declining: { label: "↓ Declining", cls: "bg-red-100 text-red-700" },
    stable: { label: "→ Stable", cls: "bg-slate-100 text-slate-600" },
  };
  const m = map[trend] ?? map.stable;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>{m.label}</span>
  );
}

function RatingDot({ rating }: { rating: PTTurnFeedback["rating"] }) {
  const cls =
    rating === "strong"
      ? "bg-emerald-500"
      : rating === "adequate"
      ? "bg-amber-400"
      : "bg-red-400";
  return <span className={`inline-block w-2 h-2 rounded-full ${cls} mr-1.5`} />;
}

function PTSessionRow({
  session,
  studentId,
}: {
  session: PTSession;
  studentId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<PTSessionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const toggle = async () => {
    if (!expanded && !detail) {
      setLoadingDetail(true);
      try {
        const res = await fetch(
          `/api/v1/tutor/pressure-test/${studentId}/${session.sessionId}`,
          { credentials: "include" },
        );
        const data = await res.json();
        setDetail(data.data);
      } catch {
        // silently ignore — show basic info from overview
      } finally {
        setLoadingDetail(false);
      }
    }
    setExpanded((v) => !v);
  };

  const d = detail ?? session;
  const date = new Date(session.date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      {/* Row header */}
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center">
            <span className="text-xs font-bold text-violet-700">L{session.levelAfter}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{date}</p>
            <p className="text-xs text-slate-500">
              Speed {session.scores.responseSpeed.toFixed(1)}s &nbsp;·&nbsp;
              Accuracy {session.scores.accuracy}% &nbsp;·&nbsp;
              Pronunciation {session.scores.pronunciation}%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {session.levelChanged && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              {session.levelAfter > session.levelBefore ? "↑ Level Up" : "↓ Level Down"}
            </span>
          )}
          {loadingDetail ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 space-y-4 pt-3">
          {/* Score bars */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Response Speed", value: Math.min(100, (2 / Math.max(d.scores.responseSpeed, 0.1)) * 100), raw: `${d.scores.responseSpeed.toFixed(1)}s`, color: "bg-blue-500" },
              { label: "Accuracy", value: d.scores.accuracy, raw: `${d.scores.accuracy}%`, color: "bg-emerald-500" },
              { label: "Pronunciation", value: d.scores.pronunciation, raw: `${d.scores.pronunciation}%`, color: "bg-orange-500" },
              { label: "Confidence", value: d.scores.confidence, raw: `${d.scores.confidence}%`, color: "bg-violet-500" },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-slate-600">{m.label}</span>
                  <span className="text-xs font-semibold text-slate-800">{m.raw}</span>
                </div>
                <ScoreBar value={m.value} color={m.color} />
              </div>
            ))}
          </div>

          {/* Turn transcripts */}
          {detail?.turns && detail.turns.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Turn Transcripts
              </p>
              {detail.turns.map((t) => {
                const fb = d.turnFeedback?.find((f) => f.turnNumber === t.turnNumber);
                return (
                  <div key={t.turnNumber} className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">
                        Turn {t.turnNumber}
                      </span>
                      <span className="text-xs text-slate-400">{t.latencySeconds}s response</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      <span className="font-medium text-slate-700">AI: </span>
                      {t.aiPrompt}
                    </p>
                    <p className="text-xs text-slate-600">
                      <span className="font-medium text-slate-700">Student: </span>
                      {t.studentResponseText}
                    </p>
                    {fb && (
                      <p className="text-xs text-slate-500 italic flex items-center">
                        <RatingDot rating={fb.rating} />
                        {fb.feedback}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Strengths / Weaknesses / Next Steps */}
          {d.strengths?.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-emerald-700 mb-1.5">What went well</p>
              <ul className="space-y-1">
                {d.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <CircleCheck className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-emerald-800">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {d.weaknesses?.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1.5">Needs work</p>
              <ul className="space-y-1">
                {d.weaknesses.map((w, i) => (
                  <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                    <span className="text-amber-500 font-bold flex-shrink-0">●</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {d.nextSteps?.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1.5">Next steps</p>
              <ul className="space-y-1">
                {d.nextSteps.map((n, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-blue-800">{n}</span>
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

function PressureTestPanel({ studentId }: { studentId: string }) {
  const [data, setData] = useState<PTOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/tutor/pressure-test/${studentId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.code === "Success") setData(d.data);
        else setError(d.message || "Failed to load pressure test data.");
      })
      .catch(() => setError("Failed to load pressure test data."))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-500 text-sm">{error}</p>
      </Card>
    );
  }

  if (!data || data.totalSessions === 0) {
    return (
      <Card className="p-8 text-center">
        <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">No pressure test sessions yet.</p>
        <p className="text-slate-400 text-xs mt-1">
          Sessions will appear here once the student completes their first test.
        </p>
      </Card>
    );
  }

  const a = data.averages;
  const t = data.trends;

  return (
    <div className="space-y-5">
      {/* Overview header */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 col-span-2 bg-violet-50 border-violet-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-violet-600 font-medium">Current Level</p>
              <p className="text-3xl font-bold text-violet-900">Level {data.currentLevel}</p>
              <p className="text-xs text-violet-500 mt-0.5">{data.totalSessions} session{data.totalSessions !== 1 ? "s" : ""} completed</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-violet-600 flex items-center justify-center shadow-md">
              <Trophy className="w-7 h-7 text-white" />
            </div>
          </div>
        </Card>

        {a && (
          <>
            {data.pressure2s && data.pressure2s.total > 0 && (
              <Card className="p-3 col-span-2 bg-amber-50/80 border-amber-100">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span className="text-xs text-slate-600 font-medium">
                    2s response rule (first speech or record after AI)
                  </span>
                </div>
                <p className="text-sm text-slate-800">
                  <span className="font-bold text-emerald-700 tabular-nums">{data.pressure2s.fast}</span>
                  <span className="text-slate-500"> fast</span>
                  <span className="mx-2 text-slate-300">|</span>
                  <span className="font-bold text-amber-800 tabular-nums">{data.pressure2s.slow}</span>
                  <span className="text-slate-500"> not fast</span>
                  <span className="ml-1 text-xs text-slate-500 tabular-nums">({data.pressure2s.total} turns with data)</span>
                </p>
              </Card>
            )}
            {[
              { icon: <Zap className="w-4 h-4 text-blue-500" />, label: "Avg Speed", value: `${a.responseSpeed.toFixed(1)}s`, trend: t?.responseSpeed, bar: Math.min(100, (2 / Math.max(a.responseSpeed, 0.1)) * 100), color: "bg-blue-500" },
              { icon: <Target className="w-4 h-4 text-emerald-500" />, label: "Avg Accuracy", value: `${a.accuracy}%`, trend: t?.accuracy, bar: a.accuracy, color: "bg-emerald-500" },
              { icon: <Volume2 className="w-4 h-4 text-orange-500" />, label: "Avg Pronunciation", value: `${a.pronunciation}%`, trend: t?.pronunciation, bar: a.pronunciation, color: "bg-orange-500" },
              { icon: <CircleCheck className="w-4 h-4 text-violet-500" />, label: "Avg Confidence", value: `${a.confidence}%`, trend: t?.confidence, bar: a.confidence, color: "bg-violet-500" },
            ].map((m) => (
              <Card key={m.label} className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  {m.icon}
                  <span className="text-xs text-slate-500">{m.label}</span>
                </div>
                <div className="flex items-end justify-between mb-1.5">
                  <span className="text-lg font-bold text-slate-800">{m.value}</span>
                  <TrendBadge trend={m.trend} />
                </div>
                <ScoreBar value={m.bar} color={m.color} />
              </Card>
            ))}
          </>
        )}
      </div>

      {/* Session list */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Session History ({data.totalSessions})
        </h3>
        <div className="space-y-2">
          {data.sessions.map((s) => (
            <PTSessionRow key={s.sessionId} session={s} studentId={studentId} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface Student {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  progress: number;
  drillsCompleted: number;
  drillsActive: number;
  drillsPendingReview: number;
  drillsReviewed: number;
  drillsTotal: number;
  joinDate?: string;
  lastActivity?: string;
  recentDrills?: DrillData[];
  assignedDrills?: DrillData[];
  submittedDrills?: DrillData[];
  reviewedDrills?: DrillData[];
}

interface DrillData {
  id: string;
  drillId?: string;
  title: string;
  type: string;
  difficulty?: string;
  status: string;
  reviewStatus?: 'pending' | 'reviewed' | null;
  score?: number;
  completedAt?: string;
  dueDate?: string;
  assignedAt?: string;
}

// Drill card component
function DrillCard({ drill, showReviewButton }: { drill: DrillData; showReviewButton?: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-gray-900">{drill.title}</h3>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                drill.status === "completed"
                  ? drill.reviewStatus === "reviewed"
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                  : drill.status === "in-progress"
                  ? "bg-blue-100 text-blue-700"
                  : drill.status === "overdue"
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {drill.status === "completed"
                ? drill.reviewStatus === "reviewed"
                  ? "Reviewed"
                  : "Pending Review"
                : drill.status === "in-progress"
                ? "In Progress"
                : drill.status === "overdue"
                ? "Overdue"
                : "Pending"}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="capitalize">{drill.type}</span>
            {drill.difficulty && (
              <>
                <span>•</span>
                <span className="capitalize">{drill.difficulty}</span>
              </>
            )}
            {drill.score !== undefined && drill.score !== null && (
              <>
                <span>•</span>
                <span>Score: {drill.score}%</span>
              </>
            )}
            {drill.completedAt && (
              <>
                <span>•</span>
                <span>
                  Completed: {new Date(drill.completedAt).toLocaleDateString()}
                </span>
              </>
            )}
            {drill.status !== "completed" && drill.dueDate && (
              <>
                <span>•</span>
                <span>
                  Due: {new Date(drill.dueDate).toLocaleDateString()}
                </span>
              </>
            )}
          </div>
        </div>
        {showReviewButton && drill.drillId && (
          <Link href={`/tutor/drills/${drill.drillId}/review?assignmentId=${drill.id}`}>
            <Button variant="outline" size="sm">
              <FileCheck className="w-4 h-4 mr-1" />
              Review
            </Button>
          </Link>
        )}
      </div>
    </Card>
  );
}

export default function StudentDetailPage() {
  const params = useParams();
  const studentId = params.id as string;
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"drills" | "pressure-test">("drills");
  const [editingName, setEditingName] = useState(false);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    async function fetchStudent() {
      try {
        const response = await fetch(`/api/v1/tutor/students/${studentId}`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch student");
        }

        const data = await response.json();
        setStudent(data.data?.student || null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (studentId) {
      fetchStudent();
    }
  }, [studentId]);

  const startEditName = () => {
    if (!student) return;
    if (student.firstName != null || student.lastName != null) {
      setEditFirst(student.firstName ?? "");
      setEditLast(student.lastName ?? "");
    } else {
      const parts = student.name.trim().split(/\s+/).filter(Boolean);
      setEditFirst(parts[0] ?? "");
      setEditLast(parts.length > 1 ? parts.slice(1).join(" ") : "");
    }
    setEditingName(true);
  };

  const cancelEditName = () => {
    setEditingName(false);
    setEditFirst("");
    setEditLast("");
  };

  const saveName = async () => {
    const first = editFirst.trim();
    const last = editLast.trim();
    if (!first || !last) {
      toast.error("First and last name are required");
      return;
    }
    setSavingName(true);
    try {
      const res = await tutorAPI.updateStudentName(studentId, {
        firstName: first,
        lastName: last,
      });
      const updated = res.data.student;
      setStudent((prev) =>
        prev
          ? {
              ...prev,
              name: updated.name,
              firstName: updated.firstName,
              lastName: updated.lastName,
            }
          : null,
      );
      setEditingName(false);
      toast.success("Student name updated");
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: string }).message)
          : "Could not update name";
      toast.error(msg);
    } finally {
      setSavingName(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="h-6"></div>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/tutor/students">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition mb-4">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          </Link>
          <Card className="p-8 text-center">
            <p className="text-gray-600">
              {error || "Student not found"}
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6"></div>

      <div className="max-w-4xl mx-auto px-4 py-6 md:px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/tutor/students">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={editFirst}
                    onChange={(e) => setEditFirst(e.target.value)}
                    placeholder="First name"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={savingName}
                    autoComplete="given-name"
                  />
                  <input
                    type="text"
                    value={editLast}
                    onChange={(e) => setEditLast(e.target.value)}
                    placeholder="Last name"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={savingName}
                    autoComplete="family-name"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={saveName}
                    disabled={savingName}
                  >
                    {savingName ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={cancelEditName}
                    disabled={savingName}
                  >
                    Cancel
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 pt-1">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span className="break-all">{student.email}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-2">
                  <h1 className="text-2xl font-bold text-gray-900 truncate">
                    {student.name}
                  </h1>
                  <button
                    type="button"
                    onClick={startEditName}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 shrink-0"
                    title="Edit name"
                    aria-label="Edit student name"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span className="break-all">{student.email}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="p-4">
            <div className="text-2xl font-bold text-gray-900">
              {student.progress}%
            </div>
            <div className="text-sm text-gray-600">Overall Progress</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${student.progress}%` }}
              ></div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-2xl font-bold text-gray-900">
              {student.drillsActive}
            </div>
            <div className="text-sm text-gray-600">Active</div>
          </Card>

          <Card className="p-4 bg-yellow-50 border-yellow-200">
            <div className="text-2xl font-bold text-yellow-700">
              {student.drillsPendingReview || 0}
            </div>
            <div className="text-sm text-yellow-600">Pending Review</div>
          </Card>

          <Card className="p-4 bg-green-50 border-green-200">
            <div className="text-2xl font-bold text-green-700">
              {student.drillsReviewed || 0}
            </div>
            <div className="text-sm text-green-600">Reviewed</div>
          </Card>

          <Card className="p-4">
            <div className="text-2xl font-bold text-gray-900">
              {student.drillsTotal}
            </div>
            <div className="text-sm text-gray-600">Total Assigned</div>
          </Card>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {(["drills", "pressure-test"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "pressure-test" ? "Pressure Test" : "Drills"}
            </button>
          ))}
        </div>

        {/* ── Pressure Test panel ── */}
        {activeTab === "pressure-test" && (
          <PressureTestPanel studentId={studentId} />
        )}

        {/* ── Drill sections (hidden when on Pressure Test tab) ── */}
        {activeTab === "drills" && (
          <>
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Drill assignments &amp; results
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Expand a completed speaking drill to see the same word- and scene-level breakdown the student sees after submit.
          </p>
          <DrillSubmissionsComponent learnerId={studentId} learnerName={student.name} />
        </div>

        {/* Assigned Drills (Pending/In Progress) */}
        {student.assignedDrills && student.assignedDrills.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Assigned Drills ({student.assignedDrills.length})
            </h2>
            <div className="space-y-3">
              {student.assignedDrills.map((drill) => (
                <DrillCard key={drill.id} drill={drill} />
              ))}
            </div>
          </div>
        )}

        {/* Submitted Drills (Pending Review) */}
        {student.submittedDrills && student.submittedDrills.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              Pending Review ({student.submittedDrills.length})
            </h2>
            <div className="space-y-3">
              {student.submittedDrills.map((drill) => (
                <DrillCard key={drill.id} drill={drill} showReviewButton />
              ))}
            </div>
          </div>
        )}

        {/* Reviewed Drills */}
        {student.reviewedDrills && student.reviewedDrills.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Completed & Reviewed ({student.reviewedDrills.length})
            </h2>
            <div className="space-y-3">
              {student.reviewedDrills.slice(0, 5).map((drill) => (
                <DrillCard key={drill.id} drill={drill} />
              ))}
              {student.reviewedDrills.length > 5 && (
                <p className="text-sm text-gray-500 text-center py-2">
                  And {student.reviewedDrills.length - 5} more...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Empty state for no drills */}
        {(!student.assignedDrills || student.assignedDrills.length === 0) &&
         (!student.submittedDrills || student.submittedDrills.length === 0) &&
         (!student.reviewedDrills || student.reviewedDrills.length === 0) && (
          <Card className="p-8 text-center mb-6">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No drills assigned yet</p>
            <p className="text-sm text-gray-500">
              Assign a drill to this student to get started
            </p>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Link href={`/tutor/drills/create?student=${student.id}`} className="flex-1">
            <Button variant="primary" size="lg" fullWidth>
              <BookOpen className="w-5 h-5 mr-2" />
              Assign New Drill
            </Button>
          </Link>
        </div>

          </>
        )}
      </div>
    </div>
  );
}
