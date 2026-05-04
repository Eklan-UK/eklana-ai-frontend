"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { useAuthStore } from "@/store/auth-store";
import { useRouter } from "next/navigation";
import { profileService } from "@/services/profile.service";
import { toast } from "sonner";
import Image from "next/image";
import { X, Camera, Image as ImageIcon } from "lucide-react";

/**
 * 30 preset cartoon avatars powered by DiceBear (stable, free, diverse).
 * These can be swapped out for Cloudinary-hosted images later.
 */
const PRESET_AVATARS: string[] = Array.from(
  { length: 30 },
  (_, i) =>
    `https://api.dicebear.com/9.x/avataaars/png?seed=eklan${
      i + 1
    }&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&size=128`
);

type Sheet = "none" | "photoUpdate" | "camera";

export default function ProfilePhotoPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>("none");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const currentAvatar = user?.avatar ?? null;
  const displayAvatar = selectedAvatar ?? capturedImage ?? currentAvatar;

  // Check if Save should be enabled (something has changed)
  const hasChanges =
    (selectedAvatar !== null && selectedAvatar !== currentAvatar) ||
    capturedFile !== null;

  const handleAvatarSelect = (url: string) => {
    setSelectedAvatar(url);
    setCapturedFile(null);
    setCapturedImage(null);
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    try {
      if (capturedFile) {
        await profileService.uploadAvatar(capturedFile);
        toast.success("Photo updated");
      } else if (selectedAvatar) {
        await profileService.setPresetAvatar(selectedAvatar);
        toast.success("Avatar updated");
      }
      router.back();
    } catch (error: any) {
      toast.error(error.message || "Failed to save avatar");
    } finally {
      setIsSaving(false);
    }
  };

  // Called when the camera/gallery file input fires
  const handleFileChosen = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, source: "camera" | "gallery") => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5 MB");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
        setCapturedFile(file);
        setSelectedAvatar(null);
        if (source === "camera") {
          setSheet("camera");
        } else {
          setSheet("none");
        }
      };
      reader.readAsDataURL(file);

      // Reset input so the same file can be re-selected after retake
      e.target.value = "";
    },
    []
  );

  const handleRetake = () => {
    setCapturedImage(null);
    setCapturedFile(null);
    setSheet("none");
    // Re-trigger camera
    setTimeout(() => cameraInputRef.current?.click(), 100);
  };

  const handleUsePhoto = () => {
    setSheet("none");
  };

  const closeSheet = () => setSheet("none");

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="h-6" />
      <Header showBack title="Profile image" />

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto pb-32 px-5 pt-6">
        {/* Avatar preview + camera trigger */}
        <div className="flex flex-col items-center gap-8">
          <button
            type="button"
            onClick={() => setSheet("photoUpdate")}
            className="relative w-[74px] h-[74px] shrink-0"
            aria-label="Change photo"
          >
            {displayAvatar ? (
              <Image
                src={displayAvatar}
                alt="Profile"
                width={74}
                height={74}
                className="rounded-full object-cover w-full h-full border border-[#ecffed]"
              />
            ) : (
              <div className="w-full h-full rounded-full border border-[#ecffed] bg-[#fcfcfc] flex items-center justify-center">
                <ImageIcon className="w-9 h-9 text-[#c8c8c8]" />
              </div>
            )}
            {/* Camera badge */}
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#171717] rounded-full flex items-center justify-center">
              <Camera className="w-2.5 h-2.5 text-white" />
            </div>
          </button>

          {/* Preset avatar grid */}
          <div className="w-full">
            <p className="text-sm font-bold text-[#171717] mb-4">
              Choose your Avatar
            </p>
            <div className="grid grid-cols-5 gap-2">
              {PRESET_AVATARS.map((url, idx) => {
                const isSelected = selectedAvatar === url;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAvatarSelect(url)}
                    className={`relative w-full aspect-square rounded-full overflow-hidden transition-all ${
                      isSelected
                        ? "ring-2 ring-primary ring-offset-2"
                        : "ring-0"
                    }`}
                    aria-label={`Select avatar ${idx + 1}`}
                    aria-pressed={isSelected}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Avatar option ${idx + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Save button — fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 flex justify-center px-5 pb-8 pt-4 bg-white">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={`w-full max-w-md py-4 rounded-[50px] text-base font-medium text-[#fafafa] transition-all ${
            hasChanges && !isSaving
              ? "bg-primary"
              : "bg-[#e8e8e8] cursor-not-allowed"
          }`}
        >
          {isSaving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {/* ── BOTTOM SHEET: Photo update options ── */}
      {sheet === "photoUpdate" && (
        <div
          className="fixed inset-0 bg-[rgba(45,50,56,0.8)] flex items-end z-50"
          onClick={closeSheet}
        >
          <div
            className="bg-white rounded-t-[32px] w-full px-4 pt-5 pb-8 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-8">
              <p className="text-base font-bold text-[#121217]">
                Photo update
              </p>
              <button
                type="button"
                onClick={closeSheet}
                className="w-7 h-7 border border-[rgba(208,217,226,0.3)] rounded-full flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-[#171717]" />
              </button>
            </div>

            <div className="flex gap-2.5">
              {/* Take a photo */}
              <button
                type="button"
                onClick={() => {
                  closeSheet();
                  setTimeout(() => cameraInputRef.current?.click(), 50);
                }}
                className="flex-1 h-[66px] bg-[#fcfcfc] rounded-2xl relative overflow-hidden text-left"
              >
                <Camera className="absolute top-2.5 left-2.5 w-6 h-6 text-[#959595]" />
                <span className="absolute bottom-2 left-2.5 text-xs text-[#959595]">
                  Take a photo
                </span>
              </button>

              {/* Choose from gallery */}
              <button
                type="button"
                onClick={() => {
                  closeSheet();
                  setTimeout(() => galleryInputRef.current?.click(), 50);
                }}
                className="flex-1 h-[66px] bg-[#fcfcfc] rounded-2xl relative overflow-hidden text-left"
              >
                <ImageIcon className="absolute top-2.5 left-2.5 w-6 h-6 text-[#959595]" />
                <span className="absolute bottom-2 left-2.5 text-xs text-[#959595]">
                  Choose from gallery
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM SHEET: Camera preview (after capture) ── */}
      {sheet === "camera" && capturedImage && (
        <div className="fixed inset-0 bg-[rgba(45,50,56,0.8)] flex items-end z-50">
          <div className="bg-black rounded-t-[32px] w-full px-4 pt-5 pb-8 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <p className="text-base font-bold text-white">Take a photo</p>
              <button
                type="button"
                onClick={() => {
                  setCapturedImage(null);
                  setCapturedFile(null);
                  setSheet("none");
                }}
                className="w-5 h-5 flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Preview */}
            <div className="relative w-full aspect-[4/3] rounded-md overflow-hidden mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturedImage}
                alt="Captured"
                className="w-full h-full object-cover"
              />
              {/* Corner guide overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-4/5 aspect-square relative">
                  {/* TL */}
                  <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-md" />
                  {/* TR */}
                  <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-md" />
                  {/* BL */}
                  <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-md" />
                  {/* BR */}
                  <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-md" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleRetake}
                className="text-xs font-medium text-white py-1"
              >
                Retake photo
              </button>
              <button
                type="button"
                onClick={handleUsePhoto}
                className="text-xs font-medium text-[#fbd100] py-1"
              >
                Use photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => handleFileChosen(e, "camera")}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileChosen(e, "gallery")}
      />
    </div>
  );
}
