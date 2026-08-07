"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query";

export type BookmarkListType = "word" | "sentence" | "drill";

export interface ContentBookmark {
  _id: string;
  drillId: string;
  type: "word" | "sentence" | "drill";
  content: string;
  translation?: string;
  context?: string;
  createdAt: string;
}

async function fetchBookmarks(
  type?: BookmarkListType,
): Promise<ContentBookmark[]> {
  const url = type
    ? `/api/v1/bookmarks?type=${type}`
    : "/api/v1/bookmarks";
  const response = await fetch(url);
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

export function useBookmarks(type?: BookmarkListType) {
  return useQuery({
    queryKey: queryKeys.bookmarks.byType(type),
    queryFn: () => fetchBookmarks(type),
    staleTime: 1000 * 60 * 2,
    refetchOnMount: true,
  });
}
