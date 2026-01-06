"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckCircle, MessageSquare, Clock, TrendingUp } from "lucide-react";

export default function SpeakingCompletedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Celebration */}
        <div className="text-center mb-8">
          <div className="w-32 h-32 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-20 h-20 text-green-600" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Conversation Completed!
          </h1>
          <p className="text-base text-gray-600">
            Excellent work on your speaking practice!
          </p>
        </div>

        {/* Stats Card */}
        <Card className="mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex justify-center mb-2">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">12</p>
              <p className="text-xs text-gray-500 mt-1">Exchanges</p>
            </div>
            <div>
              <div className="flex justify-center mb-2">
                <Clock className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">8m</p>
              <p className="text-xs text-gray-500 mt-1">Duration</p>
            </div>
            <div>
              <div className="flex justify-center mb-2">
                <TrendingUp className="w-6 h-6 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">92%</p>
              <p className="text-xs text-gray-500 mt-1">Fluency</p>
            </div>
          </div>
        </Card>

        {/* Feedback */}
        <Card className="mb-6 bg-green-50 border-green-200">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-6 h-6 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Great improvement!
              </p>
              <p className="text-xs text-gray-600">
                Your confidence and fluency are improving. Keep practicing!
              </p>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => router.push("/account")}
          >
            Continue Learning
          </Button>
          <Button
            variant="outline"
            size="lg"
            fullWidth
            onClick={() => router.push("/practice/speaking")}
          >
            Practice More
          </Button>
        </div>
      </div>
    </div>
  );
}

