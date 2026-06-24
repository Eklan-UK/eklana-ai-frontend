"use client";

import { BookmarkCheck } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface CheckpointScreenProps {
  completedCount: number;
  totalCount: number;
  onContinue: () => void;
  onExit: () => void;
  drillTitle?: string;
}

export function CheckpointScreen({
  completedCount,
  totalCount,
  onContinue,
  onExit,
  drillTitle,
}: CheckpointScreenProps) {
  const remaining = totalCount - completedCount;

  return (
    <div className="min-h-screen bg-card pb-6">
      <div className="h-6" />
      <Header title={drillTitle ?? "Progress Saved"} showBack={false} />
      <div className="max-w-md mx-auto px-4 py-6">
        <Card className="text-center py-8 px-6">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/15 mx-auto mb-4">
            <BookmarkCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Progress Saved
          </h2>
          <p className="text-muted-foreground mb-1">
            You&apos;ve completed{" "}
            <span className="font-semibold text-foreground">{completedCount}</span>{" "}
            of{" "}
            <span className="font-semibold text-foreground">{totalCount}</span>{" "}
            items.
          </p>
          {remaining > 0 && (
            <p className="text-sm text-muted-foreground mb-6">
              {remaining} item{remaining !== 1 ? "s" : ""} remaining. You can
              continue now or come back later — your progress is saved.
            </p>
          )}
          <div className="flex flex-col gap-3 mt-6">
            <Button variant="primary" size="lg" fullWidth onClick={onContinue}>
              Continue
            </Button>
            <Button variant="outline" size="lg" fullWidth onClick={onExit}>
              Exit &amp; Resume Later
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
