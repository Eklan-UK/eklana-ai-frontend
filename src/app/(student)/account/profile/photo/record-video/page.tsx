"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Video, X, Square, Play } from "lucide-react";
import { useRouter } from "next/navigation";

export default function RecordVideoPage() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);

  const handleStartRecording = () => {
    setIsRecording(true);
    // In a real app, this would start video recording
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    setRecorded(true);
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Status Bar Space */}
      <div className="h-6 bg-black"></div>

      <div className="relative h-screen flex flex-col">
        {/* Header */}
        <div className="absolute top-6 left-0 right-0 z-10 flex items-center justify-between px-4">
          <button
            onClick={() => router.back()}
            className="p-2 bg-black/50 rounded-full backdrop-blur-sm"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-white font-semibold">Record a video</h1>
          <div className="w-10"></div>
        </div>

        {/* Video Preview */}
        <div className="flex-1 relative bg-gray-900 flex items-center justify-center">
          {recorded ? (
            <div className="relative w-full h-full">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center">
                  <Play className="w-10 h-10 text-white ml-1" />
                </div>
              </div>
              <p className="absolute bottom-4 left-4 text-white text-sm">
                Video recorded (0:15)
              </p>
            </div>
          ) : (
            <div className="text-center">
              <Video className="w-24 h-24 text-white/50 mx-auto mb-4" />
              <p className="text-white/70">Video preview</p>
              {isRecording && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                  <span className="text-red-600 font-semibold">
                    Recording...
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-black pb-8 pt-4 px-4">
          {recorded ? (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  setRecorded(false);
                  setIsRecording(false);
                }}
                className="border-white text-white"
              >
                Retake
              </Button>
              <Button
                variant="primary"
                onClick={() => router.push("/profile/edit")}
                className="bg-green-600 hover:bg-green-700"
              >
                Use Video
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              {isRecording ? (
                <button
                  onClick={handleStopRecording}
                  className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center"
                >
                  <Square className="w-8 h-8 text-white" />
                </button>
              ) : (
                <button
                  onClick={handleStartRecording}
                  className="w-16 h-16 bg-white rounded-full flex items-center justify-center"
                >
                  <div className="w-12 h-12 bg-red-600 rounded-full"></div>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
