"use client";

import { useRef, useState } from "react";
import { Bot, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { PRESET_AVATARS } from "@/lib/preset-avatars";
import { drillAPI } from "@/lib/api";

interface RoleAvatarPickerProps {
  value: string;
  onChange: (url: string) => void;
  characterLabel?: string;
}

/**
 * Compact circular preview + expandable preset grid / custom upload
 * for AI character avatars on roleplay drills.
 */
export function RoleAvatarPicker({
  value,
  onChange,
  characterLabel,
}: RoleAvatarPickerProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setUploading(true);
    try {
      const res = await drillAPI.uploadRoleAvatar(file);
      const url = res?.data?.url;
      if (!url) {
        throw new Error("No URL returned");
      }
      onChange(url);
      setOpen(false);
      toast.success("Avatar uploaded");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to upload avatar";
      toast.error(message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          characterLabel
            ? `Choose avatar for ${characterLabel}`
            : "Choose character avatar"
        }
        aria-expanded={open}
        className="relative w-11 h-11 rounded-full overflow-hidden border border-gray-200 bg-gray-50 hover:ring-2 hover:ring-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="flex w-full h-full items-center justify-center text-gray-400">
            <Bot className="w-5 h-5" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold text-gray-700">Character avatar</p>
            <div className="flex items-center gap-1">
              {value ? (
                <button
                  type="button"
                  onClick={() => onChange("")}
                  className="rounded-md px-2 py-1 text-[11px] font-semibold text-gray-500 hover:bg-gray-50"
                >
                  Clear
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                aria-label="Close avatar picker"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="mb-3 grid max-h-40 grid-cols-5 gap-1.5 overflow-y-auto">
            {PRESET_AVATARS.map((url, idx) => {
              const isSelected = value === url;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onChange(url);
                    setOpen(false);
                  }}
                  className={`relative aspect-square overflow-hidden rounded-full transition-all ${
                    isSelected
                      ? "ring-2 ring-emerald-500 ring-offset-1"
                      : "hover:ring-1 hover:ring-gray-200"
                  }`}
                  aria-label={`Select preset avatar ${idx + 1}`}
                  aria-pressed={isSelected}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                Upload custom
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
        </div>
      )}
    </div>
  );
}
