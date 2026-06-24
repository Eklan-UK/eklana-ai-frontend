"use client";

import { CheckCircle } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { playDrillEndCelebration } from "@/lib/practice-feedback";

interface DrillCompletionScreenProps {
  title?: string;
  message?: string;
  drillType?: string;
  returnPath?: string;
  returnLabel?: string;
  /** When true, plays end-of-drill celebration on mount (drills without a separate score screen). */
  celebrate?: boolean;
  /** Override celebration MP3 (e.g. from POST /complete `effects.soundUrl`). */
  celebrationSoundUrl?: string;
  /** Optional content below the default message (e.g. session transcripts). */
  extraContent?: ReactNode;
}

export function DrillCompletionScreen({
  title = "Drill Completed",
  message,
  drillType = "drill",
  returnPath = "/account/drills",
  returnLabel = "Continue Learning",
  celebrate = false,
  celebrationSoundUrl,
  extraContent,
}: DrillCompletionScreenProps) {
  const router = useRouter();
  const defaultMessage = `You've completed the ${drillType} drill.`;

  useEffect(() => {
    if (celebrate) {
      playDrillEndCelebration(celebrationSoundUrl);
    }
  }, [celebrate, celebrationSoundUrl]);

  const handleContinue = () => {
    router.push(returnPath);
    void router.refresh();
  };

  return (
    <div className="min-h-screen bg-card pb-6">
      <div className="h-6"></div>
      <Header title={title} showBack={true} backHref={returnPath} />
      <div className="max-w-md mx-auto px-4 py-6">
        <Card className="text-center py-8">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Great Job!</h2>
          <p className="text-muted-foreground mb-6">{message || defaultMessage}</p>
          {extraContent ? (
            <div className="text-left mb-6 w-full">{extraContent}</div>
          ) : null}
          <Button variant="primary" size="lg" fullWidth onClick={handleContinue}>
            {returnLabel}
          </Button>
        </Card>
      </div>
    </div>
  );
}
