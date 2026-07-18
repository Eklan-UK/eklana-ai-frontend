"use client";

import { Bookmark, Loader2 } from "lucide-react";
import { useToggleAdminDrillBookmark } from "@/hooks/useAdmin";

interface AdminDrillBookmarkButtonProps {
  drillId: string;
  isBookmarked: boolean;
  className?: string;
  /** Called after a successful toggle with the new bookmarked state. */
  onToggled?: (bookmarked: boolean) => void;
}

/**
 * Admin library bookmark toggle (filled = bookmarked).
 * Uses Drill.is_bookmarked via POST/DELETE /drills/:id/bookmark.
 */
export function AdminDrillBookmarkButton({
  drillId,
  isBookmarked,
  className = "",
  onToggled,
}: AdminDrillBookmarkButtonProps) {
  const mutation = useToggleAdminDrillBookmark();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (mutation.isPending) return;
    mutation.mutate(
      { drillId, bookmarked: isBookmarked },
      {
        onSuccess: () => {
          onToggled?.(!isBookmarked);
        },
      }
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={mutation.isPending}
      className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
        isBookmarked
          ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50"
          : "text-gray-600 hover:text-amber-500 hover:bg-amber-50"
      } ${className}`}
      title={isBookmarked ? "Remove bookmark" : "Bookmark drill"}
      aria-label={isBookmarked ? "Remove bookmark" : "Bookmark drill"}
      aria-pressed={isBookmarked}
    >
      {mutation.isPending ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Bookmark
          className="w-4 h-4"
          fill={isBookmarked ? "currentColor" : "none"}
        />
      )}
    </button>
  );
}
