"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Loader2, ChevronRight } from "lucide-react";
import type { SessionSummaryPayload } from "@/types/ai-session-summary";

interface SessionRow {
  id: string;
  mode: string;
  topic?: string;
  summary: SessionSummaryPayload;
  endedAt: string;
}

export default function AiSessionSummariesPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/ai/session/summaries?limit=30", {
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.message || "Failed to load summaries");
        }
        if (!cancelled) {
          setSessions(json.data?.sessions ?? []);
          setTotal(json.data?.total ?? 0);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="h-6" />
      <Header showBack title="Session summaries" />

      <div className="max-w-md mx-auto px-4 py-4 md:max-w-2xl md:px-8">
        <p className="text-sm font-satoshi text-gray-500 mb-4">
          AI feedback from your recent Free Talk and practice chats ({total} total).
        </p>

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        )}

        {error && (
          <Card className="p-4 border-red-100 bg-red-50/50 text-sm text-red-800">{error}</Card>
        )}

        {!loading && !error && sessions.length === 0 && (
          <Card className="p-8 text-center text-gray-500 text-sm">
            No saved summaries yet. Finish a conversation and exit to generate one.
          </Card>
        )}

        <div className="space-y-4">
          {sessions.map((s) => (
            <Card key={s.id} className="!p-4 border-emerald-100/80">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {s.mode === "drill"
                      ? "Drill practice"
                      : s.mode === "topic"
                        ? s.topic?.replace(/-/g, " ") ?? "Topic"
                        : "Free talk"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(s.endedAt).toLocaleString()}
                  </p>
                </div>
                {typeof s.summary.overallScore === "number" && (
                  <span className="text-sm font-extrabold font-nunito text-emerald-700 tabular-nums">
                    {Math.round(s.summary.overallScore)}
                  </span>
                )}
              </div>
              <p className="text-sm font-satoshi text-gray-800 line-clamp-3">
                {s.summary.encouragement}
              </p>
              {s.summary.strengths.length > 0 && (
                <ul className="mt-2 text-xs text-gray-600 list-disc list-inside space-y-0.5">
                  {s.summary.strengths.slice(0, 2).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>

        <Link
          href="/account/practice/ai"
          className="mt-6 flex items-center justify-center gap-1 text-sm font-semibold text-emerald-600"
        >
          Back to Free Talk
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
