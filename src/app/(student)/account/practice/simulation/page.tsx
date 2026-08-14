"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface ScenarioListItem {
  scenarioId: string;
  title: string;
  workplaceSetting: string;
  maxDurationMinutes: number;
  latestSession: { sessionId: string; status: "in_progress" | "completed" | "abandoned" } | null;
}

export default function SimulationRoomPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [startingScenarioId, setStartingScenarioId] = useState<string | null>(null);

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
                        {s.title}
                      </h3>
                      <p className="text-xs mt-0.5 text-muted-foreground line-clamp-1">
                        {s.workplaceSetting}
                      </p>
                      <p className="text-xs mt-0.5 font-medium text-emerald-700 dark:text-emerald-400">
                        {s.maxDurationMinutes} min
                      </p>
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
    </div>
  );
}
