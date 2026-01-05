"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function DrillNotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <AlertTriangle className="w-16 h-16 text-amber-600 mx-auto mb-4" />

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Drill Not Found
        </h1>

        <p className="text-gray-600 mb-6">
          The drill you're looking for doesn't exist or has been deleted. Please
          check the drill ID and try again.
        </p>

        <div className="flex gap-3">
          <Button
            onClick={() => router.push("/account/drills")}
            className="flex-1 flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Drills
          </Button>

          <Button
            onClick={() => router.push("/account")}
            variant="secondary"
            className="flex-1"
          >
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}
