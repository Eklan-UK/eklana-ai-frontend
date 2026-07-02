"use client";

import Image from "next/image";
import { getUserInitials } from "@/utils/user";
import type { LearnerRecord } from "@/lib/ai-user-builder/learner-utils";
import {
  getLearnerAvatarUrl,
  getLearnerDisplayName,
} from "@/lib/ai-user-builder/learner-utils";

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-12 h-12 text-lg",
  lg: "w-16 h-16 text-xl",
} as const;

interface LearnerAvatarProps {
  learner: Pick<
    LearnerRecord,
    "name" | "firstName" | "lastName" | "email" | "avatar" | "image"
  >;
  size?: keyof typeof sizeClasses;
  className?: string;
}

export function LearnerAvatar({
  learner,
  size = "md",
  className = "",
}: LearnerAvatarProps) {
  const avatarUrl = getLearnerAvatarUrl(learner);
  const displayName = getLearnerDisplayName(learner);
  const initials = getUserInitials(learner);
  const dim = size === "sm" ? 32 : size === "lg" ? 64 : 48;

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={displayName}
        width={dim}
        height={dim}
        className={`${sizeClasses[size]} rounded-full border border-gray-200 object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${className}`}
      aria-hidden
    >
      {initials}
    </div>
  );
}
