import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/react-query";

export function useDrillBookmarkToggle() {
  const queryClient = useQueryClient();

  const handleBookmarkToggle = useCallback(
    async (drillId: string, currentlyBookmarked: boolean) => {
      try {
        if (currentlyBookmarked) {
          const response = await fetch(`/api/v1/bookmarks/by-drill/${drillId}`, {
            method: "DELETE",
          });
          if (!response.ok) {
            throw new Error("Failed to remove bookmark");
          }
          toast.success("Removed from bookmarks");
        } else {
          const response = await fetch("/api/v1/bookmarks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              drillId,
              type: "drill",
              content: drillId,
            }),
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || "Failed to bookmark");
          }
          if (data.message === "Already bookmarked") {
            toast.info("Already bookmarked");
          } else {
            toast.success("Added to bookmarks!");
          }
        }

        await queryClient.invalidateQueries({
          queryKey: queryKeys.drills.learner.all(),
        });
      } catch {
        toast.error(
          currentlyBookmarked
            ? "Could not remove bookmark"
            : "Could not save bookmark",
        );
      }
    },
    [queryClient],
  );

  return { handleBookmarkToggle };
}
