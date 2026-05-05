"use client";

import { CheckCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface DrillCompletionScreenProps {
  title?: string;
  message?: string;
  drillType?: string;
  returnPath?: string;
  returnLabel?: string;
  /** Optional content below the default message (e.g. session transcripts). */
  extraContent?: ReactNode;
}

export function DrillCompletionScreen({
  title = "Drill Completed",
  message,
  drillType = "drill",
  returnPath = "/account/drills",
  returnLabel = "Continue Learning",
  extraContent,
}: DrillCompletionScreenProps) {
  const router = useRouter();
  const defaultMessage = `You've completed the ${drillType} drill.`;

  const handleContinue = () => {
    router.refresh();
    router.push(returnPath);
  };

  return (
    <div className="min-h-screen bg-card pb-6">
      <div className="h-6"></div>
      <Header title={title} showBack={true} />
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
