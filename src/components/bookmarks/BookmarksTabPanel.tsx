"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { BookOpen, FileText, Loader2, Quote } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { BookmarkCard } from "@/components/bookmarks/BookmarkCard";
import { SavedDrillsList } from "@/components/drills/SavedDrillsList";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useTTS } from "@/hooks/useTTS";
import { queryKeys } from "@/lib/react-query";

export type BookmarksTab = "words" | "expressions" | "drills";

export interface BookmarksTabPanelProps {
  showTopicLabel?: boolean;
  defaultTab?: BookmarksTab;
}

export function BookmarksTabPanel({
  showTopicLabel = false,
  defaultTab = "words",
}: BookmarksTabPanelProps) {
  const [tab, setTab] = useState<BookmarksTab>(defaultTab);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { playAudio } = useTTS();
  const t = useTranslations("account");

  const wordsQuery = useBookmarks("word");
  const expressionsQuery = useBookmarks("sentence");

  const tabs: { id: BookmarksTab; label: string }[] = [
    { id: "words", label: t("savedWords") },
    { id: "expressions", label: t("savedExpressions") },
    { id: "drills", label: t("savedDrills") },
  ];

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/v1/bookmarks/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete bookmark");
      }
      toast.success("Removed from bookmarks");
      await queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all });
    } catch {
      toast.error("Could not remove bookmark");
    }
  };

  const handlePlay = async (content: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await playAudio(content);
    } catch {
      // useTTS already toasts on play errors
    }
  };

  const handleGoToDrill = (drillId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!drillId) return;
    router.push(`/account/drills/${drillId}`);
  };

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Bookmark types"
        className="flex gap-1 p-1 rounded-xl bg-muted/60 overflow-x-auto"
      >
        {tabs.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              id={`bookmarks-tab-${item.id}`}
              aria-controls={`bookmarks-panel-${item.id}`}
              onClick={() => setTab(item.id)}
              className={`flex-1 min-w-0 px-2.5 py-2 rounded-lg text-xs font-semibold font-satoshi whitespace-nowrap transition-colors ${
                selected
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`bookmarks-panel-${tab}`}
        aria-labelledby={`bookmarks-tab-${tab}`}
      >
        {tab === "drills" ? (
          <SavedDrillsList showTopicLabel={showTopicLabel} />
        ) : tab === "words" ? (
          <ContentBookmarksList
            bookmarks={(wordsQuery.data ?? []).filter(
              (b) => b.type === "word",
            )}
            isLoading={wordsQuery.isLoading}
            emptyIcon={FileText}
            emptyMessage={t("savedWordsEmpty")}
            onDelete={handleDelete}
            onPlay={handlePlay}
            onGoToDrill={handleGoToDrill}
          />
        ) : (
          <ContentBookmarksList
            bookmarks={(expressionsQuery.data ?? []).filter(
              (b) => b.type === "sentence",
            )}
            isLoading={expressionsQuery.isLoading}
            emptyIcon={Quote}
            emptyMessage={t("savedExpressionsEmpty")}
            onDelete={handleDelete}
            onPlay={handlePlay}
            onGoToDrill={handleGoToDrill}
          />
        )}
      </div>
    </div>
  );
}

function ContentBookmarksList({
  bookmarks,
  isLoading,
  emptyIcon: EmptyIcon,
  emptyMessage,
  onDelete,
  onPlay,
  onGoToDrill,
}: {
  bookmarks: {
    _id: string;
    drillId: string;
    type: "word" | "sentence" | "drill";
    content: string;
    translation?: string;
    context?: string;
    createdAt: string;
  }[];
  isLoading: boolean;
  emptyIcon: typeof BookOpen;
  emptyMessage: string;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onPlay: (content: string, e: React.MouseEvent) => void;
  onGoToDrill: (drillId: string, e: React.MouseEvent) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-7 h-7 animate-spin text-[#22c55e]" />
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <Card className="p-6 text-center">
        <EmptyIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {bookmarks.map((bookmark) => (
        <BookmarkCard
          key={bookmark._id}
          bookmark={{
            ...bookmark,
            type: bookmark.type === "sentence" ? "sentence" : "word",
          }}
          onDelete={onDelete}
          onPlay={onPlay}
          onGoToDrill={onGoToDrill}
        />
      ))}
    </div>
  );
}
