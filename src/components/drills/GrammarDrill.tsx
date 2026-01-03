"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CheckCircle } from "lucide-react";
import Link from "next/link";

interface GrammarDrillProps {
  drill: any;
}

export default function GrammarDrill({ drill }: GrammarDrillProps) {
  const [isCompleted, setIsCompleted] = useState(false);

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-white pb-20 md:pb-0">
        <div className="h-6"></div>
        <Header title="Drill Completed" />
        <div className="max-w-md mx-auto px-4 py-6">
          <Card className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Great Job!</h2>
            <p className="text-gray-600 mb-6">You've completed the grammar drill.</p>
            <Link href="/account">
              <Button variant="primary" size="lg" fullWidth>Back to Home</Button>
            </Link>
          </Card>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      <div className="h-6"></div>
      <Header title={drill.title} />
      <div className="max-w-md mx-auto px-4 py-6">
        <Card>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Grammar Practice</h2>
          <p className="text-gray-600 mb-4">
            This grammar drill interface is coming soon. Practice grammar patterns.
          </p>
          <Button variant="primary" onClick={() => setIsCompleted(true)}>
            Mark as Complete
          </Button>
        </Card>
      </div>
      <BottomNav />
    </div>
  );
}

