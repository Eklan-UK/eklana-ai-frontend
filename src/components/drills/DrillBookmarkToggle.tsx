"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useDrillBookmarkToggle } from "@/hooks/useDrillBookmarkToggle";
import { queryKeys } from "@/lib/react-query";

interface DrillBookmarkToggleProps {
  drillId: string;
  className?: string;
}

async function fetchDrillBookmarkStatus(): Promise<string[]> {
  const response = await fetch("/api/v1/bookmarks/drill-status");
  if (!response.ok) {
    throw new Error("Failed to fetch drill bookmark status");
  }
  const data = await response.json();
  return (data.bookmarkedDrillIds ?? []).map((id: string) => String(id));
}

/**
 * Learner drill-level bookmark toggle for DrillLayout headerRight.
 * Uses type: 'drill' via useDrillBookmarkToggle (same as Learning Journey / Saved Drills).
 */
export function DrillBookmarkToggle({
  drillId,
  className = "",
}: DrillBookmarkToggleProps) {
  const [loading, setLoading] = useState(false);
  const { handleBookmarkToggle } = useDrillBookmarkToggle();
  const normalizedId = String(drillId || "");

  const { data: bookmarkedIds = [], isLoading } = useQuery({
    queryKey: queryKeys.bookmarks.drillStatus(),
    queryFn: fetchDrillBookmarkStatus,
    enabled: Boolean(normalizedId),
  });

  const isBookmarked = bookmarkedIds.includes(normalizedId);

  const handleClick = async () => {
    if (!normalizedId || loading) return;
    setLoading(true);
    try {
      await handleBookmarkToggle(normalizedId, isBookmarked);
    } finally {
      setLoading(false);
    }
  };

  if (!normalizedId) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`p-2 h-auto rounded-full bg-muted/60 ${
        isBookmarked
          ? "text-[#22c55e] hover:text-[#16a34a] hover:bg-green-50"
          : "text-foreground hover:text-[#22c55e] hover:bg-green-50"
      } ${className}`}
      onClick={handleClick}
      disabled={loading || isLoading}
      title={isBookmarked ? "Remove from bookmarks" : "Save to bookmarks"}
      aria-label={isBookmarked ? "Remove from bookmarks" : "Save to bookmarks"}
      aria-pressed={isBookmarked}
    >
      {loading || isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : isBookmarked ? (
        <BookmarkCheck className="w-5 h-5" strokeWidth={2.25} />
      ) : (
        <Bookmark className="w-5 h-5" strokeWidth={2.25} />
      )}
    </Button>
  );
}
