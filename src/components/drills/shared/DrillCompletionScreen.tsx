"use client";

import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
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
  refreshOnMount?: boolean;
}

export function DrillCompletionScreen({
  title = "Drill Completed",
  message,
  drillType = "drill",
  returnPath = "/account",
  returnLabel = "Continue Learning",
  refreshOnMount = false,
}: DrillCompletionScreenProps) {
  const router = useRouter();
  const defaultMessage = `You've completed the ${drillType} drill.`;

  // Refresh the page data when component mounts if requested
  useEffect(() => {
    if (refreshOnMount) {
      router.refresh();
    }
  }, [refreshOnMount, router]);

  const handleContinue = () => {
    // Refresh before navigating to ensure updated status
    router.refresh();
    router.push(returnPath);
  };

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      <div className="h-6"></div>
      <Header title={title} showBack={true} />
      <div className="max-w-md mx-auto px-4 py-6">
        <Card className="text-center py-8">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Great Job!</h2>
          <p className="text-gray-600 mb-6">{message || defaultMessage}</p>
          <Button variant="primary" size="lg" fullWidth onClick={handleContinue}>
            {returnLabel}
          </Button>
        </Card>
      </div>
      <BottomNav />
    </div>
  );
}

