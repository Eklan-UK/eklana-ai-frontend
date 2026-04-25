"use client";

import { useCallback, useEffect, useState } from "react";
import { adminAPI } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { SessionReviewModal } from "@/components/ai/SessionReviewModal";
import type { SessionSummaryPayload } from "@/types/ai-session-summary";
import { Loader2, Sparkles, X } from "lucide-react";

type ModeFilter = "all" | "free" | "topic" | "drill";

type SessionRow = {
  id: string;
  mode: string;
  topic?: string;
  drillId?: string;
  summary: SessionSummaryPayload;
  endedAt: string;
};

function modeLabel(s: SessionRow): string {
  if (s.mode === "drill") return "Drill practice";
  if (s.mode === "topic") return s.topic?.replace(/-/g, " ") ?? "Topic";
  return "Free talk";
}

function SummarySessionRow({
  session: s,
  onSelect,
}: {
  session: SessionRow;
  onSelect: (row: SessionRow) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(s)}
      className="w-full text-left rounded-2xl border border-emerald-100/80 bg-white p-4 hover:border-emerald-300 hover:shadow-sm transition"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{modeLabel(s)}</p>
          {s.mode === "drill" && s.drillId && (
            <p className="text-xs text-gray-400 mt-0.5">Drill ID: {s.drillId}</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">{new Date(s.endedAt).toLocaleString()}</p>
        </div>
        {typeof s.summary.overallScore === "number" && (
          <span className="text-sm font-extrabold font-nunito text-emerald-700 tabular-nums">
            {Math.round(s.summary.overallScore)}
          </span>
        )}
      </div>
      <p className="text-sm font-satoshi text-gray-800 line-clamp-2">{s.summary.encouragement}</p>
      <p className="text-xs text-emerald-600 font-semibold mt-2">View full summary</p>
    </button>
  );
}

export function LearnerAiSessionsSection({ learnerId }: { learnerId: string }) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [selected, setSelected] = useState<SessionRow | null>(null);
  const [showMoreModal, setShowMoreModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params =
        modeFilter === "all"
          ? { limit: 25 }
          : { limit: 25, mode: modeFilter as "free" | "topic" | "drill" };
      const res = await adminAPI.getLearnerAiSessions(learnerId, params);
      const data = res.data;
      setSessions((data?.sessions ?? []) as SessionRow[]);
      setTotal(data?.total ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load summaries");
      setSessions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [learnerId, modeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setShowMoreModal(false);
  }, [learnerId, modeFilter]);

  const latest = sessions[0];
  const olderCount = sessions.length > 1 ? sessions.length - 1 : 0;

  const openDetailFromMore = (row: SessionRow) => {
    setShowMoreModal(false);
    setSelected(row);
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-600" />
          Eklan AI session summaries
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Same feedback the learner sees after Free Talk and practice sessions ({total} total
          {modeFilter !== "all" ? " matching filter" : ""}).
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {(
            [
              ["all", "All"],
              ["free", "Free talk"],
              ["topic", "Topic"],
              ["drill", "Drill"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setModeFilter(value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                modeFilter === value
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-gray-700 border-gray-200 hover:border-emerald-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        )}

        {error && (
          <Card className="p-4 border-red-100 bg-red-50/50 text-sm text-red-800">{error}</Card>
        )}

        {!loading && !error && sessions.length === 0 && (
          <Card className="p-8 text-center text-gray-500 text-sm">
            No saved session summaries yet for this learner.
          </Card>
        )}

        {!loading && !error && latest && (
          <div className="space-y-3">
            <SummarySessionRow session={latest} onSelect={setSelected} />
            {olderCount > 0 && (
              <button
                type="button"
                onClick={() => setShowMoreModal(true)}
                className="w-full text-center text-sm font-semibold text-emerald-700 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 transition"
              >
                More ({olderCount} older)
              </button>
            )}
          </div>
        )}
      </div>

      {showMoreModal && sessions.length > 1 && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            aria-hidden
            onClick={() => setShowMoreModal(false)}
          />
          <div className="relative w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
              <h3 className="text-base font-bold text-gray-900">Older summaries</h3>
              <button
                type="button"
                onClick={() => setShowMoreModal(false)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 px-2 py-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" aria-hidden />
                Close
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              {sessions.slice(1).map((s) => (
                <SummarySessionRow key={s.id} session={s} onSelect={openDetailFromMore} />
              ))}
            </div>
          </div>
        </div>
      )}

      {selected && (
        <SessionReviewModal
          open
          phase="done"
          summary={selected.summary}
          primaryCtaLabel="Close"
          onBackToHome={() => setSelected(null)}
        />
      )}
    </>
  );
}
