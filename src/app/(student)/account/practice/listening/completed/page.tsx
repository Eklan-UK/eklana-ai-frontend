"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckCircle, Headphones, Award, TrendingUp } from "lucide-react";

export default function ListeningCompletedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Celebration */}
        <div className="text-center mb-8">
          <div className="w-32 h-32 mx-auto bg-primary-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-20 h-20 text-primary-600" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Listening Practice Completed!
          </h1>
          <p className="text-base text-gray-600">
            Great job improving your listening skills!
          </p>
        </div>

        {/* Stats Card */}
        <Card className="mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex justify-center mb-2">
                <Headphones className="w-6 h-6 text-primary-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">85%</p>
              <p className="text-xs text-gray-500 mt-1">Accuracy</p>
            </div>
            <div>
              <div className="flex justify-center mb-2">
                <Award className="w-6 h-6 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">+10</p>
              <p className="text-xs text-gray-500 mt-1">Points</p>
            </div>
            <div>
              <div className="flex justify-center mb-2">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">+3%</p>
              <p className="text-xs text-gray-500 mt-1">Improvement</p>
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
            onClick={() => router.push("/practice/listening")}
          >
            Practice More
          </Button>
        </div>
      </div>
    </div>
  );
}
