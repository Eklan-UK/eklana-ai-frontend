"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Bookmark as BookmarkIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { queryKeys } from "@/lib/react-query";
import { celebrateBadgesFromApiResponse } from "@/lib/badges/celebrate-badge-unlock";

interface BookmarkButtonProps {
  itemId: string;
  itemType: "word" | "sentence";
  content: string;
  translation?: string;
  context?: string;
  sourceDrillId: string;
  className?: string;
}

export function BookmarkButton({
  itemId,
  itemType,
  content,
  translation,
  context,
  sourceDrillId,
  className = "",
}: BookmarkButtonProps) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleBookmark = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drillId: sourceDrillId,
          type: itemType,
          content,
          translation,
          context,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.message === "Already bookmarked") {
          toast.info("Item already bookmarked");
        } else {
          toast.success("Added to bookmarks!");
          celebrateBadgesFromApiResponse(data);
          await queryClient.invalidateQueries({ queryKey: queryKeys.badges.all });
          await queryClient.invalidateQueries({ queryKey: ["user-streak"] });
        }
      } else {
        throw new Error(data.message || "Failed to bookmark");
      }
    } catch (error) {
      toast.error("Could not save bookmark");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`p-2 h-auto text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full ${className}`}
      onClick={handleBookmark}
      disabled={loading}
      title="Save to bookmarks"
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <BookmarkIcon className="w-5 h-5" />
      )}
    </Button>
  );
}
