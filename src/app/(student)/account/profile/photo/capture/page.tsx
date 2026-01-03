"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Camera, X, RotateCcw, Check } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CapturePhotoPage() {
  const router = useRouter();
  const [captured, setCaptured] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  const handleCapture = () => {
    // In a real app, this would capture from camera
    setCaptured(true);
    setImageSrc("/ui-images/placeholder-profile.jpg"); // Placeholder
  };

  const handleRetake = () => {
    setCaptured(false);
    setImageSrc(null);
  };

  const handleUsePhoto = () => {
    // In a real app, this would save the photo
    router.push("/profile/edit");
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
          <h1 className="text-white font-semibold">Take a photo</h1>
          <div className="w-10"></div>
        </div>

        {/* Camera Preview / Captured Image */}
        <div className="flex-1 relative bg-gray-900 flex items-center justify-center">
          {captured && imageSrc ? (
            <div className="relative w-full h-full">
              <img
                src={imageSrc}
                alt="Captured"
                className="w-full h-full object-cover"
              />
              {/* Crop Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 rounded-full border-4 border-white"></div>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <Camera className="w-24 h-24 text-white/50 mx-auto mb-4" />
              <p className="text-white/70">Camera preview</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-black pb-8 pt-4 px-4">
          {captured ? (
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={handleRetake}
                className="text-white"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Retake photo
              </Button>
              <Button
                variant="primary"
                onClick={handleUsePhoto}
                className="bg-yellow-500 hover:bg-yellow-600"
              >
                <Check className="w-5 h-5 mr-2" />
                Use photo
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-8">
              <button className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-gray-900 rounded-full"></div>
              </button>
            </div>
          )}

          {/* Mode Selector */}
          {!captured && (
            <div className="flex justify-center gap-4 mt-4">
              <button className="px-4 py-2 bg-gray-800 text-white rounded-full text-sm">
                Video
              </button>
              <button className="px-4 py-2 text-white rounded-full text-sm">
                Photo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
