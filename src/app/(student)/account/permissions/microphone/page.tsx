"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Mic, X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function MicrophonePermissionPage() {
  const router = useRouter();
  const [permission, setPermission] = useState<"while-using" | "once" | "deny" | null>(null);

  const handlePermission = (type: "while-using" | "once" | "deny") => {
    setPermission(type);
    // In a real app, this would request actual browser permissions
    setTimeout(() => {
      router.back();
    }, 500);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      {/* Modal Overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 relative">
          {/* Close Button */}
          <button
            onClick={() => router.back()}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center relative">
              <Mic className="w-12 h-12 text-blue-600" />
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">!</span>
              </div>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
            Allow Eklan to record audio
          </h2>

          {/* Description */}
          <p className="text-sm text-gray-600 text-center mb-6">
            We need microphone access to help you practice pronunciation and
            improve your speaking skills.
          </p>

          {/* Permission Options */}
          <div className="space-y-3">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => handlePermission("while-using")}
              className="bg-blue-600 hover:bg-blue-700"
            >
              WHILE USING THE APP
            </Button>

            <Button
              variant="outline"
              size="lg"
              fullWidth
              onClick={() => handlePermission("once")}
            >
              ONLY THIS TIME
            </Button>

            <Button
              variant="ghost"
              size="lg"
              fullWidth
              onClick={() => handlePermission("deny")}
              className="text-gray-600"
            >
              DON&apos;T ALLOW
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

