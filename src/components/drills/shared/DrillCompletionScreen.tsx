"use client";

import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface DrillCompletionScreenProps {
  title?: string;
  message?: string;
  drillType?: string;
  returnPath?: string;
  returnLabel?: string;
}

export function DrillCompletionScreen({
  title = "Drill Completed",
  message,
  drillType = "drill",
  returnPath = "/account",
  returnLabel = "Continue Learning",
}: DrillCompletionScreenProps) {
  const defaultMessage = `You've completed the ${drillType} drill.`;

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      <div className="h-6"></div>
      <Header title={title} />
      <div className="max-w-md mx-auto px-4 py-6">
        <Card className="text-center py-8">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Great Job!</h2>
          <p className="text-gray-600 mb-6">{message || defaultMessage}</p>
          <Link href={returnPath}>
            <Button variant="primary" size="lg" fullWidth>
              {returnLabel}
            </Button>
          </Link>
        </Card>
      </div>
      <BottomNav />
    </div>
  );
}

