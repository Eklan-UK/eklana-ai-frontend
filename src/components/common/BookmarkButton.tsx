"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { queryKeys } from "@/lib/react-query";
import { celebrateBadgesFromApiResponse } from "@/lib/badges/celebrate-badge-unlock";

export type ContentBookmarkType = "word" | "sentence";

interface ContentBookmark {
  _id: string;
  drillId: string;
  type: ContentBookmarkType;
  content: string;
}

interface BookmarkButtonProps {
  itemType: ContentBookmarkType;
  content: string;
  translation?: string;
  context?: string;
  sourceDrillId: string;
  className?: string;
}

async function fetchContentBookmarks(
  type: ContentBookmarkType,
): Promise<ContentBookmark[]> {
  const response = await fetch(`/api/v1/bookmarks?type=${type}`);
  if (!response.ok) {
    throw new Error("Failed to fetch bookmarks");
  }
  const data = await response.json();
  return (data.bookmarks ?? []).map((b: ContentBookmark) => ({
    ...b,
    _id: String(b._id),
    drillId: String(b.drillId),
  }));
}

export function BookmarkButton({
  itemType,
  content,
  translation,
  context,
  sourceDrillId,
  className = "",
}: BookmarkButtonProps) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const normalizedContent = content?.trim() ?? "";
  const normalizedDrillId = String(sourceDrillId || "");

  const { data: bookmarks = [], isLoading } = useQuery({
    queryKey: queryKeys.bookmarks.byType(itemType),
    queryFn: () => fetchContentBookmarks(itemType),
    enabled: Boolean(normalizedDrillId && normalizedContent),
  });

  const matchingBookmark = useMemo(
    () =>
      bookmarks.find(
        (b) =>
          b.drillId === normalizedDrillId &&
          b.content === normalizedContent,
      ),
    [bookmarks, normalizedContent, normalizedDrillId],
  );

  const isBookmarked = Boolean(matchingBookmark);

  const invalidateBookmarkCaches = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.drills.learner.saved(),
    });
  };

  const handleToggle = async () => {
    if (!normalizedDrillId || !normalizedContent || loading) return;
    setLoading(true);
    try {
      if (isBookmarked && matchingBookmark) {
        const response = await fetch(
          `/api/v1/bookmarks/${matchingBookmark._id}`,
          { method: "DELETE" },
        );
        if (!response.ok) {
          throw new Error("Failed to remove bookmark");
        }
        toast.success("Removed from bookmarks");
      } else {
        const response = await fetch("/api/v1/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            drillId: normalizedDrillId,
            type: itemType,
            content: normalizedContent,
            translation,
            context,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to bookmark");
        }
        if (data.message === "Already bookmarked") {
          toast.info("Item already bookmarked");
        } else {
          toast.success("Added to bookmarks!");
          celebrateBadgesFromApiResponse(data);
          await queryClient.invalidateQueries({
            queryKey: queryKeys.badges.all,
          });
          await queryClient.invalidateQueries({ queryKey: ["user-streak"] });
        }
      }
      await invalidateBookmarkCaches();
    } catch {
      toast.error(
        isBookmarked ? "Could not remove bookmark" : "Could not save bookmark",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!normalizedDrillId || !normalizedContent) return null;

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
      onClick={handleToggle}
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
